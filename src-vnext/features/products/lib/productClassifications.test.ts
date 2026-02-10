import { describe, expect, it } from "vitest"
import type { ProductClassification, ProductFamily } from "@/shared/types"
import {
  buildProductClassificationId,
  deriveProductClassificationScaffold,
  humanizeClassificationKey,
  normalizeClassificationGender,
  slugifyClassificationKey,
} from "@/features/products/lib/productClassifications"

function fam(partial: Partial<ProductFamily>): ProductFamily {
  return {
    id: partial.id ?? "fam-1",
    styleName: partial.styleName ?? "Test",
    clientId: partial.clientId ?? "client-1",
    gender: partial.gender ?? null,
    productType: partial.productType,
    productSubcategory: partial.productSubcategory,
    category: partial.category,
  }
}

function classification(partial: Partial<ProductClassification>): ProductClassification {
  return {
    id: partial.id ?? "men__tops",
    gender: partial.gender ?? "men",
    typeKey: partial.typeKey ?? "tops",
    typeLabel: partial.typeLabel ?? "Tops",
    subcategoryKey: partial.subcategoryKey ?? null,
    subcategoryLabel: partial.subcategoryLabel ?? null,
    archived: partial.archived ?? false,
  }
}

describe("productClassifications helpers", () => {
  it("normalizes genders and humanizes keys", () => {
    expect(normalizeClassificationGender("Men's")).toBe("men")
    expect(normalizeClassificationGender("WOMENS")).toBe("women")
    expect(humanizeClassificationKey("hoodies-sweaters")).toBe("Hoodies Sweaters")
  })

  it("builds deterministic classification ids", () => {
    expect(
      buildProductClassificationId({
        gender: "men",
        typeKey: "tops",
      }),
    ).toBe("men__tops")
    expect(
      buildProductClassificationId({
        gender: "women",
        typeKey: "tops",
        subcategoryKey: "tshirts",
      }),
    ).toBe("women__tops__tshirts")
  })

  it("derives scaffold from product families when managed classifications are empty", () => {
    const result = deriveProductClassificationScaffold({
      classifications: [],
      families: [
        fam({ id: "a", gender: "men", productType: "tops", productSubcategory: "hoodies-sweaters" }),
        fam({ id: "b", gender: "women", productType: "tops", productSubcategory: "tshirts" }),
      ],
    })

    expect(result.genders.map((g) => g.key)).toEqual(["men", "women"])
    expect(result.typesByGender.men?.map((t) => t.key)).toEqual(["tops"])
    expect(result.subcategoriesByGenderAndType.men?.tops?.map((s) => s.key)).toEqual(["hoodies-sweaters"])
  })

  it("prefers managed classification labels and ignores archived entries", () => {
    const result = deriveProductClassificationScaffold({
      families: [fam({ gender: "men", productType: "tops", productSubcategory: "tshirts" })],
      classifications: [
        classification({
          id: "men__tops",
          gender: "men",
          typeKey: "tops",
          typeLabel: "Upperwear",
        }),
        classification({
          id: "men__tops__tshirts",
          gender: "men",
          typeKey: "tops",
          typeLabel: "Upperwear",
          subcategoryKey: "tshirts",
          subcategoryLabel: "T-Shirts",
        }),
        classification({
          id: "men__tops__archived",
          gender: "men",
          typeKey: "tops",
          typeLabel: "Upperwear",
          subcategoryKey: "archived",
          subcategoryLabel: "Archived",
          archived: true,
        }),
      ],
    })

    expect(result.typesByGender.men?.[0]?.label).toBe("Upperwear")
    expect(result.subcategoriesByGenderAndType.men?.tops?.map((s) => s.key)).toEqual(["tshirts"])
    expect(result.subcategoriesByGenderAndType.men?.tops?.[0]?.label).toBe("T-Shirts")
  })

  it("slugifies labels into safe keys", () => {
    expect(slugifyClassificationKey("Hoodies & Sweaters")).toBe("hoodies-sweaters")
    expect(slugifyClassificationKey("  ")).toBe("")
  })
})
