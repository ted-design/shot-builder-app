import { describe, expect, it } from "vitest"
import { Timestamp } from "firebase/firestore"
import type { ProductFamily, ProductSample, ProductSku } from "@/shared/types"
import { computeShootReadiness, sortByUrgency, isWithinDays, isOverdue } from "./shootReadiness"

const DAY_MS = 24 * 60 * 60 * 1000

function ts(offsetMs: number): Timestamp {
  return Timestamp.fromDate(new Date(Date.now() + offsetMs))
}

function makeFamily(overrides: Partial<ProductFamily> & { id: string; styleName: string }): ProductFamily {
  return {
    launchDate: null,
    clientId: "c1",
    status: "active",
    sizes: [],
    ...overrides,
  } as unknown as ProductFamily
}

function makeSku(id: string, familyId: string, flags?: Record<string, string>): ProductSku {
  return {
    id,
    familyId,
    name: id,
    deleted: false,
    assetRequirements: flags ?? null,
  } as unknown as ProductSku
}

function makeSample(id: string, status: string): ProductSample {
  return {
    id,
    type: "shoot",
    status,
    sizeRun: [],
    deleted: false,
  } as unknown as ProductSample
}

describe("computeShootReadiness", () => {
  it("returns empty for families without launchDate", () => {
    const families = [makeFamily({ id: "f1", styleName: "No date" })]
    const result = computeShootReadiness(families, new Map(), new Map())
    expect(result).toHaveLength(0)
  })

  it("computes readiness for a family with launch date", () => {
    const families = [
      makeFamily({ id: "f1", styleName: "Sneaker", launchDate: ts(30 * DAY_MS) }),
    ]
    const skus = new Map([
      ["f1", [
        makeSku("s1", "f1", { ecomm: "needed" }),
        makeSku("s2", "f1", { ecomm: "delivered" }),
      ]],
    ])
    const samples = new Map([
      ["f1", [
        makeSample("sa1", "arrived"),
        makeSample("sa2", "requested"),
        makeSample("sa3", "arrived"),
      ]],
    ])

    const result = computeShootReadiness(families, skus, samples)
    expect(result).toHaveLength(1)
    expect(result[0]!.familyName).toBe("Sneaker")
    expect(result[0]!.totalSkus).toBe(2)
    expect(result[0]!.skusWithFlags).toBe(1)
    expect(result[0]!.samplesArrived).toBe(2)
    expect(result[0]!.samplesTotal).toBe(3)
    expect(result[0]!.readinessPct).toBe(67)
  })

  it("excludes deleted skus and samples", () => {
    const families = [
      makeFamily({ id: "f1", styleName: "Boot", launchDate: ts(10 * DAY_MS) }),
    ]
    const skus = new Map([
      ["f1", [
        makeSku("s1", "f1", { ecomm: "needed" }),
        { ...makeSku("s2", "f1", { video: "needed" }), deleted: true } as unknown as ProductSku,
      ]],
    ])
    const samples = new Map([
      ["f1", [
        makeSample("sa1", "arrived"),
        { ...makeSample("sa2", "arrived"), deleted: true } as unknown as ProductSample,
      ]],
    ])

    const result = computeShootReadiness(families, skus, samples)
    expect(result[0]!.totalSkus).toBe(1)
    expect(result[0]!.samplesTotal).toBe(1)
    expect(result[0]!.readinessPct).toBe(100)
  })

  it("returns 0% readiness when no samples exist", () => {
    const families = [
      makeFamily({ id: "f1", styleName: "Jacket", launchDate: ts(5 * DAY_MS) }),
    ]
    const result = computeShootReadiness(families, new Map(), new Map())
    expect(result[0]!.readinessPct).toBe(0)
  })
})

describe("sortByUrgency", () => {
  it("sorts by launch date ascending, then readiness ascending", () => {
    const items = [
      { familyId: "a", familyName: "Late", launchDate: ts(30 * DAY_MS), totalSkus: 1, skusWithFlags: 0, samplesArrived: 0, samplesTotal: 1, readinessPct: 50 },
      { familyId: "b", familyName: "Soon", launchDate: ts(5 * DAY_MS), totalSkus: 1, skusWithFlags: 0, samplesArrived: 1, samplesTotal: 1, readinessPct: 100 },
      { familyId: "c", familyName: "Soon2", launchDate: ts(5 * DAY_MS), totalSkus: 1, skusWithFlags: 0, samplesArrived: 0, samplesTotal: 2, readinessPct: 0 },
    ]

    const sorted = sortByUrgency(items)
    expect(sorted.map((i) => i.familyId)).toEqual(["c", "b", "a"])
  })
})

describe("isWithinDays", () => {
  it("returns true for timestamp within range", () => {
    expect(isWithinDays(ts(2 * DAY_MS), 3)).toBe(true)
  })

  it("returns false for timestamp beyond range", () => {
    expect(isWithinDays(ts(5 * DAY_MS), 3)).toBe(false)
  })

  it("returns false for past timestamp", () => {
    expect(isWithinDays(ts(-DAY_MS), 3)).toBe(false)
  })
})

describe("isOverdue", () => {
  it("returns true for past timestamp", () => {
    expect(isOverdue(ts(-DAY_MS))).toBe(true)
  })

  it("returns false for future timestamp", () => {
    expect(isOverdue(ts(DAY_MS))).toBe(false)
  })
})
