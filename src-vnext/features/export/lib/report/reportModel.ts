import type {
  ProductAssignment,
  ProductFamily,
  Shot,
  ShotLook,
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

function pickProductImage(
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

/** Label looks: explicit label, else Primary for the first by order, else "Alt N". */
function resolveLooks(
  shot: Shot,
  familyById: ReadonlyMap<string, ProductFamily>,
): readonly ReportLook[] {
  const looks = [...(shot.looks ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  return looks.map((look, i): ReportLook => {
    const rawLabel = look.label?.trim()
    const label = rawLabel && rawLabel.length > 0 ? rawLabel : i === 0 ? "Primary" : `Alt ${i}`
    const isAlt = i > 0 || /^alt/i.test(label)
    return {
      id: look.id,
      label,
      isAlt,
      image: pickLookDisplayImage(look),
      products: resolveProducts(look.products, look.heroProductId, familyById),
    }
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

function shotNumberSortKey(n: string): [number, number, string] {
  const num = Number.parseInt(n, 10)
  return Number.isNaN(num) ? [1, 0, n] : [0, num, n]
}

const GROUP_ORDER: readonly GenderKey[] = ["W", "M", "Mixed", "?"]
const GROUP_LABEL: Record<GenderKey, string> = {
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

  const shots: ReportShot[] = data.shots
    .filter((s) => !s.deleted)
    .map((shot): ReportShot => {
      const looks = resolveLooks(shot, familyById)
      const gender = resolveShotGender(shot, looks)
      return {
        id: shot.id,
        number: shot.shotNumber ?? "",
        title: shot.title || "Untitled shot",
        colorway: shot.description ?? null,
        status: shot.status,
        gender,
        notes: shot.notesAddendum ?? shot.notes ?? null,
        talent: resolveTalent(shot, talentById),
        looks,
        excluded: excluded.has(shot.id),
        hasImage: looks.some((l) => l.image != null),
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
    },
    groups,
  }
}
