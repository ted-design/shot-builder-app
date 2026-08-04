import { describe, it, expect } from "vitest"
import {
  SORT_DIR_OPTIONS,
  compareByOrder,
  compareShotNumber,
  compareText,
  orderedBuckets,
  shotNumberSortKey,
  sortItemsStable,
} from "../reportSort"

describe("comparator primitives", () => {
  it("compareShotNumber is numeric-aware (2 before 10, not lexicographic)", () => {
    expect(compareShotNumber("2", "10")).toBeLessThan(0)
    expect(compareShotNumber("10", "2")).toBeGreaterThan(0)
    // non-numerics sort alpha AFTER numerics
    expect(compareShotNumber("A", "10")).toBeGreaterThan(0)
    expect(compareShotNumber("A", "B")).toBeLessThan(0)
  })

  it("shotNumberSortKey tags numerics [0,n,raw] and non-numerics [1,0,raw]", () => {
    expect(shotNumberSortKey("07")).toEqual([0, 7, "07"])
    expect(shotNumberSortKey("A1")).toEqual([1, 0, "A1"])
  })

  it("compareText is null-safe (nullish sorts as empty string)", () => {
    expect(compareText(null, "a")).toBeLessThan(0)
    expect(compareText("a", undefined)).toBeGreaterThan(0)
    expect(compareText(null, undefined)).toBe(0)
  })

  it("compareByOrder: knowns by index, unknowns after knowns, unknown ties alpha", () => {
    const order = ["todo", "complete"]
    expect(compareByOrder(order, "todo", "complete")).toBeLessThan(0)
    expect(compareByOrder(order, "complete", "todo")).toBeGreaterThan(0)
    expect(compareByOrder(order, "todo", "zzz-unknown")).toBeLessThan(0) // known before unknown
    expect(compareByOrder(order, "zzz-unknown", "todo")).toBeGreaterThan(0)
    expect(compareByOrder(order, "alpha", "beta")).toBeLessThan(0) // both unknown -> alpha
  })
})

describe("sortItemsStable", () => {
  const items = [
    { id: "a", k: 1, n: "10" },
    { id: "b", k: 1, n: "02" },
    { id: "c", k: 0, n: "03" },
  ]
  const primaryK = (x: { k: number }, y: { k: number }): number => x.k - y.k
  const tieByN = (x: { n: string }, y: { n: string }): number => compareShotNumber(x.n, y.n)

  it("orders by primary, breaking ties with the ALWAYS-ascending tie-break (numeric)", () => {
    const out = sortItemsStable(items, primaryK, tieByN, "asc")
    // k:0 first (c), then k:1 tie broken numeric 02(b) < 10(a)
    expect(out.map((x) => x.id)).toEqual(["c", "b", "a"])
  })

  it("desc flips the PRIMARY only; the tie-break stays ascending", () => {
    const out = sortItemsStable(items, primaryK, tieByN, "desc")
    // primary reversed: k:1 group first, but WITHIN it tie-break is still asc (02 before 10)
    expect(out.map((x) => x.id)).toEqual(["b", "a", "c"])
  })

  it("does not mutate the input array", () => {
    const input = [...items]
    sortItemsStable(input, primaryK, tieByN, "asc")
    expect(input.map((x) => x.id)).toEqual(["a", "b", "c"])
  })

  it("SORT_DIR_OPTIONS exposes asc + desc with labels", () => {
    expect(SORT_DIR_OPTIONS.map((o) => o.value)).toEqual(["asc", "desc"])
  })
})

describe("orderedBuckets", () => {
  const items = [
    { id: "s1", g: "complete" },
    { id: "s2", g: "todo" },
    { id: "s3", g: "complete" },
    { id: "s4", g: "todo" },
  ]
  const order = ["todo", "in_progress", "on_hold", "complete"]

  it("partitions in input order, sorts bucket keys, and DROPS empty buckets", () => {
    const buckets = orderedBuckets(
      items,
      (x) => x.g,
      (a, b) => compareByOrder(order, a, b),
      (k) => k.toUpperCase(),
    )
    // in_progress / on_hold never appear (empty); todo before complete
    expect(buckets.map((b) => b.key)).toEqual(["todo", "complete"])
    expect(buckets.map((b) => b.label)).toEqual(["TODO", "COMPLETE"])
    expect(buckets[0]?.items.map((x) => x.id)).toEqual(["s2", "s4"]) // input order preserved
    expect(buckets[1]?.count).toBe(2)
  })
})
