import { describe, it, expect } from "vitest"
import {
  buildShotsRow,
  buildCastingRow,
  buildPullsRow,
  buildCallSheetRow,
  buildExportRow,
  buildLedgerRows,
  type ShotStatusCounts,
} from "../ledgerData"
import type {
  CastingBoardEntry,
  Pull,
  PullItem,
  PullItemSize,
  Schedule,
  ScheduleEntry,
} from "@/shared/types"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function counts(over: Partial<ShotStatusCounts> = {}): ShotStatusCounts {
  return { todo: 0, in_progress: 0, on_hold: 0, complete: 0, ...over }
}

function castingEntry(over: Partial<CastingBoardEntry> = {}): CastingBoardEntry {
  return {
    id: "c1",
    talentId: "t1",
    talentName: "Talent",
    status: "shortlist",
    sortOrder: 0,
    addedBy: "u1",
    addedAt: null,
    updatedAt: null,
    ...over,
  }
}

function size(over: Partial<PullItemSize> = {}): PullItemSize {
  return { size: "M", quantity: 1, fulfilled: 0, ...over }
}

function pull(items: PullItem[]): Pull {
  return {
    id: "p1",
    projectId: "proj",
    clientId: "client",
    shotIds: [],
    items,
    status: "draft",
    shareEnabled: false,
    createdAt: {} as Pull["createdAt"],
    updatedAt: {} as Pull["updatedAt"],
  }
}

function pullItem(sizes: PullItemSize[]): PullItem {
  return { familyId: "f1", sizes, fulfillmentStatus: "pending" }
}

function schedule(id: string): Schedule {
  return {
    id,
    projectId: "proj",
    name: `Day ${id}`,
    date: null,
    createdAt: {} as Schedule["createdAt"],
    updatedAt: {} as Schedule["updatedAt"],
  }
}

function entry(type: ScheduleEntry["type"], order = 0): ScheduleEntry {
  return { id: `e${order}`, type, title: type, order }
}

// ---------------------------------------------------------------------------
// Shots row
// ---------------------------------------------------------------------------

describe("buildShotsRow", () => {
  it("produces 4 segments ordered done/progress/hold/todo with token colors", () => {
    const row = buildShotsRow({
      statusCounts: counts({ complete: 9, in_progress: 14, on_hold: 3, todo: 22 }),
      sceneCount: 6,
    })
    expect(row.key).toBe("shots")
    expect(row.count).toBe(48)
    expect(row.detail).toBe("48 shots · 6 scenes")
    expect(row.enabled).toBe(true)
    expect(row.segments.map((s) => [s.key, s.value])).toEqual([
      ["complete", 9],
      ["in_progress", 14],
      ["on_hold", 3],
      ["todo", 22],
    ])
    expect(row.segments[0].colorVar).toBe("--color-success")
    expect(row.segments[1].colorVar).toBe("--color-info")
    expect(row.segments[2].colorVar).toBe("--color-warning")
    expect(row.segments[3].colorVar).toBe("--color-surface-muted")
  })

  it("derives total from statusCounts when totalShots omitted", () => {
    const row = buildShotsRow({ statusCounts: counts({ todo: 5, complete: 1 }) })
    expect(row.count).toBe(6)
    expect(row.detail).toBe("6 shots")
  })

  it("collapses to a single muted empty segment when there are no shots", () => {
    const row = buildShotsRow({ statusCounts: counts() })
    expect(row.count).toBe(0)
    expect(row.segments).toHaveLength(1)
    expect(row.segments[0].colorVar).toBe("--color-surface-muted")
  })
})

// ---------------------------------------------------------------------------
// Casting row
// ---------------------------------------------------------------------------

describe("buildCastingRow", () => {
  it("segments by casting status and counts distinct roles", () => {
    const row = buildCastingRow([
      castingEntry({ id: "a", status: "booked", roleLabel: "Lead" }),
      castingEntry({ id: "b", status: "booked", roleLabel: "Lead" }),
      castingEntry({ id: "c", status: "hold", roleLabel: "Support" }),
      castingEntry({ id: "d", status: "shortlist", roleLabel: "" }),
    ])
    expect(row.key).toBe("casting")
    expect(row.count).toBe(4)
    // 2 distinct non-empty roleLabels (Lead, Support)
    expect(row.detail).toBe("2 roles · 4 on board")
    expect(row.segments.map((s) => [s.key, s.value])).toEqual([
      ["booked", 2],
      ["hold", 1],
      ["shortlist", 1],
      ["passed", 0],
    ])
  })

  it("degrades to empty segment + on-board-only meta when no entries", () => {
    const row = buildCastingRow([])
    expect(row.count).toBe(0)
    expect(row.segments).toHaveLength(1)
    expect(row.detail).toBe("0 on board")
  })
})

// ---------------------------------------------------------------------------
// Pulls row
// ---------------------------------------------------------------------------

describe("buildPullsRow", () => {
  it("aggregates sample sizes into arrived/in-transit/pending buckets", () => {
    const p = pull([
      pullItem([
        size({ status: "fulfilled" }),
        size({ status: "fulfilled" }),
        size({ status: "partial" }),
      ]),
      pullItem([size({ status: "substituted" }), size({ status: "pending" }), size({})]),
    ])
    const row = buildPullsRow([p])
    expect(row.key).toBe("pulls")
    expect(row.count).toBe(1) // one pull
    expect(row.detail).toBe("1 pull · 6 SKUs")
    expect(row.segments.map((s) => [s.key, s.value])).toEqual([
      ["arrived", 2],
      ["in_transit", 2], // partial + substituted
      ["pending", 2], // explicit pending + missing status default
    ])
  })

  it("degrades when there are pulls but no sample sizes", () => {
    const row = buildPullsRow([pull([pullItem([])])])
    expect(row.count).toBe(1)
    expect(row.segments).toHaveLength(1)
    expect(row.detail).toBe("1 pull")
  })
})

// ---------------------------------------------------------------------------
// Call sheet row
// ---------------------------------------------------------------------------

describe("buildCallSheetRow", () => {
  it("counts shoot days and placed vs other blocks", () => {
    const row = buildCallSheetRow({
      schedules: [schedule("1")],
      entries: [
        entry("shot", 0),
        entry("setup", 1),
        entry("move", 2),
        entry("break", 3),
        entry("banner", 4),
      ],
    })
    expect(row.key).toBe("callsheet")
    expect(row.count).toBe(1)
    expect(row.detail).toBe("1 shoot day · 5 blocks")
    expect(row.segments.map((s) => [s.key, s.value])).toEqual([
      ["placed", 3], // shot + setup + move
      ["other", 2], // break + banner
    ])
    expect(row.enabled).toBe(true)
  })

  it("degrades and disables when no schedule exists", () => {
    const row = buildCallSheetRow({ schedules: [] })
    expect(row.count).toBe(0)
    expect(row.enabled).toBe(false)
    expect(row.detail).toBe("No schedule yet")
    expect(row.segments).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Export row (gated)
// ---------------------------------------------------------------------------

describe("buildExportRow", () => {
  it("is gated/disabled until at least one shot is complete", () => {
    const row = buildExportRow(counts({ todo: 10, in_progress: 4 }))
    expect(row.key).toBe("export")
    expect(row.enabled).toBe(false)
    expect(row.count).toBe(0)
    expect(row.detail).toBe("After shoot · not started")
    expect(row.segments).toHaveLength(1)
    expect(row.segments[0].colorVar).toBe("--color-surface-muted")
  })

  it("opens once a shot is complete", () => {
    const row = buildExportRow(counts({ complete: 3 }))
    expect(row.enabled).toBe(true)
    expect(row.count).toBe(3)
    expect(row.detail).toBe("3 shots ready")
    expect(row.segments[0].colorVar).toBe("--color-success")
  })
})

// ---------------------------------------------------------------------------
// Top-level assembler
// ---------------------------------------------------------------------------

describe("buildLedgerRows", () => {
  it("returns the five ledger rows in mockup order", () => {
    const rows = buildLedgerRows({
      statusCounts: counts({ complete: 1, todo: 2 }),
      sceneCount: 2,
      castingEntries: [castingEntry()],
      pulls: [pull([pullItem([size({ status: "fulfilled" })])])],
      schedules: [schedule("1")],
      scheduleEntries: [entry("shot")],
    })
    expect(rows.map((r) => r.key)).toEqual([
      "shots",
      "casting",
      "pulls",
      "callsheet",
      "export",
    ])
  })

  it("never mutates the input arrays", () => {
    const castingEntries = [castingEntry()]
    const frozen = Object.freeze([...castingEntries])
    expect(() => buildCastingRow(frozen)).not.toThrow()
  })
})
