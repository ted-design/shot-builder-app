import { describe, expect, it } from "vitest"
import { applyAssignmentEdit } from "@/features/shots/lib/productAssignmentEdit"
import type { ProductAssignment } from "@/shared/types"

const NAVY: ProductAssignment = {
  familyId: "fam-1",
  familyName: "Classic Tee",
  skuId: "navy",
  colourId: "navy",
  skuName: "Navy",
  colourName: "Navy",
  sizeScope: "single",
  size: "M",
  quantity: 2,
  isHero: true,
  thumbUrl: "navy.webp",
  skuImageUrl: "navy.webp",
  familyImageUrl: "family.webp",
}

describe("applyAssignmentEdit", () => {
  it("colourway changed to one with no photo: drops the old colourway's name and photo, keeps family and slot fields", () => {
    const next = applyAssignmentEdit(NAVY, {
      familyId: "fam-1", skuId: "olive", colourId: "olive", skuName: "Olive", colourName: "Olive",
    })
    expect(next).toEqual({
      familyId: "fam-1", familyName: "Classic Tee", familyImageUrl: "family.webp",
      skuId: "olive", colourId: "olive", skuName: "Olive", colourName: "Olive",
      sizeScope: "single", size: "M", quantity: 2, isHero: true,
    })
  })

  it("colourway changed to one with a photo: the new photo replaces the old", () => {
    const next = applyAssignmentEdit(NAVY, {
      familyId: "fam-1", skuId: "olive", colourId: "olive", skuImageUrl: "olive.webp", thumbUrl: "olive.webp",
    })
    expect(next.skuImageUrl).toBe("olive.webp")
    expect(next.thumbUrl).toBe("olive.webp")
    expect(next.colourName).toBeUndefined() // old colourway's name doesn't survive either
  })

  it("no colourway chosen: the assignment becomes family-level", () => {
    const next = applyAssignmentEdit(NAVY, { familyId: "fam-1", quantity: 1 })
    for (const key of ["skuId", "colourId", "skuName", "colourName", "skuImageUrl", "thumbUrl"] as const) {
      expect(next[key]).toBeUndefined()
    }
    expect(next).toMatchObject({ familyId: "fam-1", familyImageUrl: "family.webp", quantity: 1 })
  })

  it("same colourway (a quantity or size edit): every stored field is kept", () => {
    const next = applyAssignmentEdit(NAVY, { familyId: "fam-1", skuId: "navy", colourId: "navy", quantity: 5 })
    expect(next).toEqual({ ...NAVY, quantity: 5 })
  })

  it("matches a legacy colourId-only assignment to the same colourway by id", () => {
    const legacy: ProductAssignment = { familyId: "fam-1", colourId: "navy", colourName: "Navy", skuImageUrl: "navy.webp" }
    expect(applyAssignmentEdit(legacy, { familyId: "fam-1", skuId: "navy", colourId: "navy" }).skuImageUrl).toBe("navy.webp")
    expect(applyAssignmentEdit(legacy, { familyId: "fam-1", skuId: "olive", colourId: "olive" }).skuImageUrl).toBeUndefined()
  })

  it("family changed: drops the old family's image and name as well", () => {
    const next = applyAssignmentEdit(NAVY, { familyId: "fam-2", familyName: "Polo", skuId: "navy", colourId: "navy" })
    expect(next.familyImageUrl).toBeUndefined()
    expect(next.skuImageUrl).toBeUndefined() // same SKU id under another family is a different colourway
    expect(next.familyName).toBe("Polo")
  })

  it("an unchanged edit of a row whose skuId and colourId differ keeps its photo", () => {
    const mixed: ProductAssignment = { familyId: "fam-1", skuId: "s1", colourId: "c1", skuImageUrl: "s1.webp" }
    expect(applyAssignmentEdit(mixed, { familyId: "fam-1", skuId: "s1", colourId: "s1" }).skuImageUrl).toBe("s1.webp")
  })

  it("refreshColourwayImages: the same colourway re-picked from the catalog drops stored photo fields", () => {
    const repicked = applyAssignmentEdit(NAVY, { familyId: "fam-1", skuId: "navy", colourId: "navy" }, { refreshColourwayImages: true })
    expect(repicked.skuImageUrl).toBeUndefined()
    expect(repicked.thumbUrl).toBeUndefined()
    expect(repicked).toMatchObject({ colourName: "Navy", familyImageUrl: "family.webp", quantity: 2 })
    const withPhoto = applyAssignmentEdit(NAVY, { familyId: "fam-1", skuId: "navy", skuImageUrl: "navy-new.webp" }, { refreshColourwayImages: true })
    expect(withPhoto.skuImageUrl).toBe("navy-new.webp")
  })

  it("does not mutate the existing assignment", () => {
    const before = JSON.stringify(NAVY)
    applyAssignmentEdit(NAVY, { familyId: "fam-1", skuId: "olive", colourId: "olive" })
    expect(JSON.stringify(NAVY)).toBe(before)
  })
})
