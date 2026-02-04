import { describe, expect, it } from "vitest"
import { mapShot } from "@/features/shots/lib/mapShot"

describe("mapShot", () => {
  it("falls back to legacy name when title is missing", () => {
    const shot = mapShot("s1", {
      name: "Legacy Shot Name",
      projectId: "p1",
      clientId: "c1",
      createdAt: { seconds: 1, nanoseconds: 0 },
      updatedAt: { seconds: 1, nanoseconds: 0 },
      createdBy: "u1",
      deleted: false,
    })
    expect(shot.title).toBe("Legacy Shot Name")
  })

  it("derives heroImage from legacy attachments when heroImage is absent", () => {
    const shot = mapShot("s1", {
      title: "Shot A",
      projectId: "p1",
      clientId: "c1",
      createdAt: { seconds: 1, nanoseconds: 0 },
      updatedAt: { seconds: 1, nanoseconds: 0 },
      createdBy: "u1",
      deleted: false,
      attachments: [
        { path: "shots/s1/a.jpg", downloadURL: "https://example.com/a.jpg", isPrimary: true },
      ],
    })
    expect(shot.heroImage).toEqual({
      path: "shots/s1/a.jpg",
      downloadURL: "https://example.com/a.jpg",
    })
  })

  it("prefers a designated look reference when present", () => {
    const shot = mapShot("s1", {
      title: "Shot A",
      projectId: "p1",
      clientId: "c1",
      createdAt: { seconds: 1, nanoseconds: 0 },
      updatedAt: { seconds: 1, nanoseconds: 0 },
      createdBy: "u1",
      deleted: false,
      looks: [
        {
          displayImageId: "ref-2",
          references: [
            { id: "ref-1", downloadURL: "https://example.com/1.jpg", path: "shots/s1/1.jpg" },
            { id: "ref-2", downloadURL: "https://example.com/2.jpg", path: "shots/s1/2.jpg" },
          ],
        },
      ],
    })
    expect(shot.heroImage?.downloadURL).toBe("https://example.com/2.jpg")
    expect(shot.heroImage?.path).toBe("shots/s1/2.jpg")
  })

  it("maps legacy shot product image paths to thumbUrl", () => {
    const shot = mapShot("s1", {
      title: "Shot A",
      projectId: "p1",
      clientId: "c1",
      createdAt: { seconds: 1, nanoseconds: 0 },
      updatedAt: { seconds: 1, nanoseconds: 0 },
      createdBy: "u1",
      deleted: false,
      products: [
        {
          productId: "fam-1",
          productName: "Classic Tee",
          thumbnailImagePath: "productFamilies/fam-1/thumb.webp",
          colourImagePath: "productFamilies/fam-1/skus/sku-1.webp",
          sizeScope: "all",
        },
      ],
    })

    expect(shot.products).toHaveLength(1)
    expect(shot.products[0]?.familyId).toBe("fam-1")
    expect(shot.products[0]?.familyName).toBe("Classic Tee")
    expect(shot.products[0]?.thumbUrl).toBe("productFamilies/fam-1/thumb.webp")
    expect(shot.products[0]?.skuImageUrl).toBe("productFamilies/fam-1/skus/sku-1.webp")
    expect(shot.products[0]?.familyImageUrl).toBe("productFamilies/fam-1/thumb.webp")
  })

  it("derives heroImage from look heroProductId when no display image is set", () => {
    const shot = mapShot("s1", {
      title: "Shot A",
      projectId: "p1",
      clientId: "c1",
      createdAt: { seconds: 1, nanoseconds: 0 },
      updatedAt: { seconds: 1, nanoseconds: 0 },
      createdBy: "u1",
      deleted: false,
      looks: [
        {
          id: "look-1",
          order: 0,
          heroProductId: "fam-1",
          products: [
            {
              familyId: "fam-1",
              familyName: "Classic Tee",
              thumbUrl: "clients/c1/productFamilies/fam-1/thumb.webp",
            },
          ],
          references: [],
        },
      ],
    })

    expect(shot.heroImage).toEqual({
      path: "clients/c1/productFamilies/fam-1/thumb.webp",
      downloadURL: "clients/c1/productFamilies/fam-1/thumb.webp",
    })
  })

  it("maps looks into typed structure", () => {
    const shot = mapShot("s1", {
      title: "Shot A",
      projectId: "p1",
      clientId: "c1",
      createdAt: { seconds: 1, nanoseconds: 0 },
      updatedAt: { seconds: 1, nanoseconds: 0 },
      createdBy: "u1",
      deleted: false,
      looks: [
        {
          id: "look-1",
          order: 0,
          label: "Primary",
          heroProductId: null,
          displayImageId: "ref-1",
          products: [{ productId: "fam-1", productName: "Hat", sizeScope: "pending" }],
          references: [{ id: "ref-1", path: "shots/s1/ref.webp" }],
        },
      ],
    })

    expect(shot.looks).toHaveLength(1)
    expect(shot.looks?.[0]?.id).toBe("look-1")
    expect(shot.looks?.[0]?.products?.[0]?.familyId).toBe("fam-1")
    expect(shot.looks?.[0]?.references?.[0]?.id).toBe("ref-1")
  })
})
