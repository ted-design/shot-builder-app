import type {
  Lane,
  ProductAssignment,
  ProductFamily,
  Shot,
  ShotLook,
  ShotTag,
  SizeScope,
  TalentRecord,
} from "@/shared/types"
import type { ExportData } from "../../hooks/useExportData"
import { humanizeLabel } from "@/shared/lib/textUtils"
import { SHOT_STATUS_CYCLE } from "@/shared/lib/statusMappings"
import { applyFilterConditions } from "@/features/shots/lib/filterEngine"
import { deduplicateTags } from "@/shared/lib/tagDedup"
import { resolveShotTagCategory } from "@/shared/lib/tagCategories"
import {
  REPORT_STATUS_LABEL,
  formatFilterSummary,
  resolveReportFilters,
  type GenderKey,
  type ReportConfig,
  type ReportGroup,
  type ReportLook,
  type ReportModel,
  type ReportProduct,
  type ReportShot,
  type ReportShotStatus,
  type ReportShotTag,
  type ReportSortField,
  type ReportTalent,
} from "./reportTypes"
import {
  compareByOrder,
  compareShotNumber,
  compareText,
  orderedBuckets,
  shotNumberSortKey,
  sortItemsStable,
} from "./reportSort"

// Re-exported so talentModel / productInfoModel keep their existing
// `import { shotNumberSortKey } from "./reportModel"` — single source of truth.
export { shotNumberSortKey } from "./reportSort"

// Pure derivation: ExportData + config -> ReportModel. No async, no image bytes
// (image fields are path/URL candidates resolved later). The single source both
// the DOM and PDF renderers consume.

/** Normalize a free-form gender string to M/W, or null when unknown. */
export function normalizeGender(raw: string | null | undefined): "M" | "W" | null {
  if (!raw) return null
  const v = raw.trim().toLowerCase()
  if (v === "m" || v === "men" || v === "man" || v === "male" || v === "mens") return "M"
  if (v === "w" || v === "women" || v === "woman" || v === "female" || v === "womens") return "W"
  return null
}

function pickLookDisplayImage(look: ShotLook): string | null {
  const refs = look.references ?? []
  if (refs.length === 0) return null
  const chosen =
    (look.displayImageId && refs.find((r) => r.id === look.displayImageId)) || refs[0]
  return chosen?.downloadURL ?? chosen?.path ?? null
}

/** Extract the raw Storage path from a Firebase download URL, when the string
 *  IS one (e.g. "https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<encoded
 *  path>?..."). Returns null for anything else (a bare path, a non-Firebase
 *  URL, a data: URL). Mirrors resolvePdfImageSrc.ts's
 *  parseFirebaseDownloadUrlToStoragePath byte-for-byte — duplicated, not
 *  imported, because that module pulls in firebase/storage + the live
 *  storage client and this one is a PURE derivation (see the file header).
 *  Keep the two in sync if either changes. */
function parseFirebaseDownloadUrlToStoragePath(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.hostname !== "firebasestorage.googleapis.com") return null
    const marker = "/o/"
    const idx = parsed.pathname.indexOf(marker)
    if (idx === -1) return null
    const encoded = parsed.pathname.slice(idx + marker.length)
    return decodeURIComponent(encoded)
  } catch {
    return null
  }
}

/** Resolved image identity for a hero image or a look reference — the actual
 *  stored object, not the reference id. Canonicalizes to the underlying
 *  Storage PATH whenever downloadURL is a recognizable Firebase download URL
 *  (parseFirebaseDownloadUrlToStoragePath above), so a reference normalized
 *  with only `path` (mapShot.ts's normalizeReferences omits downloadURL when
 *  the raw doc only ever stored a path) and a sibling normalized with a full
 *  `downloadURL` pointing at the SAME stored object compare equal here —
 *  without this, the WS-C dedupe (additionalImages / cover-exclusion) can
 *  silently miss the collision (one candidate is a bare path, the other a
 *  full https URL) and the same image renders, and gets fetched, twice.
 *  Falls back to the raw downloadURL, then path, when it isn't a parseable
 *  Firebase URL (a non-Firebase host, or a bare path already). */
function resolveImageIdentity(img: { readonly path: string; readonly downloadURL?: string }): string {
  if (img.downloadURL) {
    return parseFirebaseDownloadUrlToStoragePath(img.downloadURL) ?? img.downloadURL
  }
  return img.path
}

/** Best image candidate for a styled product: assignment thumbs, then family thumbnail. */
export function pickProductImage(
  p: ProductAssignment,
  family: ProductFamily | undefined,
): string | null {
  return (
    p.thumbUrl ?? p.skuImageUrl ?? p.familyImageUrl ?? family?.thumbnailImagePath ?? null
  )
}

function resolveProducts(
  products: readonly ProductAssignment[],
  heroProductId: string | null | undefined,
  familyById: ReadonlyMap<string, ProductFamily>,
): readonly ReportProduct[] {
  return products.map((p) => {
    const family = familyById.get(p.familyId)
    const gender = normalizeGender(p.familyId ? family?.gender : null)
    return {
      family: p.familyName ?? family?.styleName ?? "Unspecified product",
      style: family?.styleNumber ?? null,
      colour: p.colourName ?? p.skuName ?? null,
      size: p.size ?? null,
      sizeScope: p.sizeScope ?? null,
      qty: p.quantity ?? null,
      gender: (gender ?? "?") as GenderKey,
      // hero = explicit isHero flag OR the look's heroProductId points at this family
      isHero: p.isHero === true || (heroProductId != null && heroProductId === p.familyId),
      img: pickProductImage(p, family),
    }
  })
}

/** Look label rule: explicit label, else Primary for the first by order, else "Alt N". */
export function lookLabel(rawLabel: string | null | undefined, index: number): string {
  const trimmed = rawLabel?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : index === 0 ? "Primary" : `Alt ${index}`
}

/** Size display: a concrete size, "All sizes" (bulk scope — a real value, not muted),
 *  else "Pending". `pending` drives the muted style. One source both renderers consume. */
export function sizeLabel(
  sizeScope: SizeScope | null,
  size: string | null,
): { readonly text: string; readonly pending: boolean } {
  // Pending scope is always pending, even if a stale size value lingers on the doc.
  if (sizeScope === "pending") return { text: "Pending", pending: true }
  if (sizeScope === "all") return { text: "All sizes", pending: false }
  const trimmed = size?.trim()
  if (trimmed) return { text: trimmed, pending: false }
  return { text: "Pending", pending: true }
}

/** Sort a shot's looks by order (shared by the shot + product-info derivations). */
export function sortLooksByOrder(looks: readonly ShotLook[]): readonly ShotLook[] {
  return [...looks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

// Storage filename `uploadHeroImage` (uploadImage.ts) always writes a manual
// hero upload to: the ONLY way Shot.heroImage.path ends in this today. Every
// OTHER heroImage shape (the vast majority — see isManualHeroImage below) is
// mapShot.normalizeHeroImage SYNTHESIZING a candidate from the shot's looks/
// products/attachments, not a distinct user choice. Same convention already
// used to gate the manual "Reset cover" affordance — ActiveLookCoverReferencesPanel.tsx
// and HeroImageSection.tsx both key off this exact substring.
const MANUAL_HERO_PATH_MARKER = "/hero.webp"

/** True only for a hero image the user explicitly uploaded via HeroImageSection
 *  (Shot.heroImage.path === `clients/<c>/shots/<id>/hero.webp`) — NOT for a
 *  heroImage mapShot synthesized from the active look / a look's displayImageId /
 *  a hero product / a legacy attachment (normalizeHeroImage, mapShot.ts:139).
 *  That synthesis runs for virtually every shot, and its Priority-1 term reads
 *  `Shot.activeLookId` — the SAME field ShotLooksSection's look-tab click
 *  ("setActiveLookForCover") patches on a routine edit, with a DIFFERENT
 *  precedence than this model's own sortLooksByOrder/looks[0] "primary look".
 *  Trusting a synthesized heroImage as the report cover would silently swap
 *  the cover to whichever look is merely ACTIVE (last clicked in the editor)
 *  instead of the report's own primary (order 0) look. */
function isManualHeroImage(heroImage: Shot["heroImage"]): boolean {
  return !!heroImage?.path && heroImage.path.includes(MANUAL_HERO_PATH_MARKER)
}

function resolveLooks(
  shot: Shot,
  sortedRawLooks: readonly ShotLook[],
  familyById: ReadonlyMap<string, ProductFamily>,
): readonly ReportLook[] {
  // Cover semantics (WS-C, 2026-08-11): a MANUALLY-uploaded Shot.heroImage
  // (isManualHeroImage above) WINS over the look's own reference/product-
  // fallback logic, but ONLY for the PRIMARY look slot (index 0 below) —
  // alt-look rendering under looksMode:"all" is untouched. A synthesized
  // heroImage (the common case — see isManualHeroImage) is a no-op here,
  // same as an absent one, so a shot that has never uploaded a manual hero
  // renders byte-identical to pre-WS-C.
  const heroCandidate = isManualHeroImage(shot.heroImage) ? resolveImageIdentity(shot.heroImage!) : null
  return sortedRawLooks.map((look, i): ReportLook => {
    const label = lookLabel(look.label, i)
    const isAlt = i > 0 || /^alt/i.test(label)
    const products = resolveProducts(look.products, look.heroProductId, familyById)
    // The PRIMARY look's plate falls back to a product image (hero first) when there's
    // no uploaded reference, so pre-shoot decks still show a thumbnail. Alt looks stay
    // reference-only (they keep their "no reference" slot rather than a product stand-in).
    // `hasReference` always tracks the real reference (the "references ready" counter
    // must not count the product fallback, and stays independent of Shot.heroImage too).
    const reference = pickLookDisplayImage(look)
    const productFallback = isAlt
      ? null
      : products.find((p) => p.isHero)?.img ?? products.find((p) => p.img)?.img ?? null
    const legacyImage = reference ?? productFallback
    const image = i === 0 ? heroCandidate ?? legacyImage : legacyImage
    return { id: look.id, label, isAlt, image, hasReference: reference != null, products }
  })
}

/**
 * Additional-images row (WS-C, 2026-08-11): every reference image on
 * `visibleRawLooks` (the caller passes the looksMode-filtered slice — primary
 * look only, or every rendered look), minus whichever image resolved as the
 * shot's cover, deduped by RESOLVED IMAGE IDENTITY (see resolveImageIdentity)
 * rather than reference id — so a hero that happens to point at the same
 * stored object as a reference is excluded regardless of which id it carries,
 * and two references sharing a stored object collapse to one thumb. Order
 * preserved: look order, then reference order within a look.
 */
function resolveAdditionalImages(
  visibleRawLooks: readonly ShotLook[],
  coverIdentity: string | null,
): readonly string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const look of visibleRawLooks) {
    for (const ref of look.references ?? []) {
      const identity = resolveImageIdentity(ref)
      if (identity === coverIdentity || seen.has(identity)) continue
      seen.add(identity)
      out.push(identity)
    }
  }
  return out
}

// Tag-chip category order (2026-08-17). Media first (the single most
// operationally load-bearing distinction on a crew sheet: is this a Photo or a
// Video setup), then priority, then everything else. "gender" is absent from
// this table ON PURPOSE — it is filtered out entirely below, so a gender tag can
// never fall through to a default order and reappear.
const TAG_CHIP_CATEGORY_ORDER: Record<string, number> = {
  media: 0,
  priority: 1,
  other: 2,
}
const TAG_CHIP_CATEGORY_FALLBACK_ORDER = TAG_CHIP_CATEGORY_ORDER.other ?? 2

/** Excluded from the chip row: gender already prints as its own badge/chip on
 *  every recipe, and under groupBy:"gender" as the group head too. */
const TAG_CHIP_EXCLUDED_CATEGORY = "gender"

// Numeric-aware, case-insensitive — the SAME collator computeUsedTagOptions
// (tagDedup.ts) sorts the report's own tag-filter options with, so the chip
// order on a row and the option order in the Filters control read alike.
const TAG_CHIP_COLLATOR = new Intl.Collator(undefined, { sensitivity: "base", numeric: true })

/**
 * The display-ready tag chips for a shot — see `ReportShot.tags`. PURE.
 *
 * Three steps, in order, each one load-bearing:
 *  1. `deduplicateTags` (the shared tagDedup helper, NOT a local re-implementation)
 *     collapses same-labelled tags by normalized label, preferring the canonical
 *     DEFAULT_TAGS id, and resolves each tag's category.
 *  2. every `category: "gender"` tag is DROPPED — gender is already stated by
 *     the recipe's own gender badge/chip and, under groupBy:"gender", by the
 *     group head; a third statement of it is noise on a dense sheet.
 *  3. a stable sort: media -> priority -> other, alphabetical (numeric-aware)
 *     within a category. Stable ordering matters because the chips print on a
 *     PDF a crew reads side-by-side with another copy — Firestore array order is
 *     whatever the editor last wrote.
 *
 * Exported so the ordering/exclusion rule is directly unit-testable, rather than
 * only reachable through a full deriveShotReportModel run.
 */
export function resolveReportTagChips(
  tags: readonly ShotTag[] | undefined,
): readonly ReportShotTag[] {
  if (!tags || tags.length === 0) return []
  const chips: ReportShotTag[] = []
  for (const tag of deduplicateTags(tags)) {
    const category = resolveShotTagCategory(tag)
    if (category === TAG_CHIP_EXCLUDED_CATEGORY) continue
    chips.push({ id: tag.id, label: tag.label, category })
  }
  return chips.sort((a, b) => {
    const orderA = TAG_CHIP_CATEGORY_ORDER[a.category ?? ""] ?? TAG_CHIP_CATEGORY_FALLBACK_ORDER
    const orderB = TAG_CHIP_CATEGORY_ORDER[b.category ?? ""] ?? TAG_CHIP_CATEGORY_FALLBACK_ORDER
    return orderA - orderB || TAG_CHIP_COLLATOR.compare(a.label, b.label)
  })
}

/** Shot gender cascade: explicit gender tag -> products' family genders -> "?". */
function resolveShotGender(shot: Shot, looks: readonly ReportLook[]): GenderKey {
  const tag = shot.tags?.find((t) => t.category === "gender")
  const fromTag = normalizeGender(tag?.label)
  if (fromTag) return fromTag

  const genders = new Set<"M" | "W">()
  for (const look of looks) {
    for (const p of look.products) {
      if (p.gender === "M" || p.gender === "W") genders.add(p.gender)
    }
  }
  const arr = [...genders]
  if (arr.length === 1 && arr[0]) return arr[0]
  if (arr.length > 1) return "Mixed"
  return "?"
}

function resolveTalent(
  shot: Shot,
  talentById: ReadonlyMap<string, TalentRecord>,
): readonly ReportTalent[] {
  const ids = shot.talentIds ?? []
  return ids.map((id): ReportTalent => {
    const t = talentById.get(id)
    return {
      id,
      name: t?.name ?? "Unknown",
      img: t?.headshotUrl ?? t?.imageUrl ?? t?.headshotPath ?? null,
    }
  })
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** Parse a "YYYY-MM-DD" date-only string into parts; null if malformed. (No Date() — avoids TZ shift.) */
function parseDateOnly(s: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return { y, m: mo, d }
}

/** Format shoot dates into a display window: "Jun 2, 2026" / "Jun 2–6, 2026" / "Jun 28 – Jul 2, 2026" / cross-year. Null when none. */
export function formatDateWindow(dates: readonly string[] | null | undefined): string | null {
  const parsed = (dates ?? []).map(parseDateOnly).filter((p): p is NonNullable<typeof p> => p != null)
  if (parsed.length === 0) return null
  const sorted = [...parsed].sort((a, b) => a.y - b.y || a.m - b.m || a.d - b.d)
  const lo = sorted[0]!
  const hi = sorted[sorted.length - 1]!
  const day = (p: typeof lo) => `${MONTHS[p.m - 1]} ${p.d}`
  if (lo.y === hi.y && lo.m === hi.m && lo.d === hi.d) return `${day(lo)}, ${lo.y}`
  if (lo.y === hi.y && lo.m === hi.m) return `${MONTHS[lo.m - 1]} ${lo.d}–${hi.d}, ${lo.y}`
  if (lo.y === hi.y) return `${day(lo)} – ${day(hi)}, ${lo.y}`
  return `${day(lo)}, ${lo.y} – ${day(hi)}, ${hi.y}`
}

/** Title-case a client slug via the shared humanizer (lowercases the tail first, so acronyms degrade). */
export function titleCaseSlug(slug: string | null | undefined): string {
  return slug ? humanizeLabel(slug.toLowerCase()) : ""
}

export const GROUP_ORDER: readonly GenderKey[] = ["W", "M", "Mixed", "?"]
export const GROUP_LABEL: Record<GenderKey, string> = {
  W: "Women",
  M: "Men",
  Mixed: "Mixed",
  "?": "Unresolved",
}

// Fixed bucket + sort order for shot status (workflow order, O4). Mirrors GROUP_ORDER.
// Derived from the canonical SHOT_STATUS_CYCLE (statusMappings.ts) — same
// todo, in_progress, on_hold, complete order, not a separate local literal.
export const STATUS_GROUP_ORDER: readonly ReportShotStatus[] = SHOT_STATUS_CYCLE

/**
 * Reduce an entry's many appearance-statuses to the ONE it groups under (O2):
 * its **most-outstanding** (least-done) appearance = the status with the lowest
 * `STATUS_GROUP_ORDER` index. So a product/talent appearing in any un-shot shot
 * lands in that outstanding bucket, and each item appears in exactly one group.
 * Returns `null` for an item with no appearances (a never-shot library entry) —
 * the caller buckets those under a "No shots" group. An out-of-union status ranks
 * last (never spuriously "most outstanding").
 */
export function mostOutstandingStatus(
  statuses: readonly ReportShotStatus[],
): ReportShotStatus | null {
  let best: ReportShotStatus | null = null
  let bestRank = Number.POSITIVE_INFINITY
  for (const s of statuses) {
    const idx = STATUS_GROUP_ORDER.indexOf(s)
    const rank = idx === -1 ? Number.MAX_SAFE_INTEGER : idx
    if (rank < bestRank) {
      bestRank = rank
      best = s
    }
  }
  return best
}

/** Bucket key/label for entries with no appearances when grouping by status (O2). */
export const NO_SHOTS_GROUP_KEY = "__no_shots__"
export const NO_SHOTS_GROUP_LABEL = "No shots"

/** Bucket key/label for groupBy:"scene" ("Set") shots with no laneId, or whose
 *  laneId no longer resolves to a live Lane doc (an orphaned reference — same
 *  treatment the shot list gives it: don't crash, don't drop the shot, show it
 *  unset). Always sorts last (see buildSceneGroups). */
export const NO_SET_GROUP_KEY = "__no_set__"
export const NO_SET_GROUP_LABEL = "No set"

/**
 * Group entries (products/talent) by their most-outstanding appearance status (O2).
 * One bucket per item; `statusesOf` extracts an item's appearance statuses. Buckets
 * are ordered by `STATUS_GROUP_ORDER`; within a bucket the input order is preserved
 * (so the R5 sort already applied to `items` survives). Items with no appearances
 * fall into a trailing "No shots" bucket. The two report models map the result onto
 * their own Group shape.
 */
export function buildStatusGroups<T>(
  items: readonly T[],
  statusesOf: (item: T) => readonly ReportShotStatus[],
): ReadonlyArray<{ readonly key: string; readonly label: string; readonly count: number; readonly items: readonly T[] }> {
  return orderedBuckets(
    items,
    (item) => mostOutstandingStatus(statusesOf(item)) ?? NO_SHOTS_GROUP_KEY,
    (a, b) => compareByOrder(STATUS_GROUP_ORDER, a, b),
    (k) => (k === NO_SHOTS_GROUP_KEY ? NO_SHOTS_GROUP_LABEL : REPORT_STATUS_LABEL[k as ReportShotStatus]),
  )
}

// Secondary key for the shot sort — ALWAYS ascending (deterministic tie-break):
// spec-mandated shot number, then id as the final determinism guarantee.
const SHOT_TIEBREAK = (a: ReportShot, b: ReportShot): number =>
  compareShotNumber(a.number, b.number) || compareText(a.id, b.id)

/**
 * "custom" comparator: respects the shot's own drag order (Shot.sortOrder).
 *
 * `sortOrder: 0` is AMBIGUOUS at the per-shot level: mapShot defaults a
 * Firestore doc that's never carried the field to 0, but the app's own
 * reorder writers ALSO mint a real, meaningful 0 for the FIRST shot —
 * persistShotOrder's full-reindex (`sortOrder: start + i` from index 0,
 * reorderShots.ts) and range branches (`start = min(from, to)`, which is 0
 * whenever the moved range includes the top of the list), and
 * renumberShots/renumberShotsWithScenes (`newSortOrder = i` /
 * `offsets[gIdx] + i`, first shot of the first scene = 0). Every drag
 * reorder in the shot list goes through persistShotOrder with NO range
 * (DraggableShotList.tsx), so it ALWAYS produces exactly one shot with a
 * real sortOrder of 0. Treating that 0 as "missing" banished the shot the
 * user just dragged to the top to the BOTTOM of the custom-order report.
 *
 * There is no way to tell "real 0" from "never touched" on a single shot —
 * so, like useShots.ts's own client sort (useShots.ts:33), this decides at
 * the SET level: if ANY shot in scope carries a non-zero sortOrder, a real
 * custom order has been established for this project, and every sortOrder
 * (0 included — it's simply rank #1) is trusted as-is. Only when EVERY shot
 * is 0 (nobody has ever reordered) does the whole set fall back to
 * shot-number order, matching useShots.ts's own "no real sortOrder" branch.
 */
function compareCustomOrder(hasCustomOrder: boolean): (a: ReportShot, b: ReportShot) => number {
  return (a, b) => {
    if (!hasCustomOrder) return compareShotNumber(a.number, b.number)
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  }
}

/** Primary comparator for a shot sort field (R2). Item-shape-local (needs GROUP_ORDER / STATUS_GROUP_ORDER).
 *  `hasCustomOrder` only matters for sortBy:"custom" — see compareCustomOrder. */
function shotPrimaryFor(
  sortBy: ReportSortField,
  hasCustomOrder: boolean,
): (a: ReportShot, b: ReportShot) => number {
  switch (sortBy) {
    case "shot-number":
      return (a, b) => compareShotNumber(a.number, b.number)
    case "talent":
      return (a, b) => compareText(a.talent[0]?.name, b.talent[0]?.name)
    case "status":
      return (a, b) => compareByOrder(STATUS_GROUP_ORDER, a.status, b.status)
    case "gender":
      return (a, b) => compareByOrder(GROUP_ORDER, a.gender, b.gender)
    case "custom":
      return compareCustomOrder(hasCustomOrder)
    default:
      // Runtime safety: exportReports writes schemaless (no rules validation), so a
      // persisted/hand-edited config could carry an out-of-union sortBy. Fall back to
      // the default field rather than returning undefined (which sortItemsStable would
      // call, throwing and killing the whole report render).
      return (a, b) => compareShotNumber(a.number, b.number)
  }
}

/** Fallback label for a real Lane doc whose `name` is empty/blank — distinct
 *  from NO_SET_GROUP_LABEL so a genuinely-named-but-blank Set never collides
 *  with (or gets mistaken for) the "no Set membership" bucket. Mirrors the
 *  shot list's own wording for the identical case (shotListFilters.ts). */
const UNNAMED_SET_LABEL = "Unnamed Set"

/**
 * groupBy:"scene" ("Set" in the UI): one group per Lane, ordered by
 * Lane.sceneNumber then Lane.sortOrder (the same two-key order the shot list
 * itself sorts scene groups by — see shotListFilters.ts's "scene" groupKey),
 * ties broken alphabetically on the lane name. A shot with no laneId, OR
 * whose laneId no longer resolves to a live Lane doc (an orphaned reference —
 * guards against a crash if a Set is deleted out from under an open report),
 * lands in a trailing "No set" bucket — always LAST regardless of sceneNumber.
 *
 * Guard: only treat a laneId as orphaned when lanes have actually loaded
 * (`laneById.size > 0`) — mirrors shotListFilters.ts's identical guard for
 * the shot list's own "scene" grouping. Without it, a lanes read that's
 * still loading (or that silently failed — useFirestoreCollection resolves
 * `loading:false`/`data:[]` on a snapshot error) would present an EMPTY
 * laneById, and every shot with a real laneId would incorrectly collapse
 * into "No set" instead of keeping its real Set grouping.
 */
function buildSceneGroups(
  shots: readonly ReportShot[],
  laneById: ReadonlyMap<string, Lane>,
): ReportGroup[] {
  const lanesLoaded = laneById.size > 0
  const byLane = new Map<string, ReportShot[]>()
  for (const shot of shots) {
    const isOrphan = lanesLoaded && shot.laneId != null && !laneById.has(shot.laneId)
    const key = shot.laneId != null && !isOrphan ? shot.laneId : NO_SET_GROUP_KEY
    const bucket = byLane.get(key)
    if (bucket) bucket.push(shot)
    else byLane.set(key, [shot])
  }

  const groups = [...byLane.entries()].map(([key, groupShots]): ReportGroup => {
    const lane = key === NO_SET_GROUP_KEY ? undefined : laneById.get(key)
    // A real (non-orphaned, non-"No set") lane ALWAYS gets a real label —
    // "Unnamed Set" for a blank `name`, never NO_SET_GROUP_LABEL, so it can't
    // be mistaken for (or sort like) the trailing "No set" bucket below.
    const label =
      key === NO_SET_GROUP_KEY ? NO_SET_GROUP_LABEL : lane?.name || UNNAMED_SET_LABEL
    return {
      key,
      label,
      count: groupShots.length,
      shots: groupShots,
    }
  })

  groups.sort((a, b) => {
    if (a.key === NO_SET_GROUP_KEY) return 1
    if (b.key === NO_SET_GROUP_KEY) return -1
    const laneA = laneById.get(a.key)
    const laneB = laneById.get(b.key)
    const sceneA = laneA?.sceneNumber ?? Number.POSITIVE_INFINITY
    const sceneB = laneB?.sceneNumber ?? Number.POSITIVE_INFINITY
    if (sceneA !== sceneB) return sceneA - sceneB
    const orderA = laneA?.sortOrder ?? 0
    const orderB = laneB?.sortOrder ?? 0
    if (orderA !== orderB) return orderA - orderB
    return compareText(a.label, b.label)
  })

  return groups
}

/** Derive the resolved report model from live export data + config. */
export function deriveShotReportModel(data: ExportData, config: ReportConfig): ReportModel {
  const familyById = new Map(data.productFamilies.map((f) => [f.id, f]))
  const talentById = new Map(data.talent.map((t) => [t.id, t]))
  const laneById = new Map((data.lanes ?? []).map((l) => [l.id, l]))
  const excluded = new Set(config.excludedShotIds)
  const primaryOnly = config.looksMode === "primary-only"

  // Unified filters (status + tag). resolveReportFilters folds a legacy
  // hiddenStatuses list into an equivalent status/notIn filter when `filters`
  // itself is absent (DEFAULT_REPORT_CONFIG and every pre-filters config take
  // this path, so output stays byte-identical). applyFilterConditions is the
  // SAME engine the shot list runs (filterEngine.ts) — AND-across-fields,
  // OR-within-a-field's values — reused verbatim, not reimplemented.
  const filters = resolveReportFilters(config)
  const notDeleted = data.shots.filter((s) => !s.deleted)
  const filteredShots = applyFilterConditions(notDeleted, filters, { familyById })

  const built: ReportShot[] = filteredShots.map((shot): ReportShot => {
    const sortedRawLooks = sortLooksByOrder(shot.looks ?? [])
    const looks = resolveLooks(shot, sortedRawLooks, familyById)
    // Gender resolves from ALL looks so grouping stays stable across looksMode.
    const gender = resolveShotGender(shot, looks)
    // primary-only is a display filter: keep only the primary look (looks[0]).
    const visibleLooks = primaryOnly ? looks.slice(0, 1) : looks
    const visibleRawLooks = primaryOnly ? sortedRawLooks.slice(0, 1) : sortedRawLooks
    // The resolved cover (hero-first, see resolveLooks) — additionalImages
    // excludes whichever image this actually is, by resolved identity.
    const coverIdentity = looks[0]?.image ?? null
    return {
      id: shot.id,
      number: shot.shotNumber ?? "",
      title: shot.title || "Untitled shot",
      colorway: shot.description ?? null,
      status: shot.status,
      gender,
      notes: shot.notesAddendum ?? shot.notes ?? null,
      talent: resolveTalent(shot, talentById),
      looks: visibleLooks,
      excluded: excluded.has(shot.id),
      // "References ready" = has a real uploaded reference, NOT the product-image plate fallback.
      hasImage: visibleLooks.some((l) => l.hasReference),
      sortOrder: shot.sortOrder,
      laneId: shot.laneId ?? null,
      additionalImages: resolveAdditionalImages(visibleRawLooks, coverIdentity),
      // ALWAYS computed (cheap, pure) regardless of config.showTags — that flag
      // only gates whether a recipe RENDERS the row. See resolveReportTagChips.
      tags: resolveReportTagChips(shot.tags),
    }
  })

  // Project-level "has a real custom order ever been established" — see
  // compareCustomOrder's docstring. Scoped to ALL non-deleted shots (not just
  // the report's own filtered subset), mirroring useShots.ts:33 exactly, so a
  // report's own Status/Tags filters can never flip this decision by
  // coincidentally excluding the shot that happens to carry the differentiator.
  const hasCustomOrder = notDeleted.some((s) => s.sortOrder !== 0)

  // R2 order-by. Absent sortBy → verbatim legacy comparator (flag-off byte-identical
  // by construction). Defined → the shared stable engine with the id tie-break.
  const shots: ReportShot[] =
    config.sortBy === undefined
      ? [...built].sort((a, b) => {
          const [ak, an, as] = shotNumberSortKey(a.number)
          const [bk, bn, bs] = shotNumberSortKey(b.number)
          return ak - bk || an - bn || as.localeCompare(bs)
        })
      : sortItemsStable(
          built,
          shotPrimaryFor(config.sortBy, hasCustomOrder),
          SHOT_TIEBREAK,
          config.sortDir ?? "asc",
        )

  const groups: ReportGroup[] =
    config.groupBy === "none"
      ? [{ key: "all", label: "All shots", count: shots.length, shots }]
      : config.groupBy === "status"
        ? orderedBuckets(
            shots,
            (s) => s.status,
            (a, b) => compareByOrder(STATUS_GROUP_ORDER, a, b),
            (k) => REPORT_STATUS_LABEL[k as ReportShotStatus],
          ).map(
            (b): ReportGroup => ({
              key: b.key as ReportShotStatus,
              label: b.label,
              count: b.count,
              shots: b.items,
            }),
          )
        : config.groupBy === "scene"
          ? buildSceneGroups(shots, laneById)
          : GROUP_ORDER.map((key): ReportGroup => {
              const inGroup = shots.filter((s) => s.gender === key)
              return { key, label: GROUP_LABEL[key], count: inGroup.length, shots: inGroup }
            }).filter((g) => g.count > 0)

  return {
    project: {
      name: data.project?.name ?? "Untitled project",
      client: titleCaseSlug(data.project?.clientId),
      shotCount: shots.length,
      dateRange: formatDateWindow(data.project?.shootDates),
    },
    groups,
    // The applied order/group/filters (absent sortBy → the legacy ascending
    // shot-number sort above). Set here so a recipe caption can never claim an
    // arrangement the shots don't actually have; flag-off this is always
    // {shot-number, asc, gender/none, no filters}, matching legacy exactly.
    order: {
      sortBy: config.sortBy ?? "shot-number",
      sortDir: config.sortDir ?? "asc",
      groupBy: config.groupBy,
      filterSummary: formatFilterSummary(filters),
    },
  }
}

/** True when at least one non-excluded shot exists — gates Export (a 0-page PDF is corrupt). */
export function hasAnyIncludedShot(model: ReportModel): boolean {
  return model.groups.some((g) => g.shots.some((s) => !s.excluded))
}
