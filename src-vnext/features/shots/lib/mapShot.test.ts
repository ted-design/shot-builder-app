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
})
