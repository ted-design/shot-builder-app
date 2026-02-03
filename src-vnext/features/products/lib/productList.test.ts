import { describe, expect, it } from "vitest"
import { Timestamp } from "firebase/firestore"
import { filterAndSortProductFamilies, type ProductListFilters } from "@/features/products/lib/productList"
import type { ProductFamily } from "@/shared/types"

function fam(partial: Partial<ProductFamily> & Pick<ProductFamily, "id" | "styleName">): ProductFamily {
  return {
    id: partial.id,
    clientId: partial.clientId ?? "c1",
    styleName: partial.styleName,
    styleNumber: partial.styleNumber,
    archived: partial.archived,
    deleted: partial.deleted,
    status: partial.status,
    productType: partial.productType,
    productSubcategory: partial.productSubcategory,
    category: partial.category,
    skuCodes: partial.skuCodes,
    colorNames: partial.colorNames,
    sizeOptions: partial.sizeOptions,
    updatedAt: partial.updatedAt,
  }
}

const baseFilters: ProductListFilters = {
  query: "",
  status: "all",
  category: null,
  includeArchived: false,
  includeDeleted: false,
  sort: "styleNameAsc",
}

describe("filterAndSortProductFamilies", () => {
  it("excludes deleted and archived by default", () => {
    const families = [
      fam({ id: "a", styleName: "A" }),
      fam({ id: "b", styleName: "B", archived: true }),
      fam({ id: "c", styleName: "C", deleted: true }),
    ]
    const result = filterAndSortProductFamilies(families, baseFilters)
    expect(result.map((f) => f.id)).toEqual(["a"])
  })

  it("filters by status discontinued", () => {
    const families = [
      fam({ id: "a", styleName: "A", status: "active" }),
      fam({ id: "b", styleName: "B", status: "discontinued" }),
    ]
    const result = filterAndSortProductFamilies(families, { ...baseFilters, status: "discontinued" })
    expect(result.map((f) => f.id)).toEqual(["b"])
  })

  it("searches across styleName, skuCodes and colorNames", () => {
    const families = [
      fam({ id: "a", styleName: "Merino Henley", skuCodes: ["SKU-123"], colorNames: ["Black"] }),
      fam({ id: "b", styleName: "Cotton Tee", skuCodes: ["SKU-999"], colorNames: ["Bone"] }),
    ]
    const bySku = filterAndSortProductFamilies(families, { ...baseFilters, query: "123" })
    expect(bySku.map((f) => f.id)).toEqual(["a"])
    const byColor = filterAndSortProductFamilies(families, { ...baseFilters, query: "black" })
    expect(byColor.map((f) => f.id)).toEqual(["a"])
  })

  it("sorts by updatedAt desc with stable fallback", () => {
    const families = [
      fam({ id: "a", styleName: "Alpha", updatedAt: Timestamp.fromMillis(10) }),
      fam({ id: "b", styleName: "Beta", updatedAt: Timestamp.fromMillis(20) }),
      fam({ id: "c", styleName: "Gamma" }),
    ]
    const result = filterAndSortProductFamilies(families, { ...baseFilters, includeArchived: true, sort: "updatedDesc" })
    expect(result.map((f) => f.id)).toEqual(["b", "a", "c"])
  })
})

