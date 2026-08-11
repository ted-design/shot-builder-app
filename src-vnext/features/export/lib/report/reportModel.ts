import type {
  ProductAssignment,
  ProductFamily,
  Shot,
  ShotLook,
  SizeScope,
  TalentRecord,
} from "@/shared/types"
import type { ExportData } from "../../hooks/useExportData"
import { humanizeLabel } from "@/shared/lib/textUtils"
import {
  REPORT_STATUS_LABEL,
  type GenderKey,
  type ReportConfig,
  type ReportGroup,
  type ReportLook,
  type ReportModel,
  type ReportProduct,
  type ReportShot,
  type ReportShotStatus,
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

function resolveLooks(
  shot: Shot,
  familyById: ReadonlyMap<string, ProductFamily>,
): readonly ReportLook[] {
  const looks = sortLooksByOrder(shot.looks ?? [])
  return looks.map((look, i): ReportLook => {
    const label = lookLabel(look.label, i)
    const isAlt = i > 0 || /^alt/i.test(label)
    const products = resolveProducts(look.products, look.heroProductId, familyById)
    // The PRIMARY look's plate falls back to a product image (hero first) when there's
    // no uploaded reference, so pre-shoot decks still show a thumbnail. Alt looks stay
    // reference-only (they keep their "no reference" slot rather than a product stand-in).
    // `hasReference` always tracks the real reference (the "references ready" counter
    // must not count the product fallback).
    const reference = pickLookDisplayImage(look)
    const productFallback = isAlt
      ? null
      : products.find((p) => p.isHero)?.img ?? products.find((p) => p.img)?.img ?? null
    const image = reference ?? productFallback
    return { id: look.id, label, isAlt, image, hasReference: reference != null, products }
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
export const STATUS_GROUP_ORDER: readonly ReportShotStatus[] = [
  "todo",
  "in_progress",
  "on_hold",
  "complete",
]

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

/** Primary comparator for a shot sort field (R2). Item-shape-local (needs GROUP_ORDER / STATUS_GROUP_ORDER). */
function shotPrimaryFor(sortBy: ReportSortField): (a: ReportShot, b: ReportShot) => number {
  switch (sortBy) {
    case "shot-number":
      return (a, b) => compareShotNumber(a.number, b.number)
    case "talent":
      return (a, b) => compareText(a.talent[0]?.name, b.talent[0]?.name)
    case "status":
      return (a, b) => compareByOrder(STATUS_GROUP_ORDER, a.status, b.status)
    case "gender":
      return (a, b) => compareByOrder(GROUP_ORDER, a.gender, b.gender)
    default:
      // Runtime safety: exportReports writes schemaless (no rules validation), so a
      // persisted/hand-edited config could carry an out-of-union sortBy. Fall back to
      // the default field rather than returning undefined (which sortItemsStable would
      // call, throwing and killing the whole report render).
      return (a, b) => compareShotNumber(a.number, b.number)
  }
}

/** Derive the resolved report model from live export data + config. */
export function deriveShotReportModel(data: ExportData, config: ReportConfig): ReportModel {
  const familyById = new Map(data.productFamilies.map((f) => [f.id, f]))
  const talentById = new Map(data.talent.map((t) => [t.id, t]))
  const excluded = new Set(config.excludedShotIds)
  // R3: statuses to hide entirely (undefined on pre-R3 blobs -> empty set -> no-op).
  const hidden = new Set(config.hiddenStatuses ?? [])
  const primaryOnly = config.looksMode === "primary-only"

  const built: ReportShot[] = data.shots
    .filter((s) => !s.deleted && !hidden.has(s.status))
    .map((shot): ReportShot => {
      const looks = resolveLooks(shot, familyById)
      // Gender resolves from ALL looks so grouping stays stable across looksMode.
      const gender = resolveShotGender(shot, looks)
      // primary-only is a display filter: keep only the primary look (looks[0]).
      const visibleLooks = primaryOnly ? looks.slice(0, 1) : looks
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
      }
    })

  // R2 order-by. Absent sortBy → verbatim legacy comparator (flag-off byte-identical
  // by construction). Defined → the shared stable engine with the id tie-break.
  const shots: ReportShot[] =
    config.sortBy === undefined
      ? [...built].sort((a, b) => {
          const [ak, an, as] = shotNumberSortKey(a.number)
          const [bk, bn, bs] = shotNumberSortKey(b.number)
          return ak - bk || an - bn || as.localeCompare(bs)
        })
      : sortItemsStable(built, shotPrimaryFor(config.sortBy), SHOT_TIEBREAK, config.sortDir ?? "asc")

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
    // The applied order (absent sortBy → the legacy ascending shot-number sort
    // above). Set here so a recipe caption can never claim an order the shots
    // don't have; flag-off this is always {shot-number, asc}, matching legacy.
    order: { sortBy: config.sortBy ?? "shot-number", sortDir: config.sortDir ?? "asc" },
  }
}

/** True when at least one non-excluded shot exists — gates Export (a 0-page PDF is corrupt). */
export function hasAnyIncludedShot(model: ReportModel): boolean {
  return model.groups.some((g) => g.shots.some((s) => !s.excluded))
}
