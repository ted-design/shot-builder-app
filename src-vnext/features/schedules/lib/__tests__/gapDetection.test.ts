import { describe, expect, it } from "vitest"
import { detectScheduleGaps, type ScheduleGap } from "../gapDetection"
import type { ProjectedScheduleRow } from "../projection"

function makeRow(overrides: {
  id: string
  trackId: string
  startMin: number | null
  endMin: number | null
}): ProjectedScheduleRow {
  return {
    id: overrides.id,
    entry: { id: overrides.id, type: "shot", title: "Shot", order: 0 } as any,
    trackId: overrides.trackId,
    isBanner: false,
    appliesToTrackIds: null,
    applicabilityKind: "single",
    startMin: overrides.startMin,
    endMin: overrides.endMin,
    durationMinutes:
      overrides.endMin != null && overrides.startMin != null
        ? overrides.endMin - overrides.startMin
        : null,
    timeSource: "explicit",
  }
}

describe("detectScheduleGaps", () => {
  it("returns empty for no rows", () => {
    const result = detectScheduleGaps([])
    expect(result).toEqual([])
  })

  it("returns empty when entries are contiguous", () => {
    const rows = [
      makeRow({ id: "r1", trackId: "a", startMin: 420, endMin: 450 }),
      makeRow({ id: "r2", trackId: "a", startMin: 450, endMin: 480 }),
    ]
    const result = detectScheduleGaps(rows)
    expect(result).toEqual([])
  })

  it("detects a gap > 30min between entries on the same track", () => {
    const rows = [
      makeRow({ id: "r1", trackId: "a", startMin: 420, endMin: 450 }),
      makeRow({ id: "r2", trackId: "a", startMin: 510, endMin: 540 }),
    ]
    const result = detectScheduleGaps(rows)
    expect(result).toEqual([
      { trackId: "a", startMin: 450, endMin: 510, durationMinutes: 60 },
    ])
  })

  it("ignores gaps <= 30min (default threshold)", () => {
    const rows = [
      makeRow({ id: "r1", trackId: "a", startMin: 420, endMin: 450 }),
      makeRow({ id: "r2", trackId: "a", startMin: 470, endMin: 500 }),
    ]
    const result = detectScheduleGaps(rows)
    expect(result).toEqual([])
  })

  it("uses custom minGapMinutes threshold", () => {
    const rows = [
      makeRow({ id: "r1", trackId: "a", startMin: 420, endMin: 450 }),
      makeRow({ id: "r2", trackId: "a", startMin: 470, endMin: 500 }),
    ]
    const result = detectScheduleGaps(rows, { minGapMinutes: 15 })
    expect(result).toEqual([
      { trackId: "a", startMin: 450, endMin: 470, durationMinutes: 20 },
    ])
  })

  it("detects gaps per track independently", () => {
    const rows = [
      makeRow({ id: "r1", trackId: "a", startMin: 420, endMin: 450 }),
      makeRow({ id: "r2", trackId: "a", startMin: 510, endMin: 540 }),
      makeRow({ id: "r3", trackId: "b", startMin: 420, endMin: 480 }),
    ]
    const result = detectScheduleGaps(rows)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      trackId: "a",
      startMin: 450,
      endMin: 510,
      durationMinutes: 60,
    })
  })

  it("skips rows with null startMin or endMin", () => {
    const rows = [
      makeRow({ id: "r1", trackId: "a", startMin: null, endMin: 450 }),
      makeRow({ id: "r2", trackId: "a", startMin: 420, endMin: 450 }),
      makeRow({ id: "r3", trackId: "a", startMin: 510, endMin: null }),
      makeRow({ id: "r4", trackId: "a", startMin: 520, endMin: 540 }),
    ]
    const result = detectScheduleGaps(rows)
    // Only r2 (420-450) and r4 (520-540) are usable → 70min gap > 30
    expect(result).toEqual([
      { trackId: "a", startMin: 450, endMin: 520, durationMinutes: 70 },
    ])
  })

  it("handles multiple gaps on the same track", () => {
    const rows = [
      makeRow({ id: "r1", trackId: "a", startMin: 420, endMin: 430 }),
      makeRow({ id: "r2", trackId: "a", startMin: 480, endMin: 490 }),
      makeRow({ id: "r3", trackId: "a", startMin: 540, endMin: 550 }),
    ]
    const result = detectScheduleGaps(rows)
    expect(result).toEqual([
      { trackId: "a", startMin: 430, endMin: 480, durationMinutes: 50 },
      { trackId: "a", startMin: 490, endMin: 540, durationMinutes: 50 },
    ])
  })

  it("sorts rows by startMin within each track", () => {
    // Rows provided out of order
    const rows = [
      makeRow({ id: "r2", trackId: "a", startMin: 510, endMin: 540 }),
      makeRow({ id: "r1", trackId: "a", startMin: 420, endMin: 450 }),
    ]
    const result = detectScheduleGaps(rows)
    expect(result).toEqual([
      { trackId: "a", startMin: 450, endMin: 510, durationMinutes: 60 },
    ])
  })
})
