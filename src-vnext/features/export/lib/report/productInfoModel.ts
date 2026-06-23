import type { ProductFamily, Shot } from "@/shared/types"
import { matchesHeroProductId } from "@/features/shots/lib/lookHeroes"
import type { ExportData } from "../../hooks/useExportData"
import {
  GROUP_LABEL,
  GROUP_ORDER,
  lookLabel,
  normalizeGender,
  pickProductImage,
  shotNumberSortKey,
  sortLooksByOrder,
  formatDateWindow,
} from "./reportModel"
import type { GenderKey, ReportShotStatus } from "./reportTypes"
import type {
  ProductInfoAppearance,
  ProductInfoConfig,
  ProductInfoEntry,
  ProductInfoGroup,
  ProductInfoModel,
} from "./productInfoTypes"

// Pure derivation: ExportData + ProductInfoConfig -> ProductInfoModel. No async,
// no image bytes (image fields are path/URL candidates resolved later). The
// single source both the DOM (ProductInfoReportView) and PDF renderers consume.

// Per-family aggregate accumulated during the inverse walk over non-deleted
// shots -> looks -> products. Mutated only inside the derivation (never an input).
// Mutable appearance accumulator: one per (shot, family); looks accrue as the
// family is found across the shot's looks. Frozen into ProductInfoAppearance at build.
interface AppearanceAcc {
  readonly number: string
  readonly looks: string[]
  readonly status: ReportShotStatus
}

interface FamilyAgg {
  readonly familyId: string
  image: string | null
  isHero: boolean
  sizePending: boolean
  readonly colours: string[]
  readonly sizes: string[]
  readonly appears: AppearanceAcc[]
}

function emptyAgg(familyId: string): FamilyAgg {
  return {
    familyId,
    image: null,
    isHero: false,
    sizePending: false,
    colours: [],
    sizes: [],
    appears: [],
  }
}

function pushUnique(list: string[], value: string | null | undefined): void {
  const v = value?.trim()
  if (v && !list.includes(v)) list.push(v)
}

// Walk every non-deleted shot's sorted looks and styled products, accumulating
// the rich (assignment-side) fields per family. Returns the agg map keyed by id.
function walkInUse(shots: readonly Shot[]): Map<string, FamilyAgg> {
  const byFamily = new Map<string, FamilyAgg>()
  for (const shot of shots) {
    if (shot.deleted) continue
    const looks = sortLooksByOrder(shot.looks ?? [])
    // One appearance per (shot, family); the looks the family is styled into this
    // shot accrue onto it, so two SKUs in one look (or one family across Primary +
    // Alt) count as a single shot, not several.
    const appearanceByFamily = new Map<string, AppearanceAcc>()
    looks.forEach((look, index) => {
      const label = lookLabel(look.label, index)
      const heroId = look.heroProductId
      for (const p of look.products) {
        const id = p.familyId
        if (!id) continue
        const agg = byFamily.get(id) ?? emptyAgg(id)
        if (!byFamily.has(id)) byFamily.set(id, agg)
        if (agg.image == null) agg.image = pickProductImage(p, undefined)
        if (p.isHero === true || (heroId != null && matchesHeroProductId(p, heroId))) agg.isHero = true
        if (p.sizeScope === "pending") agg.sizePending = true
        pushUnique(agg.colours, p.colourName ?? p.skuName ?? null)
        if (p.sizeScope !== "pending") pushUnique(agg.sizes, p.size ?? null)
        let appearance = appearanceByFamily.get(id)
        if (!appearance) {
          appearance = { number: shot.shotNumber ?? "", looks: [], status: shot.status }
          appearanceByFamily.set(id, appearance)
          agg.appears.push(appearance)
        }
        pushUnique(appearance.looks, label)
      }
    })
  }
  return byFamily
}

// Sort by shot number only; insertion order (look order within a shot) is
// preserved by the stable sort, so a shot's looks stay Primary-then-Alt.
function sortAppears(
  appears: readonly ProductInfoAppearance[],
): readonly ProductInfoAppearance[] {
  return [...appears].sort((a, b) => {
    const [ak, an, as] = shotNumberSortKey(a.number)
    const [bk, bn, bs] = shotNumberSortKey(b.number)
    return ak - bk || an - bn || as.localeCompare(bs)
  })
}

// Build a resolved entry from a family + (possibly absent) accumulated agg. The
// image falls back to family thumbnail/header when no styled assignment carried one.
function toEntry(
  family: ProductFamily,
  agg: FamilyAgg | undefined,
  excluded: ReadonlySet<string>,
): ProductInfoEntry {
  const gender = (normalizeGender(family.gender) ?? "?") as GenderKey
  const image =
    agg?.image ?? family.thumbnailImagePath ?? family.headerImagePath ?? null
  return {
    id: family.id,
    styleName: family.styleName,
    styleNumber: family.styleNumbers?.[0] ?? family.styleNumber ?? null,
    gender,
    genderLabel: gender === "?" ? null : GROUP_LABEL[gender],
    productType: family.productType ?? family.productSubcategory ?? null,
    image,
    colours: agg?.colours ?? [],
    sizes: agg?.sizes ?? [],
    sizePending: agg?.sizePending ?? false,
    isHero: agg?.isHero ?? false,
    excluded: excluded.has(family.id),
    appears: sortAppears(agg?.appears ?? []),
  }
}

function groupEntries(
  items: readonly ProductInfoEntry[],
  groupBy: ProductInfoConfig["groupBy"],
): readonly ProductInfoGroup[] {
  if (groupBy === "none") {
    return [{ key: "all", label: "All products", count: items.length, items }]
  }
  if (groupBy === "product-type") {
    const order: string[] = []
    const byType = new Map<string, ProductInfoEntry[]>()
    for (const item of items) {
      const key = item.productType ?? "Unspecified"
      const bucket = byType.get(key)
      if (bucket) bucket.push(item)
      else {
        byType.set(key, [item])
        order.push(key)
      }
    }
    return order
      .slice()
      .sort((a, b) => a.localeCompare(b))
      .map((key): ProductInfoGroup => {
        const inGroup = byType.get(key) ?? []
        return { key, label: key, count: inGroup.length, items: inGroup }
      })
  }
  return GROUP_ORDER.map((key): ProductInfoGroup => {
    const inGroup = items.filter((i) => i.gender === key)
    return { key, label: GROUP_LABEL[key], count: inGroup.length, items: inGroup }
  }).filter((g) => g.count > 0)
}

/** Derive the resolved product-info model from live export data + config. */
export function deriveProductInfoModel(
  data: ExportData,
  config: ProductInfoConfig,
): ProductInfoModel {
  const familyById = new Map(data.productFamilies.map((f) => [f.id, f]))
  const excluded = new Set(config.excludedFamilyIds)
  const aggByFamily = walkInUse(data.shots)

  // in-use: families styled into non-deleted shots, resolved against the library.
  // library: every non-deleted family (appears still derived from the same walk).
  const families: ProductFamily[] =
    config.productScope === "library"
      ? data.productFamilies.filter((f) => f.deleted !== true)
      : [...aggByFamily.keys()]
          .map((id) => familyById.get(id))
          .filter((f): f is ProductFamily => f != null && f.deleted !== true)

  const items = families
    .map((family) => toEntry(family, aggByFamily.get(family.id), excluded))
    .sort((a, b) => a.styleName.localeCompare(b.styleName))

  return {
    project: {
      name: data.project?.name ?? "Untitled project",
      client: data.project?.clientId ?? "",
      dateRange: formatDateWindow(data.project?.shootDates),
      familyCount: items.length,
    },
    groups: groupEntries(items, config.groupBy),
  }
}

/** Collect every unique image candidate referenced by the product-info model. */
export function collectProductInfoImageCandidates(
  model: ProductInfoModel,
): readonly string[] {
  const set = new Set<string>()
  for (const group of model.groups) {
    for (const item of group.items) if (item.image) set.add(item.image)
  }
  return [...set]
}
