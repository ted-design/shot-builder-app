import { doc, serverTimestamp, writeBatch } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { shotPath } from "@/shared/lib/paths"
import { sanitizeForFirestore } from "@/shared/lib/firestoreSanitize"
import { buildShotWritePayload } from "@/features/shots/lib/updateShot"
import { createShotVersionSnapshot } from "@/features/shots/lib/shotVersioning"
import type {
  AuthUser,
  ProductAssignment,
  Shot,
  ShotLook,
  ShotReferenceImage,
  ShotReferenceLink,
  ShotTag,
} from "@/shared/types"

export type ShotMergeMode = "combine" | "separate" // A = combine, B = separate looks

export interface ShotMergeResult {
  readonly mergedShotId: string
  /** products in the merged active look (combine) or total across looks (separate) */
  readonly productsCombined: number
  /** distinct talentIds added from the secondary */
  readonly talentAdded: number
  /** # looks in the merged shot */
  readonly looksKept: number
  /** # reference images carried into the merged shot's looks */
  readonly referencesKept: number
}

/** Dedup key for a product assignment — British `colourId`, never `colorId`. */
function productKey(p: ProductAssignment): string {
  return `${p.familyId}::${p.skuId ?? ""}::${p.colourId ?? ""}`
}

/** Union products preserving first-seen order, deduped by family/sku/colour. */
function unionProducts(
  lists: ReadonlyArray<ReadonlyArray<ProductAssignment>>,
): ProductAssignment[] {
  const seen = new Set<string>()
  const out: ProductAssignment[] = []
  for (const list of lists) {
    for (const p of list) {
      const key = productKey(p)
      if (seen.has(key)) continue
      seen.add(key)
      out.push(p)
    }
  }
  return out
}

/** Union reference images preserving first-seen order, deduped by id. */
function unionRefs(
  lists: ReadonlyArray<ReadonlyArray<ShotReferenceImage>>,
): ShotReferenceImage[] {
  const seen = new Set<string>()
  const out: ShotReferenceImage[] = []
  for (const list of lists) {
    for (const r of list) {
      if (seen.has(r.id)) continue
      seen.add(r.id)
      out.push(r)
    }
  }
  return out
}

/**
 * Normalize a shot to a list of looks.
 * - If `looks[]` exists, use them verbatim (preserve ids/labels/order/refs/hero/display).
 * - Else if root `products[]` exists, synthesize one look.
 * - Else [].
 */
function normalizeToLooks(shot: Shot): ShotLook[] {
  if (shot.looks?.length) return [...shot.looks]
  if (shot.products?.length) {
    return [
      {
        id: `${shot.id}-root`,
        label: "Primary",
        order: 0,
        products: shot.products,
        references: [],
      },
    ]
  }
  return []
}

function looksRefs(looks: ReadonlyArray<ShotLook>): ShotReferenceImage[][] {
  return looks.map((l) => [...(l.references ?? [])])
}

function countLooksRefs(looks: ReadonlyArray<ShotLook>): number {
  let n = 0
  for (const l of looks) n += l.references?.length ?? 0
  return n
}

/** Union+dedup two string arrays, preserving first-seen order. */
function unionStrings(a: ReadonlyArray<string>, b: ReadonlyArray<string>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of [...a, ...b]) {
    if (seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
}

/**
 * PURE — no Firestore. Returns the deep-SANITIZED patch for the primary plus
 * the result counts. The planner keeps `looks[]` as the source of truth and
 * MIRRORS root `products` = the active look's products. `notes` is NEVER touched
 * (BLOCKED_FIELD); concatenation targets `notesAddendum`.
 */
export function buildShotMergePlan(args: {
  primary: Shot
  secondary: Shot
  mode: ShotMergeMode
}): { patch: Record<string, unknown>; result: Omit<ShotMergeResult, "mergedShotId"> } {
  const { primary, secondary, mode } = args

  const primaryLooks = normalizeToLooks(primary)
  const secondaryLooks = normalizeToLooks(secondary)

  let mergedLooks: ShotLook[]
  let activeLookId: string | null

  if (mode === "combine") {
    const targetLook: ShotLook =
      primaryLooks.find((l) => l.id === primary.activeLookId) ??
      primaryLooks[0] ?? {
        id: `${primary.id}-merged`,
        label: "Primary",
        order: 0,
        products: [],
      }

    const allLooks = [...primaryLooks, ...secondaryLooks]
    const products = unionProducts(allLooks.map((l) => l.products ?? []))
    const references = unionRefs(looksRefs(allLooks))

    const productIds = new Set(products.map((p) => p.familyId))
    const refIds = new Set(references.map((r) => r.id))
    const heroProductId =
      targetLook.heroProductId && productIds.has(targetLook.heroProductId)
        ? targetLook.heroProductId
        : null
    const displayImageId =
      targetLook.displayImageId && refIds.has(targetLook.displayImageId)
        ? targetLook.displayImageId
        : null

    mergedLooks = [
      {
        ...targetLook,
        order: 0,
        products,
        references,
        heroProductId,
        displayImageId,
      },
    ]
    activeLookId = mergedLooks[0]!.id
  } else {
    const primaryIds = new Set(primaryLooks.map((l) => l.id))
    const usedIds = new Set(primaryIds)
    const remappedSecondary = secondaryLooks.map((l) => {
      if (!usedIds.has(l.id)) {
        usedIds.add(l.id)
        return l
      }
      let candidate = `${l.id}-b`
      while (usedIds.has(candidate)) candidate = `${candidate}-b`
      usedIds.add(candidate)
      return { ...l, id: candidate }
    })

    mergedLooks = [...primaryLooks, ...remappedSecondary].map((l, i) => ({
      ...l,
      order: i,
    }))

    const primaryActiveInMerged =
      primary.activeLookId != null && primaryIds.has(primary.activeLookId)
    activeLookId = primaryActiveInMerged
      ? primary.activeLookId!
      : (mergedLooks[0]?.id ?? null)
  }

  const rootProductsMirror =
    mergedLooks.find((l) => l.id === activeLookId)?.products ?? []

  const talent = unionStrings(primary.talent ?? [], secondary.talent ?? [])
  const talentIds = unionStrings(primary.talentIds ?? [], secondary.talentIds ?? [])

  const primaryTalentIdSet = new Set(primary.talentIds ?? [])
  const talentAdded = (secondary.talentIds ?? []).filter(
    (id) => !primaryTalentIdSet.has(id),
  ).length

  const referenceLinks = unionReferenceLinks(
    primary.referenceLinks ?? [],
    secondary.referenceLinks ?? [],
  )
  const tags = unionTags(primary.tags ?? [], secondary.tags ?? [])

  const patch: Record<string, unknown> = {
    looks: mergedLooks,
    activeLookId,
    products: rootProductsMirror,
  }

  // Only include the union fields when non-empty so the merge never writes `[]`
  // to a field both shots lacked (which would change the document shape). The
  // union is always a superset of the primary's, so omitting an empty result
  // never drops existing data — the in-place primary update leaves its (also
  // empty/absent) field untouched.
  if (talent.length > 0) patch.talent = talent
  if (talentIds.length > 0) patch.talentIds = talentIds
  if (referenceLinks.length > 0) patch.referenceLinks = referenceLinks
  if (tags.length > 0) patch.tags = tags

  // heroImage: primary ?? secondary. Omit the key entirely if both absent —
  // never write null over an existing image.
  const heroImage = primary.heroImage ?? secondary.heroImage
  if (heroImage) patch.heroImage = heroImage

  // notesAddendum concatenation — NEVER `notes`.
  // Only build a divider when there is real prose on either side; a divider with
  // no surrounding content is "nothing to add" → omit the key.
  const primaryAddendum =
    typeof primary.notesAddendum === "string" && primary.notesAddendum.trim()
      ? primary.notesAddendum
      : ""
  const secondaryAddendum =
    typeof secondary.notesAddendum === "string" && secondary.notesAddendum.trim()
      ? secondary.notesAddendum
      : ""
  if (primaryAddendum || secondaryAddendum) {
    const divider = `— merged from "${secondary.title}" —`
    const notesAddendum = [primaryAddendum, divider, secondaryAddendum]
      .filter((s) => s.length > 0)
      .join("\n\n")
    // Omit if the result equals primary's existing addendum (nothing to add).
    if (notesAddendum && notesAddendum !== primaryAddendum) {
      patch.notesAddendum = notesAddendum
    }
  }

  const sanitized = sanitizeForFirestore(patch) as Record<string, unknown>

  const result: Omit<ShotMergeResult, "mergedShotId"> = {
    productsCombined:
      mode === "combine"
        ? rootProductsMirror.length
        : mergedLooks.reduce((n, l) => n + (l.products?.length ?? 0), 0),
    talentAdded,
    looksKept: mergedLooks.length,
    referencesKept: countLooksRefs(mergedLooks),
  }

  return { patch: sanitized, result }
}

/** Union+dedup reference links by `url`, preserving first-seen order. */
function unionReferenceLinks(
  a: ReadonlyArray<ShotReferenceLink>,
  b: ReadonlyArray<ShotReferenceLink>,
): ShotReferenceLink[] {
  const seen = new Set<string>()
  const out: ShotReferenceLink[] = []
  for (const link of [...a, ...b]) {
    if (seen.has(link.url)) continue
    seen.add(link.url)
    out.push(link)
  }
  return out
}

/** Union+dedup tags by `id`, preserving first-seen order. */
function unionTags(
  a: ReadonlyArray<ShotTag>,
  b: ReadonlyArray<ShotTag>,
): ShotTag[] {
  const seen = new Set<string>()
  const out: ShotTag[] = []
  for (const tag of [...a, ...b]) {
    if (seen.has(tag.id)) continue
    seen.add(tag.id)
    out.push(tag)
  }
  return out
}

/** Build a Firestore doc ref from a path-helper string array. */
function shotDocRef(shotId: string, clientId: string) {
  const path = shotPath(shotId, clientId)
  return doc(db, path[0]!, ...path.slice(1))
}

/**
 * Orchestrator — applies the merge as a SINGLE atomic WriteBatch: the primary's
 * merged patch and the secondary's soft-delete commit together or not at all, so
 * a partial failure can never leave a half-merged pair (both shots visible with
 * duplicated products). Version snapshots are best-effort audit writes fired
 * after the atomic merge lands (mirroring updateShotWithVersion's posture).
 */
export async function executeShotMerge(args: {
  clientId: string
  primary: Shot
  secondary: Shot
  mode: ShotMergeMode
  user: AuthUser | null
}): Promise<ShotMergeResult> {
  const { clientId, primary, secondary, mode, user } = args
  if (!clientId) throw new Error("Missing clientId.")

  const { patch, result } = buildShotMergePlan({ primary, secondary, mode })

  // buildShotWritePayload strips the BLOCKED `notes` field + top-level undefined
  // (the patch is already deep-sanitized); same guard updateShotWithVersion uses.
  const primaryPayload = buildShotWritePayload(patch)
  const secondaryPayload: Record<string, unknown> = {
    deleted: true,
    deletedAt: serverTimestamp(),
  }
  const auditFields = user?.uid ? { updatedBy: user.uid } : {}

  const batch = writeBatch(db)
  batch.update(shotDocRef(primary.id, clientId), {
    ...primaryPayload,
    updatedAt: serverTimestamp(),
    ...auditFields,
  })
  batch.update(shotDocRef(secondary.id, clientId), {
    ...secondaryPayload,
    updatedAt: serverTimestamp(),
    ...auditFields,
  })
  await batch.commit()

  // Best-effort version snapshots (audit, not core state) — never block or fail
  // the merge if they error.
  if (user?.uid) {
    void createShotVersionSnapshot({
      clientId,
      shotId: primary.id,
      previousShot: primary,
      patch: primaryPayload,
      user,
      changeType: "update",
    }).catch((err) => {
      console.error("[executeShotMerge] primary version snapshot failed", err)
    })
    void createShotVersionSnapshot({
      clientId,
      shotId: secondary.id,
      previousShot: secondary,
      patch: secondaryPayload,
      user,
      changeType: "update",
    }).catch((err) => {
      console.error("[executeShotMerge] loser version snapshot failed", err)
    })
  }

  return { mergedShotId: primary.id, ...result }
}
