import { describe, expect, it } from "vitest"
import { Timestamp } from "firebase/firestore"
import type { ProductFamily, ProductSample, ProductSku } from "@/shared/types"
import {
  computeShootReadiness,
  computeSuggestedShootWindow,
  sortByUrgency,
  isWithinDays,
  isOverdue,
} from "./shootReadiness"

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

function makeSample(id: string, status: string, eta?: Timestamp | null): ProductSample {
  return {
    id,
    type: "shoot",
    status,
    sizeRun: [],
    deleted: false,
    eta: eta ?? null,
  } as unknown as ProductSample
}

describe("computeShootReadiness", () => {
  it("returns empty for families with no data at all", () => {
    const families = [makeFamily({ id: "f1", styleName: "No data" })]
    const result = computeShootReadiness(families, new Map(), new Map())
    expect(result).toHaveLength(0)
  })

  it("includes families with launch date", () => {
    const families = [
      makeFamily({ id: "f1", styleName: "Sneaker", launchDate: ts(30 * DAY_MS) }),
    ]
    const skus = new Map([
      ["f1", [
        makeSku("s1", "f1", { ecomm_on_figure: "needed" }),
        makeSku("s2", "f1", { ecomm_on_figure: "delivered" }),
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
    expect(result[0]!.launchDate).not.toBeNull()
    expect(result[0]!.shootWindow).not.toBeNull()
  })

  it("includes families without launch date when they have samples", () => {
    const families = [makeFamily({ id: "f1", styleName: "No date, has samples" })]
    const samples = new Map([
      ["f1", [makeSample("sa1", "arrived")]],
    ])
    const result = computeShootReadiness(families, new Map(), samples)
    expect(result).toHaveLength(1)
    expect(result[0]!.launchDate).toBeNull()
  })

  it("includes families without launch date when they have request deadlines", () => {
    const families = [makeFamily({ id: "f1", styleName: "No date, has deadline" })]
    const deadlines = new Map([["f1", "2026-06-01"]])
    const result = computeShootReadiness(families, new Map(), new Map(), deadlines)
    expect(result).toHaveLength(1)
    expect(result[0]!.requestDeadline).toBe("2026-06-01")
  })

  it("excludes deleted skus and samples", () => {
    const families = [
      makeFamily({ id: "f1", styleName: "Boot", launchDate: ts(10 * DAY_MS) }),
    ]
    const skus = new Map([
      ["f1", [
        makeSku("s1", "f1", { ecomm_on_figure: "needed" }),
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

  it("returns 0% readiness when no samples exist but launch date is set", () => {
    const families = [
      makeFamily({ id: "f1", styleName: "Jacket", launchDate: ts(5 * DAY_MS) }),
    ]
    const result = computeShootReadiness(families, new Map(), new Map())
    expect(result[0]!.readinessPct).toBe(0)
  })
})

describe("computeSuggestedShootWindow", () => {
  it("returns null when no data at all", () => {
    const result = computeSuggestedShootWindow({
      launchDate: null,
      requestDeadline: null,
      samplesArrived: 0,
      samplesTotal: 0,
      earliestSampleEta: null,
    })
    expect(result).toBeNull()
  })

  it("returns a window with high confidence when all samples arrived and wide window", () => {
    const result = computeSuggestedShootWindow({
      launchDate: ts(60 * DAY_MS),
      requestDeadline: null,
      samplesArrived: 3,
      samplesTotal: 3,
      earliestSampleEta: null,
    })
    expect(result).not.toBeNull()
    expect(result!.confidence).toBe("high")
    expect(result!.tier).toBe("full")
    expect(result!.suggestedStart).not.toBeNull()
    expect(result!.suggestedEnd).not.toBeNull()
  })

  it("returns low confidence when deadline has passed", () => {
    const result = computeSuggestedShootWindow({
      launchDate: ts(-5 * DAY_MS),
      requestDeadline: null,
      samplesArrived: 0,
      samplesTotal: 2,
      earliestSampleEta: null,
    })
    expect(result).not.toBeNull()
    expect(result!.confidence).toBe("low")
  })

  it("uses request deadline when tighter than launch date", () => {
    const result = computeSuggestedShootWindow({
      launchDate: ts(60 * DAY_MS),
      requestDeadline: new Date(Date.now() + 10 * DAY_MS).toISOString(),
      samplesArrived: 2,
      samplesTotal: 2,
      earliestSampleEta: null,
    })
    expect(result).not.toBeNull()
    expect(result!.constraints).toContain("Shot request deadline is tighter constraint")
  })

  it("sets tier to request_only when only deadline exists", () => {
    const result = computeSuggestedShootWindow({
      launchDate: null,
      requestDeadline: new Date(Date.now() + 20 * DAY_MS).toISOString(),
      samplesArrived: 0,
      samplesTotal: 0,
      earliestSampleEta: null,
    })
    expect(result).not.toBeNull()
    expect(result!.tier).toBe("request_only")
  })

  it("sets tier to samples_only when only samples exist", () => {
    const result = computeSuggestedShootWindow({
      launchDate: null,
      requestDeadline: null,
      samplesArrived: 1,
      samplesTotal: 2,
      earliestSampleEta: ts(5 * DAY_MS),
    })
    expect(result).not.toBeNull()
    expect(result!.tier).toBe("samples_only")
  })

  it("uses sample ETA as earliest start", () => {
    const eta = ts(7 * DAY_MS)
    const result = computeSuggestedShootWindow({
      launchDate: ts(30 * DAY_MS),
      requestDeadline: null,
      samplesArrived: 1,
      samplesTotal: 3,
      earliestSampleEta: eta,
    })
    expect(result).not.toBeNull()
    expect(result!.constraints).toContain("Waiting on sample arrival")
  })
})

describe("sortByUrgency", () => {
  it("sorts by launch date ascending, then readiness ascending", () => {
    const items = [
      { familyId: "a", familyName: "Late", launchDate: ts(30 * DAY_MS), totalSkus: 1, skusWithFlags: 0, samplesArrived: 0, samplesTotal: 1, readinessPct: 50, shootWindow: null },
      { familyId: "b", familyName: "Soon", launchDate: ts(5 * DAY_MS), totalSkus: 1, skusWithFlags: 0, samplesArrived: 1, samplesTotal: 1, readinessPct: 100, shootWindow: null },
      { familyId: "c", familyName: "Soon2", launchDate: ts(5 * DAY_MS), totalSkus: 1, skusWithFlags: 0, samplesArrived: 0, samplesTotal: 2, readinessPct: 0, shootWindow: null },
    ]

    const sorted = sortByUrgency(items)
    expect(sorted.map((i) => i.familyId)).toEqual(["c", "b", "a"])
  })

  it("sorts items without launch dates to the end", () => {
    const items = [
      { familyId: "a", familyName: "No date", launchDate: null, totalSkus: 1, skusWithFlags: 0, samplesArrived: 1, samplesTotal: 1, readinessPct: 100, shootWindow: null },
      { familyId: "b", familyName: "Has date", launchDate: ts(5 * DAY_MS), totalSkus: 1, skusWithFlags: 0, samplesArrived: 0, samplesTotal: 1, readinessPct: 0, shootWindow: null },
    ]

    const sorted = sortByUrgency(items)
    expect(sorted.map((i) => i.familyId)).toEqual(["b", "a"])
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
