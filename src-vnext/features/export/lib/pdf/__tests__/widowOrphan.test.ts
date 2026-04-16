import { describe, expect, it } from "vitest"
import { computeOrphanGroupIndex } from "../widowOrphan"

describe("computeOrphanGroupIndex", () => {
  it("returns -1 for empty arrays (no grouping needed)", () => {
    expect(computeOrphanGroupIndex(0)).toBe(-1)
  })

  it("returns -1 for 1 row (no orphan possible)", () => {
    expect(computeOrphanGroupIndex(1)).toBe(-1)
  })

  it("returns -1 for rows <= MIN_ROWS threshold (all fit together)", () => {
    expect(computeOrphanGroupIndex(3)).toBe(-1)
    expect(computeOrphanGroupIndex(4)).toBe(-1)
  })

  it("returns the start index of the last group for larger row counts", () => {
    // With MIN_ROWS_KEEP_TOGETHER = 4, for 10 rows the last group
    // should start at index 6 (rows 6,7,8,9 stay together)
    expect(computeOrphanGroupIndex(10)).toBe(6)
  })

  it("returns the start index for exactly MIN_ROWS + 1", () => {
    // 5 rows: last 4 should stay together, group starts at index 1
    expect(computeOrphanGroupIndex(5)).toBe(1)
  })

  it("returns the start index for large row counts", () => {
    // 50 rows: last 4 stay together, group starts at index 46
    expect(computeOrphanGroupIndex(50)).toBe(46)
  })

  it("returns the start index for exactly MIN_ROWS + 2", () => {
    // 6 rows: last 4 together, group at index 2
    expect(computeOrphanGroupIndex(6)).toBe(2)
  })
})
