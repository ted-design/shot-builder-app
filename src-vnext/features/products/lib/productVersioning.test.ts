import { describe, expect, it } from "vitest"
import { Timestamp } from "firebase/firestore"
import type { ProductFamily, ProductSku } from "@/shared/types"
import {
  buildFamilySnapshot,
  buildSkuSnapshot,
  getChangedFamilyFields,
  getChangedSkuFields,
  buildFieldChanges,
  humanizeFieldLabel,
} from "./productVersioning"

function mockTimestamp(ms: number): Timestamp {
  return {
    toDate: () => new Date(ms),
    toMillis: () => ms,
    seconds: Math.floor(ms / 1000),
    nanoseconds: 0,
    isEqual: () => false,
    valueOf: () => "",
  } as unknown as Timestamp
}

const baseFamily: ProductFamily = {
  id: "fam-1",
  clientId: "c1",
  styleName: "Polo Classic",
  styleNumber: "PC-001",
  previousStyleNumber: null as unknown as undefined,
  gender: "Men",
  productType: "Tops",
  productSubcategory: "Polo",
  launchDate: mockTimestamp(1700000000000),
  notes: "Premium cotton blend",
  status: "active",
  archived: false,
}

const baseSku: ProductSku = {
  id: "sku-1",
  name: "Black",
  colorName: "Black",
  skuCode: "BLK-001",
  sizes: ["S", "M", "L"],
  status: "active",
  archived: false,
  launchDate: null as unknown as undefined,
  assetRequirements: null as unknown as undefined,
  imagePath: "products/fam-1/skus/sku-1/image.webp",
}

describe("humanizeFieldLabel", () => {
  it("maps known fields to display names", () => {
    expect(humanizeFieldLabel("styleName")).toBe("Style Name")
    expect(humanizeFieldLabel("launchDate")).toBe("Launch Date")
    expect(humanizeFieldLabel("skuCode")).toBe("SKU Code")
    expect(humanizeFieldLabel("colorName")).toBe("Color Name")
    expect(humanizeFieldLabel("productSubcategory")).toBe("Subcategory")
    expect(humanizeFieldLabel("assetRequirements")).toBe("Asset Requirements")
  })

  it("converts camelCase to spaced words for unknown fields", () => {
    const result = humanizeFieldLabel("someNewField")
    expect(result).toContain("New")
    expect(result).toContain("Field")
  })
})

describe("buildFamilySnapshot", () => {
  it("extracts versioned fields from a family", () => {
    const snapshot = buildFamilySnapshot(baseFamily)
    expect(snapshot.styleName).toBe("Polo Classic")
    expect(snapshot.styleNumber).toBe("PC-001")
    expect(snapshot.gender).toBe("Men")
    expect(snapshot.productType).toBe("Tops")
    expect(snapshot.productSubcategory).toBe("Polo")
    expect(snapshot.status).toBe("active")
    expect(snapshot.archived).toBe(false)
    expect(snapshot.notes).toBe("Premium cotton blend")
    expect((snapshot.launchDate as Timestamp).toMillis()).toBe(1700000000000)
  })

  it("excludes non-versioned fields", () => {
    const snapshot = buildFamilySnapshot(baseFamily)
    expect(snapshot).not.toHaveProperty("id")
    expect(snapshot).not.toHaveProperty("clientId")
    expect(snapshot).not.toHaveProperty("createdAt")
    expect(snapshot).not.toHaveProperty("updatedAt")
    expect(snapshot).not.toHaveProperty("createdBy")
    expect(snapshot).not.toHaveProperty("skuCount")
  })

  it("applies patch overrides", () => {
    const snapshot = buildFamilySnapshot(baseFamily, { styleName: "Polo V2" })
    expect(snapshot.styleName).toBe("Polo V2")
    expect(snapshot.gender).toBe("Men")
  })

  it("normalizes undefined to null", () => {
    const family = { ...baseFamily, notes: undefined } as unknown as ProductFamily
    const snapshot = buildFamilySnapshot(family)
    expect(snapshot.notes).toBeNull()
  })
})

describe("buildSkuSnapshot", () => {
  it("extracts versioned fields from a SKU", () => {
    const snapshot = buildSkuSnapshot(baseSku)
    expect(snapshot.colorName).toBe("Black")
    expect(snapshot.skuCode).toBe("BLK-001")
    expect(snapshot.sizes).toEqual(["S", "M", "L"])
    expect(snapshot.status).toBe("active")
    expect(snapshot.archived).toBe(false)
    expect(snapshot.imagePath).toBe("products/fam-1/skus/sku-1/image.webp")
  })

  it("excludes non-versioned fields", () => {
    const snapshot = buildSkuSnapshot(baseSku)
    expect(snapshot).not.toHaveProperty("id")
    expect(snapshot).not.toHaveProperty("createdAt")
    expect(snapshot).not.toHaveProperty("updatedAt")
    expect(snapshot).not.toHaveProperty("createdBy")
  })

  it("applies patch overrides", () => {
    const snapshot = buildSkuSnapshot(baseSku, { colorName: "Navy" })
    expect(snapshot.colorName).toBe("Navy")
    expect(snapshot.skuCode).toBe("BLK-001")
  })
})

describe("getChangedFamilyFields", () => {
  it("returns empty array when nothing changed", () => {
    const prev = buildFamilySnapshot(baseFamily)
    const curr = buildFamilySnapshot(baseFamily)
    expect(getChangedFamilyFields(prev, curr)).toEqual([])
  })

  it("detects string field changes", () => {
    const prev = buildFamilySnapshot(baseFamily)
    const curr = buildFamilySnapshot(baseFamily, { styleName: "Polo V2" })
    expect(getChangedFamilyFields(prev, curr)).toContain("styleName")
  })

  it("detects boolean changes", () => {
    const prev = buildFamilySnapshot(baseFamily)
    const curr = buildFamilySnapshot(baseFamily, { archived: true })
    expect(getChangedFamilyFields(prev, curr)).toContain("archived")
  })

  it("detects timestamp changes", () => {
    const prev = buildFamilySnapshot(baseFamily)
    const newTs = mockTimestamp(1800000000000)
    const curr = buildFamilySnapshot(baseFamily, { launchDate: newTs })
    expect(getChangedFamilyFields(prev, curr)).toContain("launchDate")
  })

  it("handles null to value transition", () => {
    const family = { ...baseFamily, launchDate: null } as unknown as ProductFamily
    const prev = buildFamilySnapshot(family)
    const curr = buildFamilySnapshot(family, { launchDate: mockTimestamp(1700000000000) })
    expect(getChangedFamilyFields(prev, curr)).toContain("launchDate")
  })

  it("handles value to null transition", () => {
    const prev = buildFamilySnapshot(baseFamily)
    const curr = buildFamilySnapshot(baseFamily, { launchDate: null })
    expect(getChangedFamilyFields(prev, curr)).toContain("launchDate")
  })

  it("returns empty array for null previous", () => {
    const curr = buildFamilySnapshot(baseFamily)
    expect(getChangedFamilyFields(null, curr)).toEqual([])
  })

  it("ignores whitespace-only notes changes", () => {
    const prev = buildFamilySnapshot(baseFamily)
    const curr = buildFamilySnapshot(baseFamily, { notes: "Premium cotton blend " })
    expect(getChangedFamilyFields(prev, curr)).not.toContain("notes")
  })

  it("detects meaningful notes changes", () => {
    const prev = buildFamilySnapshot(baseFamily)
    const curr = buildFamilySnapshot(baseFamily, { notes: "Different notes" })
    expect(getChangedFamilyFields(prev, curr)).toContain("notes")
  })
})

describe("getChangedSkuFields", () => {
  it("returns empty when nothing changed", () => {
    const prev = buildSkuSnapshot(baseSku)
    const curr = buildSkuSnapshot(baseSku)
    expect(getChangedSkuFields(prev, curr)).toEqual([])
  })

  it("detects array changes", () => {
    const prev = buildSkuSnapshot(baseSku)
    const curr = buildSkuSnapshot(baseSku, { sizes: ["S", "M", "L", "XL"] })
    expect(getChangedSkuFields(prev, curr)).toContain("sizes")
  })

  it("detects launch date addition", () => {
    const prev = buildSkuSnapshot(baseSku)
    const curr = buildSkuSnapshot(baseSku, { launchDate: mockTimestamp(1700000000000) })
    expect(getChangedSkuFields(prev, curr)).toContain("launchDate")
  })
})

describe("buildFieldChanges", () => {
  it("returns empty array for null previous", () => {
    const curr = buildFamilySnapshot(baseFamily)
    const changes = buildFieldChanges(null, curr, ["styleName"])
    expect(changes).toEqual([])
  })

  it("returns structured before-after changes", () => {
    const prev = buildFamilySnapshot(baseFamily)
    const curr = buildFamilySnapshot(baseFamily, { styleName: "Polo V2" })
    const changes = buildFieldChanges(prev, curr, ["styleName", "gender"])

    expect(changes).toHaveLength(1)
    expect(changes[0]!.field).toBe("styleName")
    expect(changes[0]!.label).toBe("Style Name")
    expect(changes[0]!.previousValue).toBe("Polo Classic")
    expect(changes[0]!.currentValue).toBe("Polo V2")
  })

  it("prefixes labels with SKU name", () => {
    const prev = buildSkuSnapshot(baseSku)
    const curr = buildSkuSnapshot(baseSku, { skuCode: "BLK-002" })
    const changes = buildFieldChanges(prev, curr, ["skuCode"], "Black")

    expect(changes).toHaveLength(1)
    expect(changes[0]!.label).toBe("Black: SKU Code")
  })

  it("skips unchanged fields", () => {
    const prev = buildFamilySnapshot(baseFamily)
    const curr = buildFamilySnapshot(baseFamily)
    const changes = buildFieldChanges(prev, curr, ["styleName", "gender", "status"])
    expect(changes).toHaveLength(0)
  })

  it("handles null to value transitions", () => {
    const prev = { ...buildFamilySnapshot(baseFamily), launchDate: null }
    const newTs = mockTimestamp(1700000000000)
    const curr = { ...buildFamilySnapshot(baseFamily), launchDate: newTs }
    const changes = buildFieldChanges(prev, curr, ["launchDate"])

    expect(changes).toHaveLength(1)
    expect(changes[0]!.previousValue).toBeNull()
    expect(changes[0]!.currentValue).toEqual(newTs)
  })
})
