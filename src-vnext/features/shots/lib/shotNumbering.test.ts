import { describe, it, expect } from "vitest"
import {
  computeMaxShotNumber,
  formatShotNumber,
  nextShotNumber,
  previewRenumber,
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

describe("previewRenumber", () => {
  it("returns 0 changes when shots are already sequential", () => {
    const shots = [
      makeShot({ id: "a", shotNumber: "01", sortOrder: 0 }),
      makeShot({ id: "b", shotNumber: "02", sortOrder: 1 }),
      makeShot({ id: "c", shotNumber: "03", sortOrder: 2 }),
    ]
    const result = previewRenumber(shots)
    expect(result.changes).toHaveLength(0)
    expect(result.unchangedCount).toBe(3)
  })

  it("detects gaps in shot numbers", () => {
    const shots = [
      makeShot({ id: "a", shotNumber: "02", sortOrder: 0 }),
      makeShot({ id: "b", shotNumber: "05", sortOrder: 1 }),
      makeShot({ id: "c", shotNumber: "06", sortOrder: 2 }),
      makeShot({ id: "d", shotNumber: "10", sortOrder: 3 }),
    ]
    const result = previewRenumber(shots)
    expect(result.changes).toHaveLength(4)
    expect(result.changes[0]).toEqual({
      shotId: "a",
      title: "Test",
      currentNumber: "02",
      newNumber: "01",
    })
    expect(result.changes[1]).toEqual({
      shotId: "b",
      title: "Test",
      currentNumber: "05",
      newNumber: "02",
    })
    expect(result.changes[3]).toEqual({
      shotId: "d",
      title: "Test",
      currentNumber: "10",
      newNumber: "04",
    })
    expect(result.unchangedCount).toBe(0)
  })

  it("handles shots missing shotNumber", () => {
    const shots = [
      makeShot({ id: "a", shotNumber: null, sortOrder: 0 }),
      makeShot({ id: "b", shotNumber: "02", sortOrder: 1 }),
    ]
    const result = previewRenumber(shots)
    // Shot "a" has null shotNumber -> needs "01", shot "b" already has "02" and sortOrder 1
    expect(result.changes).toHaveLength(1)
    expect(result.changes[0]).toEqual({
      shotId: "a",
      title: "Test",
      currentNumber: "\u2014",
      newNumber: "01",
    })
    expect(result.unchangedCount).toBe(1)
  })

  it("uses Untitled for shots without a title", () => {
    const shots = [
      makeShot({ id: "a", title: "", shotNumber: "05", sortOrder: 0 }),
    ]
    const result = previewRenumber(shots)
    expect(result.changes[0]!.title).toBe("Untitled")
  })

  it("detects mismatched sortOrder even when shotNumber is correct", () => {
    const shots = [
      makeShot({ id: "a", shotNumber: "01", sortOrder: 5 }),
      makeShot({ id: "b", shotNumber: "02", sortOrder: 10 }),
    ]
    const result = previewRenumber(shots)
    expect(result.changes).toHaveLength(2)
    expect(result.unchangedCount).toBe(0)
  })

  it("returns empty changes for empty array", () => {
    const result = previewRenumber([])
    expect(result.changes).toHaveLength(0)
    expect(result.unchangedCount).toBe(0)
  })

  it("mixes unchanged and changed shots correctly", () => {
    const shots = [
      makeShot({ id: "a", shotNumber: "01", sortOrder: 0 }),
      makeShot({ id: "b", shotNumber: "05", sortOrder: 1 }),
      makeShot({ id: "c", shotNumber: "06", sortOrder: 2 }),
    ]
    const result = previewRenumber(shots)
    // "a" is correct (01, sortOrder 0). "b" needs 02 not 05. "c" needs 03 not 06.
    expect(result.unchangedCount).toBe(1)
    expect(result.changes).toHaveLength(2)
    expect(result.changes[0]!.shotId).toBe("b")
    expect(result.changes[0]!.newNumber).toBe("02")
    expect(result.changes[1]!.shotId).toBe("c")
    expect(result.changes[1]!.newNumber).toBe("03")
  })
})
