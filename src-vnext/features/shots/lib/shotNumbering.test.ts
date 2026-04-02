import { describe, it, expect } from "vitest"
import {
  computeMaxShotNumber,
  formatShotNumber,
  nextShotNumber,
} from "./shotNumbering"
import type { Shot } from "@/shared/types"

function makeShot(overrides: Partial<Shot> = {}): Shot {
  return {
    id: "shot-1",
    title: "Test",
    description: null,
    projectId: "proj-1",
    clientId: "client-1",
    status: "todo",
    talent: [],
    products: [],
    sortOrder: 1,
    shotNumber: null,
    date: null,
    deleted: false,
    notes: null,
    referenceLinks: [],
    createdAt: null,
    updatedAt: null,
    createdBy: "user-1",
    ...overrides,
  } as Shot
}

describe("computeMaxShotNumber", () => {
  it("returns 0 for empty array", () => {
    expect(computeMaxShotNumber([])).toBe(0)
  })

  it("returns 0 when no shots have shot numbers", () => {
    const shots = [makeShot(), makeShot({ id: "shot-2" })]
    expect(computeMaxShotNumber(shots)).toBe(0)
  })

  it("extracts numeric suffix from SH-### format", () => {
    const shots = [
      makeShot({ shotNumber: "SH-001" }),
      makeShot({ id: "s2", shotNumber: "SH-005" }),
      makeShot({ id: "s3", shotNumber: "SH-003" }),
    ]
    expect(computeMaxShotNumber(shots)).toBe(5)
  })

  it("handles mixed — some with numbers, some without", () => {
    const shots = [
      makeShot({ shotNumber: "SH-010" }),
      makeShot({ id: "s2", shotNumber: null }),
      makeShot({ id: "s3", shotNumber: "SH-007" }),
    ]
    expect(computeMaxShotNumber(shots)).toBe(10)
  })

  it("handles numbers > 999", () => {
    const shots = [makeShot({ shotNumber: "SH-1234" })]
    expect(computeMaxShotNumber(shots)).toBe(1234)
  })
})

describe("formatShotNumber", () => {
  it("pads single digit to 2 characters", () => {
    expect(formatShotNumber(1)).toBe("01")
  })

  it("keeps double digit as-is", () => {
    expect(formatShotNumber(42)).toBe("42")
  })

  it("keeps triple digit as-is", () => {
    expect(formatShotNumber(100)).toBe("100")
  })

  it("does not truncate numbers > 999", () => {
    expect(formatShotNumber(1000)).toBe("1000")
  })
})

describe("nextShotNumber", () => {
  it("returns 01 for empty project", () => {
    expect(nextShotNumber([])).toBe("01")
  })

  it("increments from the highest existing number", () => {
    const shots = [
      makeShot({ shotNumber: "SH-003" }),
      makeShot({ id: "s2", shotNumber: "SH-007" }),
    ]
    expect(nextShotNumber(shots)).toBe("08")
  })

  it("increments from new-format numbers", () => {
    const shots = [
      makeShot({ shotNumber: "03" }),
      makeShot({ id: "s2", shotNumber: "07" }),
    ]
    expect(nextShotNumber(shots)).toBe("08")
  })
})
