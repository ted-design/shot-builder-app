import { describe, it, expect } from "vitest"
import {
  estimatePlateHeight,
  estimateTagRowHeight,
  estimateWrappedLines,
  packShotSheets,
  COL_MAX,
  TAG_CHIPS_PER_PLATE_LINE,
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
  return {
    project: { name: "P", client: "C", shotCount: 0, dateRange: null },
    groups,
    order: { sortBy: "shot-number", sortDir: "asc" },
  }
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

// ---------------------------------------------------------------------------
// Tag-chip row (2026-08-17). This module drives BOTH the real image-led PDF
// pagination (reportPdf.tsx) and the DOM print preview's WYSIWYG packing
// (ReportView.buildSheets), so a rendered row with no term here desyncs the
// two AND can push a plate silently past COL_MAX.
// ---------------------------------------------------------------------------
describe("estimateTagRowHeight", () => {
  it("is 0 for no chips — a tagless plate estimates identically toggle on or off", () => {
    expect(estimateTagRowHeight(0)).toBe(0)
    expect(estimateTagRowHeight(-3)).toBe(0)
  })

  it("scales with chip count, not merely with presence", () => {
    const one = estimateTagRowHeight(1)
    const oneFullLine = estimateTagRowHeight(TAG_CHIPS_PER_PLATE_LINE)
    const threeLines = estimateTagRowHeight(TAG_CHIPS_PER_PLATE_LINE * 3)
    // Within a line the cost is flat (chips sit side by side)...
    expect(oneFullLine).toBe(one)
    // ...but wrapping to more lines must cost more, and by a wide margin.
    expect(threeLines).toBeGreaterThan(oneFullLine)
    expect(threeLines).toBeGreaterThan(oneFullLine * 2)
  })
})

describe("estimatePlateHeight — tag-chip term", () => {
  const tags = Array.from({ length: 4 }, (_, i) => ({
    id: `t${i}`,
    label: `Tag ${i}`,
    category: "other",
  }))

  it("defaults to NOT charging the row — every pre-existing caller/fixture estimates what it always has", () => {
    const tagged = shot("a", { tags })
    expect(estimatePlateHeight(tagged)).toBe(estimatePlateHeight(shot("a")))
  })

  it("charges the row when showTags is on AND the shot has chips", () => {
    const tagged = shot("a", { tags })
    expect(estimatePlateHeight(tagged, true)).toBeGreaterThan(estimatePlateHeight(tagged, false))
  })

  it("charges NOTHING when showTags is on but the shot has no chips", () => {
    expect(estimatePlateHeight(shot("a", { tags: [] }), true)).toBe(estimatePlateHeight(shot("a")))
    expect(estimatePlateHeight(shot("a"), true)).toBe(estimatePlateHeight(shot("a")))
  })

  it("charges MORE for more chips (a flat per-plate bump would fail this)", () => {
    const few = shot("a", { tags: tags.slice(0, 2) })
    const many = shot("a", {
      tags: Array.from({ length: TAG_CHIPS_PER_PLATE_LINE * 4 }, (_, i) => ({
        id: `t${i}`,
        label: `Tag ${i}`,
        category: "other",
      })),
    })
    expect(estimatePlateHeight(many, true)).toBeGreaterThan(estimatePlateHeight(few, true))
  })
})

describe("packShotSheets — showTags is threaded per shot, not per index", () => {
  it("defaults to packing without the tag term (byte-identical to pre-tag-chips)", () => {
    const tagged = (id: string) =>
      shot(id, {
        tags: Array.from({ length: 24 }, (_, i) => ({ id: `${id}-t${i}`, label: `Tag ${i}`, category: "other" })),
      })
    const m = model([group("Women", [tagged("1"), tagged("2"), tagged("3"), tagged("4")])])
    expect(packShotSheets(m)).toEqual(packShotSheets(m, false))
  })

  it("a plate that fits WITHOUT chips can be forced to solo WITH them (the term reaches the packer)", () => {
    // Deliberately sized so the tag row is what crosses COL_MAX: verify the
    // premise (fits without) before asserting the consequence (solos with), so
    // this can't pass vacuously on a fixture that was oversized all along.
    const chips = Array.from({ length: TAG_CHIPS_PER_PLATE_LINE * 12 }, (_, i) => ({
      id: `t${i}`,
      label: `Tag ${i}`,
      category: "other",
    }))
    const heavy = shot("heavy", { tags: chips })
    expect(estimatePlateHeight(heavy, false)).toBeLessThanOrEqual(COL_MAX)
    expect(estimatePlateHeight(heavy, true)).toBeGreaterThan(COL_MAX)

    const m = model([group("Women", [heavy, shot("plain")])])
    const packedOff = packShotSheets(m, false)
    const packedOn = packShotSheets(m, true)
    // Off: the two plates pair on one sheet. On: the tagged plate solos.
    expect(packedOff).toHaveLength(1)
    expect(packedOff[0]?.oversized).toBe(false)
    expect(packedOn).toHaveLength(2)
    expect(packedOn[0]?.oversized).toBe(true)
    expect(packedOn[0]?.leftColumn.map((s) => s.id)).toEqual(["heavy"])
  })

  it("EVERY shot is measured with the same showTags value (Array#map's index arg must not leak into it)", () => {
    // `visible.map(estimatePlateHeight)` would pass the array INDEX as the
    // second argument, so shot 0 packs with showTags:false (index 0 -> falsy)
    // and every later shot with a truthy index. This asserts the observable
    // consequence: with the term ON, a group of identically-tagged shots
    // produces the same per-sheet arrangement as their identical estimates
    // imply, and the FIRST shot is not the odd one out.
    const chips = Array.from({ length: TAG_CHIPS_PER_PLATE_LINE * 12 }, (_, i) => ({
      id: `t${i}`,
      label: `Tag ${i}`,
      category: "other",
    }))
    const shots = ["a", "b", "c"].map((id) => shot(id, { tags: chips }))
    const packed = packShotSheets(model([group("Women", shots)]), true)
    // All three are individually oversized, so all three solo. With the index
    // leaking in, shot "a" (index 0) would estimate WITHOUT the tag row, fit,
    // and pair with "b" — two sheets instead of three.
    expect(packed).toHaveLength(3)
    expect(packed.every((s) => s.oversized)).toBe(true)
  })
})
