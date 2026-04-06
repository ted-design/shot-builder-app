/**
 * Resolves shot data for denormalization into a shotShares document.
 *
 * Called at share-creation time (user is authenticated) so all Firestore
 * reads succeed under normal security rules. The resolved payload is
 * stored in the share document so the public page can render it without
 * any Cloud Function or further Firestore queries.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { shotsPath, projectPath, talentPath, locationsPath } from "@/shared/lib/paths"
import { canonicalizeTag, deduplicateTags } from "@/shared/lib/tagDedup"
import type { ProductAssignment, ShotLook } from "@/shared/types"

export interface ResolvedPublicShot {
  readonly id: string
  readonly title: string
  readonly shotNumber: string | null
  readonly status: string
  readonly date: string | null
  readonly locationName: string | null
  readonly talentNames: readonly string[]
  readonly productLines: readonly string[]
  readonly description: string | null
  readonly notesAddendum: string | null
  readonly tags?: readonly { readonly id: string; readonly label: string; readonly color: string; readonly category?: string }[]
  readonly referenceLinks?: readonly { readonly id: string; readonly title: string; readonly url: string; readonly type: string }[]
}

export interface ResolvedSharePayload {
  readonly projectName: string
  readonly resolvedShots: readonly ResolvedPublicShot[]
}

/** Create a Firestore doc ref from a path helper array + optional extra segment. */
function docRef(path: string[], ...extra: string[]) {
  const segments = [...path, ...extra]
  return doc(db, segments[0]!, ...segments.slice(1))
}

/** Create a Firestore collection ref from a path helper array. */
function colRef(path: string[]) {
  return collection(db, path[0]!, ...path.slice(1))
}

function normaliseString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function formatProduct(p: ProductAssignment): string | null {
  const familyName = normaliseString(p.familyName) ?? normaliseString(p.skuName)
  if (!familyName) return null

  const parts: string[] = []
  const colour = normaliseString(p.colourName)
  if (colour) parts.push(colour)

  const scope = p.sizeScope
  if (scope === "all") parts.push("All sizes")
  else if (scope === "pending" || !scope) parts.push("Size TBD")
  else if (scope === "single") {
    const size = normaliseString(p.size)
    if (size) parts.push(size)
  }

  const qty = typeof p.quantity === "number" && Number.isFinite(p.quantity) ? p.quantity : null
  if (qty && qty > 1) parts.push(`x${qty}`)

  return parts.length > 0 ? `${familyName} (${parts.join(" \u2022 ")})` : familyName
}

function primaryLookProducts(looks: readonly ShotLook[] | undefined): readonly ProductAssignment[] {
  if (!looks || looks.length === 0) return []
  let primary: ShotLook = looks[0]!
  for (const l of looks) {
    const currentOrder = typeof primary.order === "number" ? primary.order : 0
    const nextOrder = typeof l.order === "number" ? l.order : 0
    if (nextOrder < currentOrder) primary = l
  }
  return primary.products ?? []
}

function timestampToIso(ts: unknown): string | null {
  if (!ts || typeof ts !== "object") return null
  try {
    const d = (ts as { toDate: () => Date }).toDate()
    return d.toISOString()
  } catch {
    return null
  }
}

export async function resolveShotsForShare(
  clientId: string,
  projectId: string,
  shotIds: readonly string[] | null,
): Promise<ResolvedSharePayload> {
  // Resolve project name
  const projectRef = docRef(projectPath(projectId, clientId))
  const projectSnap = await getDoc(projectRef)
  const projectName = projectSnap.exists()
    ? (normaliseString((projectSnap.data() as Record<string, unknown>).name) ?? "Project")
    : "Project"

  // Resolve shots
  type ShotDoc = { id: string; data: Record<string, unknown> }
  let shotDocs: ShotDoc[] = []

  const validShotIds = shotIds
    ? shotIds.filter((id) => typeof id === "string" && id.trim().length > 0)
    : null

  if (validShotIds && validShotIds.length > 0) {
    const refs = validShotIds.map((sid) => docRef(shotsPath(clientId), sid))
    const snaps = await Promise.all(refs.map((r) => getDoc(r)))
    shotDocs = snaps
      .filter((s) => s.exists())
      .map((s) => ({ id: s.id, data: (s.data() ?? {}) as Record<string, unknown> }))
  } else {
    const shotsRef = colRef(shotsPath(clientId))
    const q = query(
      shotsRef,
      where("projectId", "==", projectId),
    )
    const snaps = await getDocs(q)
    shotDocs = snaps.docs.map((d) => ({ id: d.id, data: (d.data() ?? {}) as Record<string, unknown> }))
  }

  // Filter to correct project and non-deleted
  const shotsRaw = shotDocs.filter(
    (d) => d.data.projectId === projectId && d.data.deleted !== true,
  )

  // Collect unique talent and location IDs for batch resolution
  const talentIdSet = new Set<string>()
  const locationIdSet = new Set<string>()

  for (const s of shotsRaw) {
    const list = Array.isArray(s.data.talentIds)
      ? s.data.talentIds
      : Array.isArray(s.data.talent)
        ? s.data.talent
        : []
    for (const id of list) {
      if (typeof id === "string" && id.trim().length > 0) talentIdSet.add(id)
    }
    const locId = s.data.locationId
    if (typeof locId === "string" && locId.trim().length > 0) locationIdSet.add(locId)
  }

  // Batch read talent names
  const talentNameById = new Map<string, string>()
  if (talentIdSet.size > 0) {
    const talentRefs = Array.from(talentIdSet).map((tid) => docRef(talentPath(clientId), tid))
    const snaps = await Promise.all(talentRefs.map((r) => getDoc(r)))
    for (const s of snaps) {
      const name = s.exists() ? normaliseString((s.data() as Record<string, unknown>).name) : null
      if (name) talentNameById.set(s.id, name)
    }
  }

  // Batch read location names
  const locationNameById = new Map<string, string>()
  if (locationIdSet.size > 0) {
    const locationRefs = Array.from(locationIdSet).map((lid) => docRef(locationsPath(clientId), lid))
    const snaps = await Promise.all(locationRefs.map((r) => getDoc(r)))
    for (const s of snaps) {
      const name = s.exists() ? normaliseString((s.data() as Record<string, unknown>).name) : null
      if (name) locationNameById.set(s.id, name)
    }
  }

  // Build resolved shots
  const resolvedShots: ResolvedPublicShot[] = shotsRaw.map((s) => {
    const d = s.data
    const title = normaliseString(d.title) ?? normaliseString(d.name) ?? "Untitled Shot"
    const shotNumber = normaliseString(d.shotNumber)
    const status = normaliseString(d.status) ?? "todo"

    const locationId = normaliseString(d.locationId)
    const locationName =
      normaliseString(d.locationName) ??
      (locationId ? locationNameById.get(locationId) ?? null : null)

    const talentList: unknown[] = Array.isArray(d.talentIds)
      ? d.talentIds
      : Array.isArray(d.talent)
        ? d.talent
        : []
    const talentNames = talentList
      .map((id) => (typeof id === "string" ? id.trim() : ""))
      .filter(Boolean)
      .map((id) => talentNameById.get(id) ?? null)
      .filter((n): n is string => n !== null)

    const looks = Array.isArray(d.looks) ? (d.looks as ShotLook[]) : undefined
    const productsRaw = primaryLookProducts(looks)
    const fallbackProducts = Array.isArray(d.products) ? (d.products as ProductAssignment[]) : []
    const products = productsRaw.length > 0 ? productsRaw : fallbackProducts
    const productLines = products.map(formatProduct).filter((l): l is string => l !== null)

    const tags = (() => {
      const raw = Array.isArray(d.tags) ? d.tags : []
      const validated = raw
        .filter((t: unknown): t is { id: string; label: string; color: string; category?: string } =>
          !!t && typeof t === "object" && typeof (t as Record<string, unknown>).id === "string" && typeof (t as Record<string, unknown>).label === "string"
        )
        .map((t) => canonicalizeTag({
          id: t.id,
          label: t.label,
          color: typeof t.color === "string" ? t.color : "",
          category: typeof t.category === "string" ? t.category as "priority" | "gender" | "media" | "other" : undefined,
        }))
      return deduplicateTags(validated).map((t) => ({
        id: t.id,
        label: t.label,
        color: t.color,
        category: t.category,
      }))
    })()

    const referenceLinks = (() => {
      const raw = Array.isArray(d.referenceLinks) ? d.referenceLinks : []
      return raw
        .filter((l: unknown): l is { id: string; title: string; url: string; type: string } =>
          !!l && typeof l === "object" && typeof (l as Record<string, unknown>).url === "string"
        )
        .map((l) => ({
          id: typeof l.id === "string" ? l.id : "",
          title: typeof l.title === "string" ? l.title : "",
          url: l.url,
          type: typeof l.type === "string" ? l.type : "web",
        }))
    })()

    return {
      id: s.id,
      title,
      shotNumber,
      status,
      date: timestampToIso(d.date),
      locationName: locationName ?? null,
      talentNames,
      productLines,
      description: normaliseString(d.description) ?? null,
      notesAddendum: normaliseString(d.notesAddendum) ?? null,
      tags,
      referenceLinks,
    }
  })

  return { projectName, resolvedShots }
}
