import { describe, expect, it } from "vitest"
import { Timestamp } from "firebase/firestore"
import { deriveProductScaffoldOptions, filterAndSortProductFamilies, type ProductListFilters } from "@/features/products/lib/productList"
import type { ProductFamily } from "@/shared/types"

function fam(partial: Partial<ProductFamily> & Pick<ProductFamily, "id" | "styleName">): ProductFamily {
  return {
    id: partial.id,
    clientId: partial.clientId ?? "c1",
    styleName: partial.styleName,
    styleNumber: partial.styleNumber,
    gender: partial.gender,
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
  gender: null,
  productType: null,
  productSubcategory: null,
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

  it("filters by gender/type/subcategory scaffolding keys", () => {
    const families = [
      fam({ id: "a", styleName: "A", gender: "men", productType: "tops", productSubcategory: "t-shirt" }),
      fam({ id: "b", styleName: "B", gender: "women", productType: "tops", productSubcategory: "t-shirt" }),
      fam({ id: "c", styleName: "C", gender: "men", productType: "bottoms", productSubcategory: "jeans" }),
    ]

    const byGender = filterAndSortProductFamilies(families, { ...baseFilters, gender: "men", includeArchived: true })
    expect(byGender.map((f) => f.id)).toEqual(["a", "c"])

    const byType = filterAndSortProductFamilies(families, { ...baseFilters, gender: "men", productType: "tops", includeArchived: true })
    expect(byType.map((f) => f.id)).toEqual(["a"])

    const bySub = filterAndSortProductFamilies(families, { ...baseFilters, gender: "men", productType: "tops", productSubcategory: "t-shirt", includeArchived: true })
    expect(bySub.map((f) => f.id)).toEqual(["a"])
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

describe("deriveProductScaffoldOptions", () => {
  it("derives gender/type/subcategory option trees", () => {
    const families = [
      fam({ id: "a", styleName: "A", gender: "men", productType: "tops", productSubcategory: "t-shirt" }),
      fam({ id: "b", styleName: "B", gender: "men", productType: "tops", productSubcategory: "sweater" }),
      fam({ id: "c", styleName: "C", gender: "women", productType: "tops", productSubcategory: "t-shirt" }),
    ]

    const result = deriveProductScaffoldOptions(families)
    expect(result.genders.map((g) => g.key)).toEqual(["men", "women"])
    expect(result.typesByGender.men?.map((t) => t.key) ?? []).toEqual(["tops"])
    expect(result.subcategoriesByGenderAndType.men?.tops?.map((s) => s.key) ?? []).toEqual(["sweater", "t-shirt"])
  })
})
