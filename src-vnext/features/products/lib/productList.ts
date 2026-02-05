import type { ProductFamily } from "@/shared/types"

export type ProductListStatusFilter = "all" | "active" | "discontinued"

export type ProductListSort =
  | "styleNameAsc"
  | "styleNameDesc"
  | "styleNumberAsc"
  | "styleNumberDesc"
  | "updatedDesc"

export interface ProductListFilters {
  readonly query: string
  readonly status: ProductListStatusFilter
  readonly gender: string | null
  readonly productType: string | null
  readonly productSubcategory: string | null
  /** Back-compat: older list URLs used a single `cat` param. Prefer `gender`/`productType`/`productSubcategory`. */
  readonly category?: string | null
  readonly includeArchived: boolean
  readonly includeDeleted: boolean
  readonly sort: ProductListSort
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase()
}

function normalizeKey(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null
  const next = value.trim().toLowerCase()
  return next.length > 0 ? next : null
}

function asArray(value: ReadonlyArray<string> | undefined): ReadonlyArray<string> {
  return Array.isArray(value) ? value : []
}

function familySearchText(f: ProductFamily): string {
  const parts = [
    f.styleName,
    f.styleNumber ?? "",
    f.previousStyleNumber ?? "",
    f.gender ?? "",
    f.productType ?? "",
    f.productSubcategory ?? "",
    f.category ?? "",
    ...asArray(f.skuCodes),
    ...asArray(f.colorNames),
    ...asArray(f.sizeOptions),
  ]
  return normalizeText(parts.filter(Boolean).join(" "))
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base", numeric: true })
}

export interface ProductScaffoldOptions {
  readonly genders: ReadonlyArray<{ readonly key: string; readonly label: string }>
  readonly typesByGender: Record<string, ReadonlyArray<{ readonly key: string; readonly label: string }>>
  readonly subcategoriesByGenderAndType: Record<string, Record<string, ReadonlyArray<{ readonly key: string; readonly label: string }>>>
}

function titleize(key: string): string {
  const cleaned = key.replace(/[_-]+/g, " ").trim()
  if (!cleaned) return key
  return cleaned
    .split(/\s+/g)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

function normalizeGenderKey(value: string | null | undefined): string | null {
  const key = normalizeKey(value)
  if (!key) return null
  if (key === "mens" || key === "men's") return "men"
  if (key === "womens" || key === "women's") return "women"
  return key
}

function pushOption(
  map: Map<string, string>,
  key: string | null,
  labelFallback: (key: string) => string,
) {
  if (!key) return
  if (!map.has(key)) map.set(key, labelFallback(key))
}

export function deriveProductScaffoldOptions(families: ReadonlyArray<ProductFamily>): ProductScaffoldOptions {
  const genderLabels = new Map<string, string>()
  const typeLabelsByGender = new Map<string, Map<string, string>>()
  const subLabelsByGenderType = new Map<string, Map<string, Map<string, string>>>()

  for (const f of families) {
    const genderKey = normalizeGenderKey(f.gender ?? null)
    const typeKey = normalizeKey(f.productType)
    const subKey = normalizeKey(f.productSubcategory)

    if (genderKey) {
      pushOption(genderLabels, genderKey, titleize)
    }

    if (genderKey && typeKey) {
      const typesForGender = typeLabelsByGender.get(genderKey) ?? new Map<string, string>()
      pushOption(typesForGender, typeKey, titleize)
      typeLabelsByGender.set(genderKey, typesForGender)
    }

    if (genderKey && typeKey && subKey) {
      const types = subLabelsByGenderType.get(genderKey) ?? new Map<string, Map<string, string>>()
      const subsForType = types.get(typeKey) ?? new Map<string, string>()
      pushOption(subsForType, subKey, titleize)
      types.set(typeKey, subsForType)
      subLabelsByGenderType.set(genderKey, types)
    }
  }

  const genders = Array.from(genderLabels.entries())
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => compareText(a.label, b.label))

  const typesByGender: Record<string, ReadonlyArray<{ readonly key: string; readonly label: string }>> = {}
  for (const [genderKey, typeLabels] of typeLabelsByGender.entries()) {
    typesByGender[genderKey] = Array.from(typeLabels.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => compareText(a.label, b.label))
  }

  const subcategoriesByGenderAndType: Record<string, Record<string, ReadonlyArray<{ readonly key: string; readonly label: string }>>> = {}
  for (const [genderKey, types] of subLabelsByGenderType.entries()) {
    const out: Record<string, ReadonlyArray<{ readonly key: string; readonly label: string }>> = {}
    for (const [typeKey, subs] of types.entries()) {
      out[typeKey] = Array.from(subs.entries())
        .map(([key, label]) => ({ key, label }))
        .sort((a, b) => compareText(a.label, b.label))
    }
    subcategoriesByGenderAndType[genderKey] = out
  }

  return { genders, typesByGender, subcategoriesByGenderAndType }
}

export function filterAndSortProductFamilies(
  families: ReadonlyArray<ProductFamily>,
  filters: ProductListFilters,
): ProductFamily[] {
  const q = normalizeText(filters.query)
  const hasQuery = q.length > 0
  const genderKey = normalizeGenderKey(filters.gender)
  const typeKey = normalizeKey(filters.productType)
  const subKey = normalizeKey(filters.productSubcategory ?? filters.category ?? null)

  const filtered = families.filter((f) => {
    const isDeleted = f.deleted === true
    if (!filters.includeDeleted && isDeleted) return false

    const isArchived = f.archived === true
    if (!filters.includeArchived && isArchived) return false

    if (filters.status !== "all") {
      const status = (f.status ?? "active").toLowerCase()
      if (filters.status === "active" && status === "discontinued") return false
      if (filters.status === "discontinued" && status !== "discontinued") return false
    }

    if (genderKey) {
      const famKey = normalizeGenderKey(f.gender ?? null)
      if (famKey !== genderKey) return false
    }

    if (typeKey) {
      const famKey = normalizeKey(f.productType)
      if (famKey !== typeKey) return false
    }

    if (subKey) {
      const famKey = normalizeKey(f.productSubcategory ?? f.category ?? null)
      if (famKey !== subKey) return false
    }

    if (hasQuery) {
      return familySearchText(f).includes(q)
    }

    return true
  })

  const sorted = [...filtered]
  sorted.sort((a, b) => {
    switch (filters.sort) {
      case "styleNameAsc":
        return compareText(a.styleName, b.styleName)
      case "styleNameDesc":
        return compareText(b.styleName, a.styleName)
      case "styleNumberAsc":
        return compareText(a.styleNumber ?? "", b.styleNumber ?? "")
      case "styleNumberDesc":
        return compareText(b.styleNumber ?? "", a.styleNumber ?? "")
      case "updatedDesc": {
        const aMs = a.updatedAt?.toMillis?.() ?? 0
        const bMs = b.updatedAt?.toMillis?.() ?? 0
        if (aMs !== bMs) return bMs - aMs
        return compareText(a.styleName, b.styleName)
      }
    }
  })

  return sorted
}
