import { describe, expect, it } from "vitest"
import {
  assignmentColourwayId,
  resolveAssignmentImage,
  resolveSkuImage,
} from "@/shared/lib/colourwayImage"
import type { ProductAssignment } from "@/shared/types"

// The real-data shape behind the bug: the family thumbnail is the FIRST
// colourway's photo (productWrites sets it on save), so any fallback to it
// shows a sibling colour.
const SIBLING_PHOTO = "clients/c1/productFamilies/f1/skus/black/black.webp"
const FAMILY = {
  thumbnailImagePath: SIBLING_PHOTO,
  headerImagePath: "clients/c1/productFamilies/f1/header.webp",
}
const SIBLING_URL = "https://firebasestorage.googleapis.com/v0/b/x/o/black.webp?alt=media&token=t1"
const OWN_PHOTO = "clients/c1/productFamilies/f1/skus/olive/olive.webp"

function assignment(overrides: Partial<ProductAssignment> = {}): ProductAssignment {
  return { familyId: "f1", familyName: "Travel Pant", ...overrides }
}

describe("resolveSkuImage", () => {
  it("returns the colourway's own photo when it has one", () => {
    expect(resolveSkuImage({ imagePath: OWN_PHOTO })).toEqual({
      src: OWN_PHOTO,
      colourwayPhotoMissing: false,
    })
  })

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["empty string", ""],
    ["whitespace", "   "],
  ])("flags a missing photo (imagePath %s) instead of resolving anything", (_label, imagePath) => {
    expect(resolveSkuImage({ imagePath })).toEqual({ src: null, colourwayPhotoMissing: true })
  })

  it("treats an absent SKU as missing", () => {
    expect(resolveSkuImage(undefined)).toEqual({ src: null, colourwayPhotoMissing: true })
  })
})

describe("resolveAssignmentImage — family-level assignment (no colourway chosen)", () => {
  it("keeps the frozen thumb first, as before", () => {
    const r = resolveAssignmentImage(assignment({ thumbUrl: SIBLING_URL, familyImageUrl: SIBLING_URL }))
    expect(r).toEqual({ src: SIBLING_URL, colourwayPhotoMissing: false })
  })

  it("falls back to the live family thumbnail, then header", () => {
    expect(resolveAssignmentImage(assignment(), { family: FAMILY }).src).toBe(SIBLING_PHOTO)
    expect(
      resolveAssignmentImage(assignment(), { family: { headerImagePath: FAMILY.headerImagePath } }).src,
    ).toBe(FAMILY.headerImagePath)
  })

  it("returns null without flagging when nothing exists", () => {
    expect(resolveAssignmentImage(assignment())).toEqual({ src: null, colourwayPhotoMissing: false })
  })
})

describe("resolveAssignmentImage — colourway assignment", () => {
  it("does not show the frozen family image when the colourway had no photo at pick time", () => {
    // Picker-written shape: thumbUrl = skuImageUrl ?? familyImageUrl, no skuImageUrl.
    const r = resolveAssignmentImage(
      assignment({ skuId: "olive", colourName: "Olive", thumbUrl: SIBLING_URL, familyImageUrl: SIBLING_URL }),
      { family: FAMILY },
    )
    expect(r).toEqual({ src: null, colourwayPhotoMissing: true })
  })

  it("shows the live SKU photo when one exists now, even if the frozen fields are the family image", () => {
    const r = resolveAssignmentImage(
      assignment({ skuId: "olive", thumbUrl: SIBLING_URL, familyImageUrl: SIBLING_URL }),
      { sku: { imagePath: OWN_PHOTO }, family: FAMILY },
    )
    expect(r).toEqual({ src: OWN_PHOTO, colourwayPhotoMissing: false })
  })

  it("uses the frozen skuImageUrl only while no live SKU doc is available", () => {
    const a = assignment({ skuId: "olive", skuImageUrl: OWN_PHOTO, thumbUrl: OWN_PHOTO, familyImageUrl: SIBLING_URL })
    expect(resolveAssignmentImage(a).src).toBe(OWN_PHOTO)
    expect(resolveAssignmentImage(a, { sku: null }).src).toBe(OWN_PHOTO)
  })

  it("treats a loaded live SKU doc as authoritative over stale frozen fields", () => {
    // Edit flow: Black → Olive keeps Black's frozen URLs (the edit patch carries no image fields).
    const editedToOlive = assignment({
      skuId: "olive",
      skuImageUrl: SIBLING_URL,
      thumbUrl: SIBLING_URL,
      familyImageUrl: "https://firebasestorage.googleapis.com/v0/b/x/o/header.webp",
    })
    expect(resolveAssignmentImage(editedToOlive, { sku: { imagePath: null } })).toEqual({
      src: null,
      colourwayPhotoMissing: true,
    })
    expect(resolveAssignmentImage(editedToOlive, { sku: { imagePath: OWN_PHOTO } }).src).toBe(OWN_PHOTO)
  })

  it("treats a legacy colourId-only assignment as colourway-level", () => {
    const r = resolveAssignmentImage(assignment({ colourId: "olive" }), { family: FAMILY })
    expect(r).toEqual({ src: null, colourwayPhotoMissing: true })
  })

  it("trusts a legacy thumbUrl only when it differs from the frozen family image", () => {
    // DevImport-shaped: thumbUrl = sku.imagePath ?? family thumb, familyImageUrl = family thumb.
    const own = resolveAssignmentImage(
      assignment({ skuId: "olive", thumbUrl: OWN_PHOTO, familyImageUrl: SIBLING_PHOTO }),
    )
    expect(own).toEqual({ src: OWN_PHOTO, colourwayPhotoMissing: false })

    const fallback = resolveAssignmentImage(
      assignment({ skuId: "olive", thumbUrl: SIBLING_PHOTO, familyImageUrl: SIBLING_PHOTO }),
    )
    expect(fallback).toEqual({ src: null, colourwayPhotoMissing: true })
  })

  it("trusts a thumbUrl when no family image was frozen (every writer then stored the colourway photo)", () => {
    const r = resolveAssignmentImage(assignment({ skuId: "olive", thumbUrl: OWN_PHOTO }))
    expect(r).toEqual({ src: OWN_PHOTO, colourwayPhotoMissing: false })
  })

  it("flags missing when the live SKU doc is gone and nothing colour-specific was frozen", () => {
    const r = resolveAssignmentImage(assignment({ skuId: "olive" }), { sku: null, family: FAMILY })
    expect(r).toEqual({ src: null, colourwayPhotoMissing: true })
  })

  it("never resolves a colourway with no photo of its own to a sibling's image, in any shape a writer stores", () => {
    // Every frozen shape the picker, imports and legacy mapping produce for a
    // colourway that had no photo: nothing, or the family image in familyImageUrl
    // (and in thumbUrl when one was written).
    const frozenShapes: ReadonlyArray<Partial<ProductAssignment>> = [
      {},
      { familyImageUrl: SIBLING_URL },
      { thumbUrl: SIBLING_URL, familyImageUrl: SIBLING_URL },
      { thumbUrl: SIBLING_PHOTO, familyImageUrl: SIBLING_PHOTO },
    ]
    const liveShapes = [{}, { sku: null }, { sku: { imagePath: null } }, { sku: {} }]
    // A loaded live doc with no photo wins even over a stale frozen sibling skuImageUrl.
    for (const key of ["skuId", "colourId"] as const) {
      const stale = assignment({ [key]: "olive", skuImageUrl: SIBLING_URL, thumbUrl: SIBLING_URL })
      expect(resolveAssignmentImage(stale, { sku: { imagePath: null }, family: FAMILY }).src).toBeNull()
    }
    for (const frozen of frozenShapes) {
      for (const key of ["skuId", "colourId"] as const) {
        for (const live of liveShapes) {
          const r = resolveAssignmentImage(assignment({ [key]: "olive", ...frozen }), { ...live, family: FAMILY })
          expect(r.src).toBeNull()
          expect(r.colourwayPhotoMissing).toBe(true)
        }
      }
    }
  })
})

describe("assignmentColourwayId", () => {
  it("prefers skuId, falls back to legacy colourId, and ignores blanks", () => {
    expect(assignmentColourwayId({ skuId: "a", colourId: "b" })).toBe("a")
    expect(assignmentColourwayId({ colourId: "b" })).toBe("b")
    expect(assignmentColourwayId({ skuId: "  ", colourId: "b" })).toBe("b")
    expect(assignmentColourwayId({})).toBeNull()
  })
})
