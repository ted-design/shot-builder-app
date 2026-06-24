import type {
  ProductAssignment,
  ProductFamily,
  Shot,
  ShotLook,
  SizeScope,
  TalentRecord,
} from "@/shared/types"
import type { ExportData } from "../../hooks/useExportData"
import {
  type GenderKey,
  type ReportConfig,
  type ReportGroup,
  type ReportLook,
  type ReportModel,
  type ReportProduct,
  type ReportShot,
  type ReportTalent,
} from "./reportTypes"

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
    const productFallback =
      i === 0 ? products.find((p) => p.isHero)?.img ?? products.find((p) => p.img)?.img ?? null : null
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

/** Sort key for shot numbers: numerics first (ascending), then non-numerics alpha. */
export function shotNumberSortKey(n: string): [number, number, string] {
  const num = Number.parseInt(n, 10)
  return Number.isNaN(num) ? [1, 0, n] : [0, num, n]
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

export const GROUP_ORDER: readonly GenderKey[] = ["W", "M", "Mixed", "?"]
export const GROUP_LABEL: Record<GenderKey, string> = {
  W: "Women",
  M: "Men",
  Mixed: "Mixed",
  "?": "Unresolved",
}

/** Derive the resolved report model from live export data + config. */
export function deriveShotReportModel(data: ExportData, config: ReportConfig): ReportModel {
  const familyById = new Map(data.productFamilies.map((f) => [f.id, f]))
  const talentById = new Map(data.talent.map((t) => [t.id, t]))
  const excluded = new Set(config.excludedShotIds)
  const primaryOnly = config.looksMode === "primary-only"

  const shots: ReportShot[] = data.shots
    .filter((s) => !s.deleted)
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
    .sort((a, b) => {
      const [ak, an, as] = shotNumberSortKey(a.number)
      const [bk, bn, bs] = shotNumberSortKey(b.number)
      return ak - bk || an - bn || as.localeCompare(bs)
    })

  const groups: ReportGroup[] =
    config.groupBy === "none"
      ? [{ key: "all", label: "All shots", count: shots.length, shots }]
      : GROUP_ORDER.map((key): ReportGroup => {
          const inGroup = shots.filter((s) => s.gender === key)
          return { key, label: GROUP_LABEL[key], count: inGroup.length, shots: inGroup }
        }).filter((g) => g.count > 0)

  return {
    project: {
      name: data.project?.name ?? "Untitled project",
      client: data.project?.clientId ?? "",
      shotCount: shots.length,
      dateRange: formatDateWindow(data.project?.shootDates),
    },
    groups,
  }
}
