import { describe, it, expect } from "vitest"
import {
  estimatePlateHeight,
  estimateWrappedLines,
  packShotSheets,
  COL_MAX,
} from "../reportPdfHeights"
import type {
  ReportModel,
  ReportGroup,
  ReportShot,
  ReportLook,
  ReportProduct,
} from "../reportTypes"

// --- Minimal factories (only the fields the packer/estimator read) ---
function product(over: Partial<ReportProduct> = {}): ReportProduct {
  return {
    family: "Family",
    style: null,
    colour: null,
    size: null,
    sizeScope: null,
    qty: 1,
    gender: "W",
    isHero: false,
    img: null,
    ...over,
  }
}
function look(over: Partial<ReportLook> = {}): ReportLook {
  return {
    id: "look",
    label: "Primary",
    isAlt: false,
    image: "ref", // present figure by default (estimator keys off looks[0].image)
    hasReference: false,
    products: [product()],
    ...over,
  }
}
function shot(id: string, over: Partial<ReportShot> = {}): ReportShot {
  return {
    id,
    number: id,
    title: "A shot",
    colorway: null,
    status: "todo",
    gender: "W",
    notes: null,
    talent: [],
    looks: [look()],
    excluded: false,
    hasImage: true,
    ...over,
  }
}
function group(label: string, shots: ReportShot[], over: Partial<ReportGroup> = {}): ReportGroup {
  return { key: "W", label, count: shots.length, shots, ...over }
}
function model(groups: ReportGroup[]): ReportModel {
  return { project: { name: "P", client: "C", shotCount: 0, dateRange: null }, groups }
}

/** A deliberately huge shot whose estimate exceeds a single column. */
function hugeShot(id: string): ReportShot {
  const products = Array.from({ length: 30 }, (_, i) => product({ family: `Fam ${i}` }))
  return shot(id, {
    title: "A very long shot title that wraps across several lines on the plate",
    colorway: "Some colourway",
    notes: "A long note ".repeat(20),
    looks: [look({ products }), look({ id: "alt", isAlt: true, label: "Alt A", products })],
    hasImage: true,
  })
}

// Safe indexed access (repo uses noUncheckedIndexedAccess).
function at<T>(arr: readonly T[], i: number): T {
  const v = arr[i]
  if (v === undefined) throw new Error(`index ${i} out of range (len ${arr.length})`)
  return v
}

// Walk every sheet's plates in render order (left column top-down, then right).
function placedInOrder(sheets: ReturnType<typeof packShotSheets>): ReportShot[] {
  return sheets.flatMap((s) => [...s.leftColumn, ...s.rightColumn])
}

describe("estimateWrappedLines", () => {
  it("returns at least 1 line for any non-empty text, clamped to maxLines", () => {
    expect(estimateWrappedLines("hi", 300, 14, 3)).toBe(1)
    expect(estimateWrappedLines("x".repeat(1000), 300, 14, 3)).toBe(3)
  })
})

describe("estimatePlateHeight", () => {
  it("is larger with a figure than without (image dominates; keyed off the look image)", () => {
    expect(estimatePlateHeight(shot("a", { looks: [look({ image: "ref" })] }))).toBeGreaterThan(
      estimatePlateHeight(shot("a", { looks: [look({ image: null })] })),
    )
  })
  it("grows with more products, notes, and alt looks", () => {
    const base = estimatePlateHeight(shot("a"))
    const more = estimatePlateHeight(
      shot("a", { looks: [look({ products: [product(), product(), product()] })] }),
    )
    expect(more).toBeGreaterThan(base)
    expect(estimatePlateHeight(shot("a", { notes: "lots of notes ".repeat(10) }))).toBeGreaterThan(base)
    expect(
      estimatePlateHeight(shot("a", { looks: [look(), look({ id: "alt", isAlt: true })] })),
    ).toBeGreaterThan(base)
  })
})

describe("packShotSheets — structural invariants", () => {
  const m = model([
    group("Women", [shot("1"), shot("2"), shot("3"), shot("4"), shot("5")]),
    group("Men", [shot("6"), shot("7"), shot("8")], { key: "M" }),
  ])
  const sheets = packShotSheets(m)

  it("places every non-excluded shot exactly once, in original order", () => {
    const placed = placedInOrder(sheets).map((s) => s.id)
    expect(placed).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"])
  })

  it("never emits a sheet with zero shots", () => {
    for (const s of sheets) {
      expect(s.leftColumn.length + s.rightColumn.length).toBeGreaterThan(0)
    }
  })

  it("keeps every plate on a normal sheet within one page, at most two per sheet", () => {
    for (const s of sheets) {
      if (s.oversized) continue
      expect(s.leftColumn).toHaveLength(1)
      expect(s.rightColumn.length).toBeLessThanOrEqual(1)
      for (const shot of [...s.leftColumn, ...s.rightColumn]) {
        expect(estimatePlateHeight(shot)).toBeLessThanOrEqual(COL_MAX)
      }
    }
  })

  it("never spans a gender group within one sheet", () => {
    for (const s of sheets) {
      const ids = [...s.leftColumn, ...s.rightColumn].map((x) => x.id)
      const groupIds = s.group.shots.map((x) => x.id)
      for (const id of ids) expect(groupIds).toContain(id)
    }
  })

  it("derives the header range from the shots actually placed (contiguous, complete)", () => {
    const labels = [...new Set(sheets.map((s) => s.group.label))]
    for (const label of labels) {
      const arr = sheets.filter((s) => s.group.label === label)
      let expectedFirst = 1
      for (const s of arr) {
        const placedCount = s.leftColumn.length + s.rightColumn.length
        expect(s.firstPosition).toBe(expectedFirst)
        expect(s.lastPosition - s.firstPosition + 1).toBe(placedCount)
        expectedFirst = s.lastPosition + 1
      }
      const last = at(arr, arr.length - 1)
      expect(last.lastPosition).toBe(last.groupShotCount)
    }
  })
})

describe("packShotSheets — behaviour", () => {
  it("packs normal image shots two-up (one per column)", () => {
    const sheets = packShotSheets(model([group("Women", [shot("1"), shot("2"), shot("3"), shot("4")])]))
    expect(sheets).toHaveLength(2)
    for (const s of sheets) {
      expect(s.leftColumn).toHaveLength(1)
      expect(s.rightColumn).toHaveLength(1)
    }
  })

  it("gives an over-tall shot its own oversized page (empty right column)", () => {
    const sheets = packShotSheets(model([group("Women", [hugeShot("big")])]))
    expect(sheets).toHaveLength(1)
    const s = at(sheets, 0)
    expect(s.oversized).toBe(true)
    expect(s.leftColumn).toHaveLength(1)
    expect(s.rightColumn).toHaveLength(0)
    expect(estimatePlateHeight(at(s.leftColumn, 0))).toBeGreaterThan(COL_MAX)
  })

  it("never pairs an oversized shot — it sits alone between its neighbours, in order", () => {
    const sheets = packShotSheets(model([group("Women", [shot("1"), hugeShot("2"), shot("3")])]))
    expect(placedInOrder(sheets).map((s) => s.id)).toEqual(["1", "2", "3"])
    const oversized = sheets.filter((s) => s.oversized)
    expect(oversized).toHaveLength(1)
    expect(at(oversized, 0).leftColumn.map((s) => s.id)).toEqual(["2"])
    expect(sheets.some((s) => s.rightColumn.some((x) => x.id === "2"))).toBe(false)
  })

  it("drops excluded shots and skips an all-excluded group entirely", () => {
    const sheets = packShotSheets(
      model([
        group("Women", [shot("1"), shot("2", { excluded: true }), shot("3")]),
        group("Men", [shot("4", { excluded: true })], { key: "M" }),
      ]),
    )
    const placed = placedInOrder(sheets).map((s) => s.id)
    expect(placed).toEqual(["1", "3"])
    expect(sheets.every((s) => s.group.label !== "Men")).toBe(true)
    expect(at(sheets, 0).groupShotCount).toBe(2) // visible count, not raw group size
  })

  it("orphans the trailing shot of an odd group on its own (final) half-page", () => {
    const sheets = packShotSheets(model([group("Women", [shot("1"), shot("2"), shot("3")])]))
    expect(sheets).toHaveLength(2)
    const last = at(sheets, 1)
    expect(last.leftColumn).toHaveLength(1)
    expect(last.rightColumn).toHaveLength(0)
    expect(last.firstPosition).toBe(3)
    expect(last.lastPosition).toBe(3)
  })
})
