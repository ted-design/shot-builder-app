import { describe, it, expect } from "vitest"
import {
  formatShotNumber,
  computeMaxShotNumber,
  nextShotNumber,
  previewRenumber,
  suggestStartNumber,
} from "../shotNumbering"
import type { Shot } from "@/shared/types"

// ---------------------------------------------------------------------------
// Helpers — mirrors the pattern in the sibling shotNumbering.test.ts
// ---------------------------------------------------------------------------

function makeShot(overrides: Partial<Shot> & { id: string }): Shot {
  return {
    title: "Test",
    description: null,
    projectId: "proj-1",
    clientId: "client-1",
    status: "todo",
    talent: [],
    products: [],
    sortOrder: 0,
    shotNumber: undefined,
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

// ---------------------------------------------------------------------------
// formatShotNumber — large numbers
// ---------------------------------------------------------------------------

describe("formatShotNumber", () => {
  it("pads single digits to 2 characters", () => {
    expect(formatShotNumber(1)).toBe("01")
    expect(formatShotNumber(9)).toBe("09")
  })

  it("keeps double digits as-is", () => {
    expect(formatShotNumber(42)).toBe("42")
    expect(formatShotNumber(10)).toBe("10")
  })

  it("handles large numbers without padding", () => {
    expect(formatShotNumber(100)).toBe("100")
    expect(formatShotNumber(999)).toBe("999")
    expect(formatShotNumber(1234)).toBe("1234")
  })
})

// ---------------------------------------------------------------------------
// computeMaxShotNumber
// ---------------------------------------------------------------------------

describe("computeMaxShotNumber", () => {
  it("returns 0 for empty array", () => {
    expect(computeMaxShotNumber([])).toBe(0)
  })

  it("returns 0 when no shots have numbers", () => {
    const shots = [
      makeShot({ id: "a" }),
      makeShot({ id: "b" }),
    ]
    expect(computeMaxShotNumber(shots)).toBe(0)
  })

  it("extracts the highest numeric suffix", () => {
    const shots = [
      makeShot({ id: "a", shotNumber: "03" }),
      makeShot({ id: "b", shotNumber: "15" }),
      makeShot({ id: "c", shotNumber: "07" }),
    ]
    expect(computeMaxShotNumber(shots)).toBe(15)
  })

  it("handles legacy SH- prefix format", () => {
    const shots = [
      makeShot({ id: "a", shotNumber: "SH-005" }),
      makeShot({ id: "b", shotNumber: "10" }),
    ]
    expect(computeMaxShotNumber(shots)).toBe(10)
  })
})

// ---------------------------------------------------------------------------
// nextShotNumber
// ---------------------------------------------------------------------------

describe("nextShotNumber", () => {
  it("returns 01 for empty array", () => {
    expect(nextShotNumber([])).toBe("01")
  })

  it("returns max + 1 formatted", () => {
    const shots = [
      makeShot({ id: "a", shotNumber: "05" }),
      makeShot({ id: "b", shotNumber: "03" }),
    ]
    expect(nextShotNumber(shots)).toBe("06")
  })
})

// ---------------------------------------------------------------------------
// previewRenumber — default startNumber (1)
// ---------------------------------------------------------------------------

describe("previewRenumber", () => {
  it("returns no changes when already sequential from 1", () => {
    const shots = [
      makeShot({ id: "a", shotNumber: "01", sortOrder: 0 }),
      makeShot({ id: "b", shotNumber: "02", sortOrder: 1 }),
      makeShot({ id: "c", shotNumber: "03", sortOrder: 2 }),
    ]
    const { changes, unchangedCount } = previewRenumber(shots)
    expect(changes).toHaveLength(0)
    expect(unchangedCount).toBe(3)
  })

  it("detects out-of-order numbering", () => {
    const shots = [
      makeShot({ id: "a", shotNumber: "03", sortOrder: 0 }),
      makeShot({ id: "b", shotNumber: "01", sortOrder: 1 }),
    ]
    const { changes } = previewRenumber(shots)
    expect(changes).toHaveLength(2)
    expect(changes[0]!.currentNumber).toBe("03")
    expect(changes[0]!.newNumber).toBe("01")
    expect(changes[1]!.currentNumber).toBe("01")
    expect(changes[1]!.newNumber).toBe("02")
  })

  it("uses custom startNumber", () => {
    const shots = [
      makeShot({ id: "a", shotNumber: "01", sortOrder: 0 }),
      makeShot({ id: "b", shotNumber: "02", sortOrder: 1 }),
      makeShot({ id: "c", shotNumber: "03", sortOrder: 2 }),
    ]
    const { changes } = previewRenumber(shots, 30)
    expect(changes).toHaveLength(3)
    expect(changes[0]!.newNumber).toBe("30")
    expect(changes[1]!.newNumber).toBe("31")
    expect(changes[2]!.newNumber).toBe("32")
  })

  it("handles startNumber that results in unchanged numbers", () => {
    const shots = [
      makeShot({ id: "a", shotNumber: "05", sortOrder: 0 }),
      makeShot({ id: "b", shotNumber: "06", sortOrder: 1 }),
    ]
    const { changes, unchangedCount } = previewRenumber(shots, 5)
    expect(changes).toHaveLength(0)
    expect(unchangedCount).toBe(2)
  })

  it("shows em-dash for shots without a number", () => {
    const shots = [
      makeShot({ id: "a", sortOrder: 0 }),
    ]
    const { changes } = previewRenumber(shots)
    expect(changes[0]!.currentNumber).toBe("\u2014")
    expect(changes[0]!.newNumber).toBe("01")
  })
})

// ---------------------------------------------------------------------------
// suggestStartNumber
// ---------------------------------------------------------------------------

describe("suggestStartNumber", () => {
  it("returns 1 when all shots are shown (no filter)", () => {
    const all = [
      makeShot({ id: "a", shotNumber: "01" }),
      makeShot({ id: "b", shotNumber: "02" }),
    ]
    expect(suggestStartNumber(all, all)).toBe(1)
  })

  it("returns max hidden + 1 when subset is shown", () => {
    const all = [
      makeShot({ id: "a", shotNumber: "05" }),
      makeShot({ id: "b", shotNumber: "10" }),
      makeShot({ id: "c", shotNumber: "03" }),
    ]
    // Only shot "c" is visible; "a" and "b" are hidden
    const filtered = [all[2]!]
    expect(suggestStartNumber(all, filtered)).toBe(11) // max(5, 10) + 1
  })

  it("returns 1 when hidden shots have no numbers", () => {
    const all = [
      makeShot({ id: "a" }),
      makeShot({ id: "b", shotNumber: "03" }),
    ]
    const filtered = [all[1]!]
    expect(suggestStartNumber(all, filtered)).toBe(1) // hidden shot "a" has no number
  })

  it("returns 1 when filtered array is empty but equals all (both empty)", () => {
    expect(suggestStartNumber([], [])).toBe(1)
  })

  it("handles single hidden shot with a number", () => {
    const all = [
      makeShot({ id: "a", shotNumber: "07" }),
      makeShot({ id: "b", shotNumber: "02" }),
    ]
    const filtered = [all[1]!]
    expect(suggestStartNumber(all, filtered)).toBe(8) // max hidden = 7
  })
})
