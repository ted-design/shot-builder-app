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
  readonly category: string | null
  readonly includeArchived: boolean
  readonly includeDeleted: boolean
  readonly sort: ProductListSort
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase()
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

export function deriveProductCategories(families: ReadonlyArray<ProductFamily>): string[] {
  const set = new Set<string>()
  for (const f of families) {
    const cat = f.productSubcategory ?? f.productType ?? f.category
    if (typeof cat === "string" && cat.trim().length > 0) set.add(cat.trim())
  }
  return Array.from(set).sort(compareText)
}

export function filterAndSortProductFamilies(
  families: ReadonlyArray<ProductFamily>,
  filters: ProductListFilters,
): ProductFamily[] {
  const q = normalizeText(filters.query)
  const hasQuery = q.length > 0

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

    if (filters.category) {
      const cat = f.productSubcategory ?? f.productType ?? f.category ?? ""
      if (cat !== filters.category) return false
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

