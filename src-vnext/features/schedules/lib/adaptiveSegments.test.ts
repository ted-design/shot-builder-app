import { describe, it, expect } from "vitest"
import {
  buildAdaptiveLayout,
  computeMinCardHeight,
  computeCardHeight,
  formatTimeShort,
  type BannerSegment,
  type DenseBlock,
  type GapSegment,
} from "@/features/schedules/lib/adaptiveSegments"
import type {
  ProjectedScheduleRow,
  ScheduleProjection,
} from "@/features/schedules/lib/projection"
import type { ScheduleEntry, ScheduleTrack } from "@/shared/types"

// ─── Test Helpers ─────────────────────────────────────────────────────

function makeEntry(overrides: Partial<ScheduleEntry> & { id: string }): ScheduleEntry {
  return {
    type: "shot",
    title: overrides.title ?? `Entry ${overrides.id}`,
    order: 0,
    ...overrides,
  } as ScheduleEntry
}

function makeRow(overrides: {
  readonly id: string
  readonly startMin?: number | null
  readonly endMin?: number | null
  readonly durationMinutes?: number | null
  readonly trackId?: string
  readonly isBanner?: boolean
  readonly title?: string
  readonly type?: ScheduleEntry["type"]
}): ProjectedScheduleRow {
  const entry = makeEntry({
    id: overrides.id,
    title: overrides.title ?? `Entry ${overrides.id}`,
    type: overrides.type ?? "shot",
  })
  return {
    id: overrides.id,
    entry,
    trackId: overrides.trackId ?? "primary",
    isBanner: overrides.isBanner ?? false,
    appliesToTrackIds: overrides.isBanner ? ["primary"] : null,
    applicabilityKind: overrides.isBanner ? "all" : "single",
    startMin: overrides.startMin ?? null,
    endMin: overrides.endMin ?? null,
    durationMinutes: overrides.durationMinutes ?? null,
    timeSource: overrides.startMin != null ? "explicit" : "none",
  }
}

function makeProjection(
  rows: readonly ProjectedScheduleRow[],
  tracks?: readonly ScheduleTrack[],
): ScheduleProjection {
  return {
    mode: "time",
    tracks: tracks ?? [{ id: "primary", name: "Primary", order: 0 }],
    rows,
  }
}

const TWO_TRACKS: readonly ScheduleTrack[] = [
  { id: "photo", name: "Photo", order: 0 },
  { id: "video", name: "Video", order: 1 },
]

// ─── Tests ────────────────────────────────────────────────────────────

describe("buildAdaptiveLayout", () => {
  it("returns empty layout for no rows", () => {
    const result = buildAdaptiveLayout(makeProjection([]))
    expect(result.segments).toEqual([])
    expect(result.unscheduledRows).toEqual([])
  })

  it("puts untimed rows into unscheduledRows", () => {
    const rows = [
      makeRow({ id: "a", startMin: null }),
      makeRow({ id: "b", startMin: null }),
    ]
    const result = buildAdaptiveLayout(makeProjection(rows))
    expect(result.unscheduledRows).toHaveLength(2)
    expect(result.segments).toEqual([])
  })

  it("creates a single dense block for contiguous timed rows", () => {
    const rows = [
      makeRow({ id: "a", startMin: 420, endMin: 450, durationMinutes: 30, trackId: "primary" }),
      makeRow({ id: "b", startMin: 450, endMin: 480, durationMinutes: 30, trackId: "primary" }),
    ]
    const result = buildAdaptiveLayout(makeProjection(rows))

    expect(result.segments).toHaveLength(1)
    expect(result.segments[0]!.kind).toBe("dense")

    const block = result.segments[0] as DenseBlock
    expect(block.startMin).toBe(420)
    expect(block.endMin).toBe(480)

    const primaryRows = block.rowsByTrack.get("primary")
    expect(primaryRows).toHaveLength(2)
  })

  it("creates gap between non-contiguous blocks", () => {
    const rows = [
      makeRow({ id: "a", startMin: 420, endMin: 450, durationMinutes: 30 }),
      makeRow({ id: "b", startMin: 540, endMin: 570, durationMinutes: 30 }),
    ]
    const result = buildAdaptiveLayout(makeProjection(rows))

    expect(result.segments).toHaveLength(3)
    expect(result.segments[0]!.kind).toBe("dense")
    expect(result.segments[1]!.kind).toBe("gap")
    expect(result.segments[2]!.kind).toBe("dense")

    const gap = result.segments[1] as GapSegment
    expect(gap.startMin).toBe(450)
    expect(gap.endMin).toBe(540)
    expect(gap.label).toBe("1h 30m gap")
  })

  it("merges blocks within 5-min tolerance", () => {
    const rows = [
      makeRow({ id: "a", startMin: 420, endMin: 450, durationMinutes: 30 }),
      makeRow({ id: "b", startMin: 455, endMin: 485, durationMinutes: 30 }),
    ]
    const result = buildAdaptiveLayout(makeProjection(rows))

    // Should merge into one block (5-min gap <= 5-min tolerance)
    expect(result.segments).toHaveLength(1)
    expect(result.segments[0]!.kind).toBe("dense")

    const block = result.segments[0] as DenseBlock
    expect(block.startMin).toBe(420)
    expect(block.endMin).toBe(485)
  })

  it("places banners at their startMin position", () => {
    const rows = [
      makeRow({ id: "banner1", startMin: 360, endMin: 420, durationMinutes: 60, isBanner: true, title: "Load-In", type: "banner" }),
      makeRow({ id: "a", startMin: 420, endMin: 450, durationMinutes: 30 }),
    ]
    const result = buildAdaptiveLayout(makeProjection(rows))

    expect(result.segments).toHaveLength(2)
    expect(result.segments[0]!.kind).toBe("banner")
    expect(result.segments[1]!.kind).toBe("dense")

    const banner = result.segments[0] as BannerSegment
    expect(banner.startMin).toBe(360)
    expect(banner.durationMinutes).toBe(60)
    expect(banner.title).toBe("Load-In")
  })

  it("inserts gap between banner and dense block", () => {
    const rows = [
      makeRow({ id: "banner1", startMin: 360, endMin: 420, durationMinutes: 60, isBanner: true, title: "Load-In", type: "banner" }),
      makeRow({ id: "a", startMin: 480, endMin: 510, durationMinutes: 30 }),
    ]
    const result = buildAdaptiveLayout(makeProjection(rows))

    expect(result.segments).toHaveLength(3)
    expect(result.segments[0]!.kind).toBe("banner")
    expect(result.segments[1]!.kind).toBe("gap")
    expect(result.segments[2]!.kind).toBe("dense")

    const gap = result.segments[1] as GapSegment
    expect(gap.startMin).toBe(420)
    expect(gap.endMin).toBe(480)
  })

  it("assigns rows to correct tracks in multi-track layout", () => {
    const rows = [
      makeRow({ id: "p1", startMin: 420, endMin: 450, durationMinutes: 30, trackId: "photo" }),
      makeRow({ id: "v1", startMin: 420, endMin: 440, durationMinutes: 20, trackId: "video" }),
    ]
    const result = buildAdaptiveLayout(makeProjection(rows, TWO_TRACKS))

    expect(result.segments).toHaveLength(1)
    const block = result.segments[0] as DenseBlock
    expect(block.rowsByTrack.get("photo")).toHaveLength(1)
    expect(block.rowsByTrack.get("video")).toHaveLength(1)
  })

  it("creates the full mockup D scenario correctly", () => {
    const rows = [
      // Banner: Art Dept Load-In 6:00-7:00
      makeRow({ id: "banner-loadin", startMin: 360, endMin: 420, durationMinutes: 60, isBanner: true, title: "Art Department Load-In & Setup", type: "banner" }),
      // Dense Block 1: 7:00-8:10
      makeRow({ id: "SB-001", startMin: 420, endMin: 450, durationMinutes: 30, trackId: "photo" }),
      makeRow({ id: "SB-002", startMin: 450, endMin: 480, durationMinutes: 30, trackId: "photo" }),
      makeRow({ id: "SB-010", startMin: 420, endMin: 440, durationMinutes: 20, trackId: "video" }),
      makeRow({ id: "SB-011", startMin: 440, endMin: 455, durationMinutes: 15, trackId: "video" }),
      makeRow({ id: "SB-012", startMin: 455, endMin: 490, durationMinutes: 35, trackId: "video" }),
      // Moderate Block 2: 8:20-9:10 (10-min gap from block 1 to ensure separation)
      makeRow({ id: "SB-003", startMin: 500, endMin: 520, durationMinutes: 20, trackId: "photo" }),
      makeRow({ id: "SB-004", startMin: 520, endMin: 535, durationMinutes: 15, trackId: "photo" }),
      makeRow({ id: "SB-005", startMin: 535, endMin: 550, durationMinutes: 15, trackId: "photo" }),
      makeRow({ id: "SB-013", startMin: 505, endMin: 520, durationMinutes: 15, trackId: "video" }),
      makeRow({ id: "SB-014", startMin: 520, endMin: 540, durationMinutes: 20, trackId: "video" }),
      // Banner: Lunch 12:00-12:30
      makeRow({ id: "banner-lunch", startMin: 720, endMin: 750, durationMinutes: 30, isBanner: true, title: "Lunch Break", type: "banner" }),
    ]
    const result = buildAdaptiveLayout(makeProjection(rows, TWO_TRACKS))

    // Expected: banner, dense, gap, dense, gap, banner
    const kinds = result.segments.map((s) => s.kind)
    expect(kinds).toEqual(["banner", "dense", "gap", "dense", "gap", "banner"])

    // Dense block 1 should contain 5 shots (SB-001, SB-002, SB-010, SB-011, SB-012)
    const block1 = result.segments[1] as DenseBlock
    expect(block1.startMin).toBe(420)
    const photoCount1 = block1.rowsByTrack.get("photo")?.length ?? 0
    const videoCount1 = block1.rowsByTrack.get("video")?.length ?? 0
    expect(photoCount1).toBe(2)
    expect(videoCount1).toBe(3)

    // Dense block 2 should contain 5 shots
    const block2 = result.segments[3] as DenseBlock
    expect(block2.startMin).toBe(500)
    const photoCount2 = block2.rowsByTrack.get("photo")?.length ?? 0
    const videoCount2 = block2.rowsByTrack.get("video")?.length ?? 0
    expect(photoCount2).toBe(3)
    expect(videoCount2).toBe(2)

    // Both blocks should have appropriate pxPerMin (>=4)
    expect(block1.pxPerMin).toBeGreaterThanOrEqual(4)
    expect(block2.pxPerMin).toBeGreaterThanOrEqual(4)
  })

  it("handles single-track schedule", () => {
    const rows = [
      makeRow({ id: "a", startMin: 420, endMin: 450, durationMinutes: 30 }),
    ]
    const result = buildAdaptiveLayout(makeProjection(rows))

    expect(result.tracks).toHaveLength(1)
    expect(result.segments).toHaveLength(1)

    const block = result.segments[0] as DenseBlock
    expect(block.rowsByTrack.get("primary")).toHaveLength(1)
  })

  it("handles mix of timed and untimed rows", () => {
    const rows = [
      makeRow({ id: "a", startMin: 420, endMin: 450, durationMinutes: 30 }),
      makeRow({ id: "b", startMin: null }),
      makeRow({ id: "c", startMin: 480, endMin: 510, durationMinutes: 30 }),
    ]
    const result = buildAdaptiveLayout(makeProjection(rows))

    expect(result.unscheduledRows).toHaveLength(1)
    expect(result.unscheduledRows[0]!.id).toBe("b")
    expect(result.segments.filter((s) => s.kind === "dense")).toHaveLength(2)
  })

  it("returns only banners when no regular timed rows exist", () => {
    const rows = [
      makeRow({ id: "banner1", startMin: 360, endMin: 420, durationMinutes: 60, isBanner: true, title: "Setup", type: "banner" }),
    ]
    const result = buildAdaptiveLayout(makeProjection(rows))

    expect(result.segments).toHaveLength(1)
    expect(result.segments[0]!.kind).toBe("banner")
  })
})

describe("computeMinCardHeight", () => {
  it("returns base height when no metadata fields visible", () => {
    const result = computeMinCardHeight({
      showDescription: false,
      showProducts: false,
      showTalent: false,
      showLocation: false,
      showNotes: false,
      showTags: false,
    })
    expect(result).toBe(54) // BASE_CARD_HEIGHT only
  })

  it("adds up to 2 meta rows", () => {
    const result = computeMinCardHeight({
      showDescription: true,
      showProducts: true,
      showTalent: true,
      showLocation: true,
      showNotes: true,
      showTags: true,
    })
    expect(result).toBe(54 + 2 * 18) // 90px
  })

  it("adds 1 meta row when only 1 field visible", () => {
    const result = computeMinCardHeight({
      showDescription: false,
      showProducts: true,
      showTalent: false,
      showLocation: false,
      showNotes: false,
      showTags: false,
    })
    expect(result).toBe(54 + 1 * 18) // 72px
  })
})

describe("computeCardHeight", () => {
  const allFields = {
    showDescription: true,
    showProducts: true,
    showTalent: true,
    showLocation: true,
    showNotes: true,
    showTags: true,
  }

  it("uses natural height when larger than min", () => {
    // 30 min at 8px/min = 240px, min is 90px
    const result = computeCardHeight(30, 8, allFields)
    expect(result).toBe(240)
  })

  it("uses min height when natural is too small", () => {
    // 5 min at 4px/min = 20px, min is 90px
    const result = computeCardHeight(5, 4, allFields)
    expect(result).toBe(90)
  })
})

describe("formatTimeShort", () => {
  it("formats morning time without minutes", () => {
    expect(formatTimeShort(420)).toBe("7a") // 7:00 AM
  })

  it("formats morning time with minutes", () => {
    expect(formatTimeShort(435)).toBe("7:15a") // 7:15 AM
  })

  it("formats afternoon time", () => {
    expect(formatTimeShort(780)).toBe("1p") // 1:00 PM
  })

  it("formats noon", () => {
    expect(formatTimeShort(720)).toBe("12p") // 12:00 PM
  })

  it("formats midnight", () => {
    expect(formatTimeShort(0)).toBe("12a") // 12:00 AM
  })
})

describe("gap label formatting", () => {
  it("formats short gaps", () => {
    const rows = [
      makeRow({ id: "a", startMin: 420, endMin: 450, durationMinutes: 30 }),
      makeRow({ id: "b", startMin: 480, endMin: 510, durationMinutes: 30 }),
    ]
    const result = buildAdaptiveLayout(makeProjection(rows))
    const gap = result.segments.find((s) => s.kind === "gap") as GapSegment
    expect(gap.label).toBe("30 min gap")
  })

  it("formats hour-only gaps", () => {
    const rows = [
      makeRow({ id: "a", startMin: 420, endMin: 450, durationMinutes: 30 }),
      makeRow({ id: "b", startMin: 570, endMin: 600, durationMinutes: 30 }),
    ]
    const result = buildAdaptiveLayout(makeProjection(rows))
    const gap = result.segments.find((s) => s.kind === "gap") as GapSegment
    expect(gap.label).toBe("2h gap")
  })
})
