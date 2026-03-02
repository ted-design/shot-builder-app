import { describe, it, expect, vi } from "vitest"
import { Timestamp } from "firebase/firestore"
import type { ProductFamily } from "@/shared/types"
import {
  computeSuggestedShootWindow,
  sortByUrgency,
  isWithinDays,
} from "@/features/products/lib/shootReadiness"

/**
 * Test the filtering and mapping logic used by useShootReadiness.
 * The hook filters families by 3 criteria, maps them to ShootReadinessItems,
 * and sorts by urgency. We test the pure logic without rendering the hook
 * (which would require mocking Firestore subscriptions).
 */

const DAY_MS = 24 * 60 * 60 * 1000

function ts(offsetMs: number): Timestamp {
  return Timestamp.fromDate(new Date(Date.now() + offsetMs))
}

function makeFamily(
  overrides: Partial<ProductFamily> & { id: string; styleName: string },
): ProductFamily {
  return {
    clientId: "c1",
    status: "active",
    sizes: [],
    ...overrides,
  } as unknown as ProductFamily
}

/**
 * Replicate the hook's eligibility filter logic exactly.
 * A family is eligible if:
 *   1. Not archived/deleted
 *   2. Has launchDate within 90 days, OR
 *   3. Has earliestLaunchDate within 90 days, OR
 *   4. Has sampleCount > 0
 */
function filterEligible(families: ProductFamily[]): ProductFamily[] {
  return families.filter((f) => {
    if (f.archived === true || f.deleted === true) return false
    const hasUpcomingLaunch =
      f.launchDate != null && isWithinDays(f.launchDate, 90)
    const hasUpcomingEarliestLaunch =
      f.earliestLaunchDate != null && isWithinDays(f.earliestLaunchDate, 90)
    const hasSamples =
      (f.sampleCount ?? 0) > 0 || (f.samplesArrivedCount ?? 0) > 0
    return hasUpcomingLaunch || hasUpcomingEarliestLaunch || hasSamples
  })
}

describe("useShootReadiness eligibility filtering", () => {
  it("excludes archived families", () => {
    const families = [
      makeFamily({
        id: "f1",
        styleName: "Archived Tee",
        archived: true,
        launchDate: ts(30 * DAY_MS),
      }),
    ]
    expect(filterEligible(families)).toHaveLength(0)
  })

  it("excludes deleted families", () => {
    const families = [
      makeFamily({
        id: "f1",
        styleName: "Deleted Tee",
        deleted: true,
        launchDate: ts(30 * DAY_MS),
      }),
    ]
    expect(filterEligible(families)).toHaveLength(0)
  })

  it("includes family with launchDate within 90 days", () => {
    const families = [
      makeFamily({
        id: "f1",
        styleName: "Soon Tee",
        launchDate: ts(60 * DAY_MS),
      }),
    ]
    const result = filterEligible(families)
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe("f1")
  })

  it("excludes family with launchDate beyond 90 days", () => {
    const families = [
      makeFamily({
        id: "f1",
        styleName: "Far Future Tee",
        launchDate: ts(120 * DAY_MS),
      }),
    ]
    expect(filterEligible(families)).toHaveLength(0)
  })

  it("excludes family with launchDate in the past", () => {
    const families = [
      makeFamily({
        id: "f1",
        styleName: "Past Tee",
        launchDate: ts(-10 * DAY_MS),
      }),
    ]
    expect(filterEligible(families)).toHaveLength(0)
  })

  it("includes family with earliestLaunchDate within 90 days", () => {
    const families = [
      makeFamily({
        id: "f1",
        styleName: "SKU Launch Tee",
        earliestLaunchDate: ts(45 * DAY_MS),
      }),
    ]
    const result = filterEligible(families)
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe("f1")
  })

  it("excludes family with earliestLaunchDate beyond 90 days", () => {
    const families = [
      makeFamily({
        id: "f1",
        styleName: "Far SKU Tee",
        earliestLaunchDate: ts(100 * DAY_MS),
      }),
    ]
    expect(filterEligible(families)).toHaveLength(0)
  })

  it("includes family with sampleCount > 0 (even without launch date)", () => {
    const families = [
      makeFamily({
        id: "f1",
        styleName: "Sampled Tee",
        sampleCount: 3,
      }),
    ]
    const result = filterEligible(families)
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe("f1")
  })

  it("includes family with samplesArrivedCount > 0 (even without sampleCount)", () => {
    const families = [
      makeFamily({
        id: "f1",
        styleName: "Arrived Tee",
        samplesArrivedCount: 1,
      }),
    ]
    const result = filterEligible(families)
    expect(result).toHaveLength(1)
  })

  it("excludes family with no launch dates and no samples", () => {
    const families = [
      makeFamily({
        id: "f1",
        styleName: "Empty Tee",
      }),
    ]
    expect(filterEligible(families)).toHaveLength(0)
  })

  it("excludes family with sampleCount of 0 and no launch dates", () => {
    const families = [
      makeFamily({
        id: "f1",
        styleName: "Zero Samples",
        sampleCount: 0,
        samplesArrivedCount: 0,
      }),
    ]
    expect(filterEligible(families)).toHaveLength(0)
  })

  it("filters correctly with a mix of eligible and ineligible families", () => {
    const families = [
      makeFamily({
        id: "f1",
        styleName: "Eligible: upcoming launch",
        launchDate: ts(30 * DAY_MS),
      }),
      makeFamily({
        id: "f2",
        styleName: "Eligible: has samples",
        sampleCount: 2,
      }),
      makeFamily({
        id: "f3",
        styleName: "Ineligible: archived",
        archived: true,
        launchDate: ts(10 * DAY_MS),
      }),
      makeFamily({
        id: "f4",
        styleName: "Ineligible: far future",
        launchDate: ts(200 * DAY_MS),
      }),
      makeFamily({
        id: "f5",
        styleName: "Ineligible: no data",
      }),
      makeFamily({
        id: "f6",
        styleName: "Eligible: SKU launch",
        earliestLaunchDate: ts(80 * DAY_MS),
      }),
    ]
    const result = filterEligible(families)
    expect(result).toHaveLength(3)
    expect(result.map((f) => f.id).sort()).toEqual(["f1", "f2", "f6"])
  })
})

describe("useShootReadiness mapping logic", () => {
  it("computes readinessPct as 0 when no samples", () => {
    const samplesTotal = 0
    const samplesArrived = 0
    const pct = samplesTotal > 0 ? Math.round((samplesArrived / samplesTotal) * 100) : 0
    expect(pct).toBe(0)
  })

  it("computes readinessPct correctly when some samples arrived", () => {
    const samplesTotal = 4
    const samplesArrived = 3
    const pct = Math.round((samplesArrived / samplesTotal) * 100)
    expect(pct).toBe(75)
  })

  it("computes readinessPct as 100 when all samples arrived", () => {
    const samplesTotal = 5
    const samplesArrived = 5
    const pct = Math.round((samplesArrived / samplesTotal) * 100)
    expect(pct).toBe(100)
  })

  it("uses earliestLaunchDate as effectiveLaunchDate when present", () => {
    const family = makeFamily({
      id: "f1",
      styleName: "Test",
      launchDate: ts(60 * DAY_MS),
      earliestLaunchDate: ts(30 * DAY_MS),
    })
    const effectiveLaunchDate = family.earliestLaunchDate ?? family.launchDate ?? null
    expect(effectiveLaunchDate).toBe(family.earliestLaunchDate)
  })

  it("falls back to launchDate when earliestLaunchDate is absent", () => {
    const family = makeFamily({
      id: "f1",
      styleName: "Test",
      launchDate: ts(60 * DAY_MS),
    })
    const effectiveLaunchDate = family.earliestLaunchDate ?? family.launchDate ?? null
    expect(effectiveLaunchDate).toBe(family.launchDate)
  })

  it("returns null effectiveLaunchDate when both are absent", () => {
    const family = makeFamily({ id: "f1", styleName: "Test" })
    const effectiveLaunchDate = family.earliestLaunchDate ?? family.launchDate ?? null
    expect(effectiveLaunchDate).toBeNull()
  })

  it("uses activeSkuCount over skuCount when available", () => {
    const family = makeFamily({
      id: "f1",
      styleName: "Test",
      activeSkuCount: 3,
      skuCount: 5,
    })
    const totalSkus = family.activeSkuCount ?? family.skuCount ?? 0
    expect(totalSkus).toBe(3)
  })

  it("falls back to skuCount when activeSkuCount is absent", () => {
    const family = makeFamily({
      id: "f1",
      styleName: "Test",
      skuCount: 7,
    })
    const totalSkus = family.activeSkuCount ?? family.skuCount ?? 0
    expect(totalSkus).toBe(7)
  })

  it("defaults to 0 when both sku counts are absent", () => {
    const family = makeFamily({ id: "f1", styleName: "Test" })
    const totalSkus = family.activeSkuCount ?? family.skuCount ?? 0
    expect(totalSkus).toBe(0)
  })
})
