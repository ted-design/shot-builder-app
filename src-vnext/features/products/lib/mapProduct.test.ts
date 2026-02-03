import { describe, expect, it } from "vitest"
import { Timestamp } from "firebase/firestore"
import { mapProductFamily, mapProductSku } from "@/features/products/lib/mapProduct"

describe("mapProductFamily", () => {
  it("maps core identity fields with safe defaults", () => {
    const fam = mapProductFamily("f1", { styleName: "Merino Tee", clientId: "c1" })
    expect(fam.id).toBe("f1")
    expect(fam.clientId).toBe("c1")
    expect(fam.styleName).toBe("Merino Tee")
    expect(fam.archived).toBe(false)
    expect(fam.status).toBe("active")
  })

  it("accepts legacy classification aliases and derives category", () => {
    const fam = mapProductFamily("f1", {
      styleName: "Merino Tee",
      productType: "tops",
      productSubcategory: "tshirts",
    })
    expect(fam.productType).toBe("tops")
    expect(fam.productSubcategory).toBe("tshirts")
    expect(fam.category).toBe("tshirts")
  })

  it("normalizes timestamps from milliseconds and ISO strings", () => {
    const createdAtMs = Date.UTC(2026, 0, 1)
    const fam = mapProductFamily("f1", {
      styleName: "Merino Tee",
      createdAt: createdAtMs,
      updatedAt: "2026-02-01T00:00:00.000Z",
    })
    expect(fam.createdAt).toBeInstanceOf(Timestamp)
    expect(fam.updatedAt).toBeInstanceOf(Timestamp)
  })
})

describe("mapProductSku", () => {
  it("maps colorName with legacy alias and hexColor alias", () => {
    const sku = mapProductSku("s1", {
      name: "Black",
      colourHex: "#000000",
      sizes: ["S", "M"],
    })
    expect(sku.colorName).toBe("Black")
    expect(sku.hexColor).toBe("#000000")
    expect(sku.colourHex).toBe("#000000")
    expect(sku.sizes).toEqual(["S", "M"])
    expect(sku.status).toBe("active")
    expect(sku.archived).toBe(false)
  })
})
