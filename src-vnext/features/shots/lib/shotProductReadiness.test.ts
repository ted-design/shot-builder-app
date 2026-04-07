import { describe, it, expect } from "vitest"
import { resolveHeroFamilyIds, computeShotReadiness, shotLaunchDateMs } from "./shotProductReadiness"
import type { Shot, ProductFamily, ProductSku, ShotLook } from "@/shared/types"
import type { Timestamp } from "firebase/firestore"

function makeTs(ms: number): Timestamp {
  return { toDate: () => new Date(ms), toMillis: () => ms } as unknown as Timestamp
}

function makeShot(overrides: Partial<Shot> = {}): Shot {
  return {
    id: "shot-1",
    title: "Test Shot",
    projectId: "proj-1",
    clientId: "client-1",
    status: "todo",
    talent: [],
    products: [],
    sortOrder: 0,
    createdAt: makeTs(1000),
    updatedAt: makeTs(2000),
    createdBy: "user-1",
    ...overrides,
  }
}

function makeLook(overrides: Partial<ShotLook> = {}): ShotLook {
  return {
    id: "look-1",
    products: [],
    order: 0,
    ...overrides,
  }
}

function makeFamily(overrides: Partial<ProductFamily> = {}): ProductFamily {
  return {
    id: "fam-1",
    styleName: "Essential Tee",
    clientId: "client-1",
    ...overrides,
  }
}

function makeSku(overrides: Partial<ProductSku> = {}): ProductSku {
  return {
    id: "sku-1",
    familyId: "fam-1",
    colorName: "Black",
    clientId: "client-1",
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// resolveHeroFamilyIds
// ---------------------------------------------------------------------------

describe("resolveHeroFamilyIds", () => {
  it("returns empty array for shot with no products and no looks", () => {
    const shot = makeShot()
    expect(resolveHeroFamilyIds(shot)).toEqual([])
  })

  it("uses heroProductId when explicitly set on look", () => {
    const shot = makeShot({
      looks: [
        makeLook({
          heroProductId: "fam-hero",
          products: [
            { familyId: "fam-hero", familyName: "Hero" },
            { familyId: "fam-styling", familyName: "Styling" },
          ],
        }),
      ],
    })
    expect(resolveHeroFamilyIds(shot)).toEqual(["fam-hero"])
  })

  it("uses first product as implicit hero when heroProductId not set, single product", () => {
    const shot = makeShot({
      looks: [
        makeLook({
          products: [{ familyId: "fam-only", familyName: "Only" }],
        }),
      ],
    })
    expect(resolveHeroFamilyIds(shot)).toEqual(["fam-only"])
  })

  it("uses first product as default hero when heroProductId not set, multiple products", () => {
    const shot = makeShot({
      looks: [
        makeLook({
          products: [
            { familyId: "fam-first", familyName: "First" },
            { familyId: "fam-second", familyName: "Second" },
            { familyId: "fam-third", familyName: "Third" },
          ],
        }),
      ],
    })
    expect(resolveHeroFamilyIds(shot)).toEqual(["fam-first"])
  })

  it("collects unique hero IDs across multiple looks", () => {
    const shot = makeShot({
      looks: [
        makeLook({
          id: "look-1",
          order: 0,
          heroProductId: "fam-a",
          products: [
            { familyId: "fam-a", familyName: "A" },
            { familyId: "fam-styling", familyName: "Styling" },
          ],
        }),
        makeLook({
          id: "look-2",
          order: 1,
          heroProductId: "fam-b",
          products: [
            { familyId: "fam-b", familyName: "B" },
            { familyId: "fam-styling", familyName: "Styling" },
          ],
        }),
      ],
    })
    expect(resolveHeroFamilyIds(shot)).toEqual(["fam-a", "fam-b"])
  })

  it("deduplicates when same hero appears in multiple looks", () => {
    const shot = makeShot({
      looks: [
        makeLook({
          id: "look-1",
          order: 0,
          heroProductId: "fam-a",
          products: [{ familyId: "fam-a", familyName: "A" }],
        }),
        makeLook({
          id: "look-2",
          order: 1,
          heroProductId: "fam-a",
          products: [{ familyId: "fam-a", familyName: "A" }],
        }),
      ],
    })
    expect(resolveHeroFamilyIds(shot)).toEqual(["fam-a"])
  })

  it("falls back to top-level products when no looks exist", () => {
    const shot = makeShot({
      products: [
        { familyId: "fam-top", familyName: "Top" },
        { familyId: "fam-other", familyName: "Other" },
      ],
    })
    expect(resolveHeroFamilyIds(shot)).toEqual(["fam-top"])
  })

  it("handles legacy productId matching for heroProductId", () => {
    const shot = makeShot({
      looks: [
        makeLook({
          heroProductId: "legacy-pid",
          products: [
            { familyId: "fam-miss", familyName: "Miss" },
          ],
        }),
      ],
    })
    // heroProductId doesn't match any product's familyId, falls to first product
    expect(resolveHeroFamilyIds(shot)).toEqual(["fam-miss"])
  })
})

// ---------------------------------------------------------------------------
// computeShotReadiness
// ---------------------------------------------------------------------------

describe("computeShotReadiness", () => {
  it("returns zeroed readiness for shot with no products", () => {
    const shot = makeShot()
    const familyById = new Map<string, ProductFamily>()
    const result = computeShotReadiness(shot, familyById)
    expect(result.earliestLaunchDate).toBeNull()
    expect(result.totalRequirements).toBe(0)
    expect(result.totalSamples).toBe(0)
    expect(result.arrivedSamples).toBe(0)
    expect(result.heroFamilyNames).toEqual([])
    expect(result.activeRequirementTypes).toEqual([])
  })

  it("aggregates from hero product families only", () => {
    const shot = makeShot({
      looks: [
        makeLook({
          heroProductId: "fam-hero",
          products: [
            { familyId: "fam-hero", familyName: "Hero" },
            { familyId: "fam-styling", familyName: "Styling" },
          ],
        }),
      ],
    })
    const familyById = new Map<string, ProductFamily>([
      ["fam-hero", makeFamily({
        id: "fam-hero",
        styleName: "Essential Tee",
        earliestLaunchDate: makeTs(1700000000000),
        activeRequirementCount: 3,
        sampleCount: 4,
        samplesArrivedCount: 2,
      })],
      ["fam-styling", makeFamily({
        id: "fam-styling",
        styleName: "Leather Belt",
        earliestLaunchDate: makeTs(1800000000000),
        activeRequirementCount: 1,
        sampleCount: 2,
        samplesArrivedCount: 0,
      })],
    ])
    const result = computeShotReadiness(shot, familyById)
    // Should only aggregate fam-hero, not fam-styling
    expect(result.totalRequirements).toBe(3)
    expect(result.totalSamples).toBe(4)
    expect(result.arrivedSamples).toBe(2)
    expect(result.heroFamilyNames).toEqual(["Essential Tee"])
    // Family fallback — no type breakdown
    expect(result.activeRequirementTypes).toEqual([])
  })

  it("aggregates across multiple hero families", () => {
    const shot = makeShot({
      looks: [
        makeLook({
          id: "look-1",
          order: 0,
          heroProductId: "fam-a",
          products: [{ familyId: "fam-a", familyName: "A" }],
        }),
        makeLook({
          id: "look-2",
          order: 1,
          heroProductId: "fam-b",
          products: [{ familyId: "fam-b", familyName: "B" }],
        }),
      ],
    })
    const familyById = new Map<string, ProductFamily>([
      ["fam-a", makeFamily({
        id: "fam-a",
        styleName: "Product A",
        earliestLaunchDate: makeTs(1700000000000),
        activeRequirementCount: 2,
        sampleCount: 3,
        samplesArrivedCount: 1,
      })],
      ["fam-b", makeFamily({
        id: "fam-b",
        styleName: "Product B",
        earliestLaunchDate: makeTs(1600000000000),
        activeRequirementCount: 1,
        sampleCount: 2,
        samplesArrivedCount: 2,
      })],
    ])
    const result = computeShotReadiness(shot, familyById)
    // Earliest of the two launch dates
    expect(result.earliestLaunchDate?.toMillis()).toBe(1600000000000)
    expect(result.totalRequirements).toBe(3)
    expect(result.totalSamples).toBe(5)
    expect(result.arrivedSamples).toBe(3)
    expect(result.heroFamilyNames).toEqual(["Product A", "Product B"])
    // Family fallback — no type breakdown
    expect(result.activeRequirementTypes).toEqual([])
  })

  it("skips deleted families", () => {
    const shot = makeShot({
      looks: [
        makeLook({
          products: [{ familyId: "fam-deleted", familyName: "Deleted" }],
        }),
      ],
    })
    const familyById = new Map<string, ProductFamily>([
      ["fam-deleted", makeFamily({
        id: "fam-deleted",
        styleName: "Deleted Product",
        deleted: true,
        activeRequirementCount: 5,
      })],
    ])
    const result = computeShotReadiness(shot, familyById)
    expect(result.totalRequirements).toBe(0)
    expect(result.heroFamilyNames).toEqual([])
  })

  it("handles missing family in map gracefully", () => {
    const shot = makeShot({
      looks: [
        makeLook({
          products: [{ familyId: "fam-missing", familyName: "Missing" }],
        }),
      ],
    })
    const familyById = new Map<string, ProductFamily>()
    const result = computeShotReadiness(shot, familyById)
    expect(result.totalRequirements).toBe(0)
    expect(result.heroFamilyNames).toEqual([])
  })

  it("uses SKU launchDate when SKU has one", () => {
    const shot = makeShot({
      looks: [
        makeLook({
          products: [{ familyId: "fam-1", familyName: "Tee", skuId: "sku-1" }],
        }),
      ],
    })
    const familyById = new Map<string, ProductFamily>([
      ["fam-1", makeFamily({
        id: "fam-1",
        earliestLaunchDate: makeTs(1700000000000),
      })],
    ])
    const skuById = new Map<string, ProductSku>([
      ["sku-1", makeSku({
        id: "sku-1",
        familyId: "fam-1",
        launchDate: makeTs(1800000000000),
      })],
    ])
    const result = computeShotReadiness(shot, familyById, skuById)
    expect(result.earliestLaunchDate?.toMillis()).toBe(1800000000000)
    expect(result.isSkuLevel).toBe(true)
  })

  it("returns null launch date when SKU has no launchDate (no family fallback)", () => {
    const shot = makeShot({
      looks: [
        makeLook({
          products: [{ familyId: "fam-1", familyName: "Tee", skuId: "sku-1" }],
        }),
      ],
    })
    const familyById = new Map<string, ProductFamily>([
      ["fam-1", makeFamily({
        id: "fam-1",
        earliestLaunchDate: makeTs(1700000000000),
      })],
    ])
    const skuById = new Map<string, ProductSku>([
      ["sku-1", makeSku({
        id: "sku-1",
        familyId: "fam-1",
        // No launchDate
      })],
    ])
    const result = computeShotReadiness(shot, familyById, skuById)
    expect(result.earliestLaunchDate).toBeNull()
    expect(result.isSkuLevel).toBe(true)
  })

  it("falls back to family earliestLaunchDate when no SKU data loaded", () => {
    const shot = makeShot({
      looks: [
        makeLook({
          products: [{ familyId: "fam-1", familyName: "Tee", skuId: "sku-1" }],
        }),
      ],
    })
    const familyById = new Map<string, ProductFamily>([
      ["fam-1", makeFamily({
        id: "fam-1",
        earliestLaunchDate: makeTs(1700000000000),
      })],
    ])
    // No skuById passed — SKU data not loaded yet
    const result = computeShotReadiness(shot, familyById)
    expect(result.earliestLaunchDate?.toMillis()).toBe(1700000000000)
    expect(result.isSkuLevel).toBe(false)
  })

  it("collects activeRequirementTypes from SKU assetRequirements", () => {
    const shot = makeShot({
      looks: [
        makeLook({
          products: [{ familyId: "fam-1", familyName: "Tee", skuId: "sku-1" }],
        }),
      ],
    })
    const familyById = new Map<string, ProductFamily>([
      ["fam-1", makeFamily({ id: "fam-1" })],
    ])
    const skuById = new Map<string, ProductSku>([
      ["sku-1", makeSku({
        id: "sku-1",
        familyId: "fam-1",
        assetRequirements: {
          ecomm_on_figure: "needed",
          lifestyle: "in_progress",
          off_figure_pinup: "delivered",
          video: "not_needed",
        },
      })],
    ])
    const result = computeShotReadiness(shot, familyById, skuById)
    expect(result.totalRequirements).toBe(2)
    expect(result.activeRequirementTypes).toEqual(
      expect.arrayContaining(["ecomm_on_figure", "lifestyle"]),
    )
    expect(result.activeRequirementTypes).toHaveLength(2)
  })

  it("deduplicates activeRequirementTypes across multiple hero SKUs", () => {
    const shot = makeShot({
      looks: [
        makeLook({
          id: "look-1",
          order: 0,
          heroProductId: "fam-a",
          products: [{ familyId: "fam-a", familyName: "A", skuId: "sku-a" }],
        }),
        makeLook({
          id: "look-2",
          order: 1,
          heroProductId: "fam-b",
          products: [{ familyId: "fam-b", familyName: "B", skuId: "sku-b" }],
        }),
      ],
    })
    const familyById = new Map<string, ProductFamily>([
      ["fam-a", makeFamily({ id: "fam-a", styleName: "Product A" })],
      ["fam-b", makeFamily({ id: "fam-b", styleName: "Product B" })],
    ])
    const skuById = new Map<string, ProductSku>([
      ["sku-a", makeSku({
        id: "sku-a",
        familyId: "fam-a",
        assetRequirements: { ecomm_on_figure: "needed", lifestyle: "needed" },
      })],
      ["sku-b", makeSku({
        id: "sku-b",
        familyId: "fam-b",
        assetRequirements: { ecomm_on_figure: "in_progress", video: "needed" },
      })],
    ])
    const result = computeShotReadiness(shot, familyById, skuById)
    expect(result.totalRequirements).toBe(4) // 2 from sku-a + 2 from sku-b
    // ecomm_on_figure appears in both but should be deduplicated
    expect(result.activeRequirementTypes).toEqual(
      expect.arrayContaining(["ecomm_on_figure", "lifestyle", "video"]),
    )
    expect(result.activeRequirementTypes).toHaveLength(3)
  })

  it("returns empty activeRequirementTypes for family fallback", () => {
    const shot = makeShot({
      looks: [
        makeLook({
          products: [{ familyId: "fam-1", familyName: "Tee" }],
        }),
      ],
    })
    const familyById = new Map<string, ProductFamily>([
      ["fam-1", makeFamily({
        id: "fam-1",
        activeRequirementCount: 3,
      })],
    ])
    const result = computeShotReadiness(shot, familyById)
    // Family fallback — totalRequirements from count, but no type breakdown
    expect(result.totalRequirements).toBe(3)
    expect(result.activeRequirementTypes).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// shotLaunchDateMs
// ---------------------------------------------------------------------------

describe("shotLaunchDateMs", () => {
  it("uses SKU launch date when skuById is provided", () => {
    const shot = makeShot({
      looks: [
        makeLook({
          products: [{ familyId: "fam-1", familyName: "Tee", skuId: "sku-1" }],
        }),
      ],
    })
    const familyById = new Map<string, ProductFamily>([
      ["fam-1", makeFamily({
        id: "fam-1",
        earliestLaunchDate: makeTs(1700000000000),
      })],
    ])
    const skuById = new Map<string, ProductSku>([
      ["sku-1", makeSku({
        id: "sku-1",
        familyId: "fam-1",
        launchDate: makeTs(1800000000000),
      })],
    ])
    expect(shotLaunchDateMs(shot, familyById, skuById)).toBe(1800000000000)
  })

  it("returns MAX_SAFE_INTEGER when SKU has no launch date", () => {
    const shot = makeShot({
      looks: [
        makeLook({
          products: [{ familyId: "fam-1", familyName: "Tee", skuId: "sku-1" }],
        }),
      ],
    })
    const familyById = new Map<string, ProductFamily>([
      ["fam-1", makeFamily({
        id: "fam-1",
        earliestLaunchDate: makeTs(1700000000000),
      })],
    ])
    const skuById = new Map<string, ProductSku>([
      ["sku-1", makeSku({ id: "sku-1", familyId: "fam-1" })],
    ])
    // SKU has no launchDate, should NOT fall back to family
    expect(shotLaunchDateMs(shot, familyById, skuById)).toBe(Number.MAX_SAFE_INTEGER)
  })

  it("uses family fallback when skuById is not provided", () => {
    const shot = makeShot({
      looks: [
        makeLook({
          products: [{ familyId: "fam-1", familyName: "Tee", skuId: "sku-1" }],
        }),
      ],
    })
    const familyById = new Map<string, ProductFamily>([
      ["fam-1", makeFamily({
        id: "fam-1",
        earliestLaunchDate: makeTs(1700000000000),
      })],
    ])
    // No skuById — family fallback should apply
    expect(shotLaunchDateMs(shot, familyById)).toBe(1700000000000)
  })
})
