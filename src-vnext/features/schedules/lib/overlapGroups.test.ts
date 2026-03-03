import { describe, it, expect } from "vitest"
import {
  buildOverlapGroups,
  type OverlapGroup,
} from "@/features/schedules/lib/overlapGroups"
import type { ProjectedScheduleRow } from "@/features/schedules/lib/projection"
import type { ScheduleEntry } from "@/shared/types"

// ─── Helpers ──────────────────────────────────────────────────────────

function makeRow(
  id: string,
  trackId: string,
  startMin: number,
  durationMinutes: number,
): ProjectedScheduleRow {
  const entry: ScheduleEntry = {
    id,
    type: "shot",
    title: `Entry ${id}`,
    order: 0,
    trackId,
  }
  return {
    id,
    entry,
    trackId,
    isBanner: false,
    appliesToTrackIds: null,
    applicabilityKind: "single",
    startMin,
    endMin: startMin + durationMinutes,
    durationMinutes,
    timeSource: "explicit",
  }
}

/** Create a row with explicit startMin/endMin (for midnight-crossing tests). */
function makeRowExplicit(
  id: string,
  trackId: string,
  startMin: number,
  endMin: number,
): ProjectedScheduleRow {
  const entry: ScheduleEntry = {
    id,
    type: "shot",
    title: `Entry ${id}`,
    order: 0,
    trackId,
  }
  return {
    id,
    entry,
    trackId,
    isBanner: false,
    appliesToTrackIds: null,
    applicabilityKind: "single",
    startMin,
    endMin,
    durationMinutes: endMin >= startMin ? endMin - startMin : 1440 - startMin + endMin,
    timeSource: "explicit",
  }
}

function makeBannerRow(
  id: string,
  startMin: number,
  durationMinutes: number,
): ProjectedScheduleRow {
  const entry: ScheduleEntry = {
    id,
    type: "banner",
    title: `Banner ${id}`,
    order: 0,
    trackId: "shared",
  }
  return {
    id,
    entry,
    trackId: "shared",
    isBanner: true,
    appliesToTrackIds: ["primary", "video"],
    applicabilityKind: "all",
    startMin,
    endMin: startMin + durationMinutes,
    durationMinutes,
    timeSource: "explicit",
  }
}

// ─── Tests ────────────────────────────────────────────────────────────

describe("buildOverlapGroups", () => {
  it("returns empty array for empty input", () => {
    const result = buildOverlapGroups([])
    expect(result).toEqual([])
  })

  it("isolated entry produces a group with size 1", () => {
    const rows = [makeRow("a", "primary", 600, 60)]
    const groups = buildOverlapGroups(rows)
    expect(groups).toHaveLength(1)
    expect(groups[0]!.entries).toHaveLength(1)
    expect(groups[0]!.entries[0]!.id).toBe("a")
    expect(groups[0]!.isIsolated).toBe(true)
  })

  it("two non-overlapping entries in same track produce two isolated groups", () => {
    const rows = [
      makeRow("a", "primary", 600, 60),  // 10:00-11:00
      makeRow("b", "primary", 720, 60),  // 12:00-13:00
    ]
    const groups = buildOverlapGroups(rows)
    expect(groups).toHaveLength(2)
    expect(groups[0]!.isIsolated).toBe(true)
    expect(groups[1]!.isIsolated).toBe(true)
  })

  it("two overlapping entries produce a single group with size 2", () => {
    const rows = [
      makeRow("a", "primary", 600, 60),  // 10:00-11:00
      makeRow("b", "primary", 630, 60),  // 10:30-11:30
    ]
    const groups = buildOverlapGroups(rows)
    expect(groups).toHaveLength(1)
    expect(groups[0]!.entries).toHaveLength(2)
    expect(groups[0]!.isIsolated).toBe(false)
    expect(groups[0]!.startMin).toBe(600)
    expect(groups[0]!.endMin).toBe(690)
  })

  it("three-way overlap collapses to one group", () => {
    const rows = [
      makeRow("a", "primary", 600, 90),  // 10:00-11:30
      makeRow("b", "primary", 630, 90),  // 10:30-12:00
      makeRow("c", "primary", 660, 60),  // 11:00-12:00
    ]
    const groups = buildOverlapGroups(rows)
    expect(groups).toHaveLength(1)
    expect(groups[0]!.entries).toHaveLength(3)
    expect(groups[0]!.endMin).toBe(720)
  })

  it("entries touching at exact boundary (adjacent, not overlapping) produce two groups", () => {
    const rows = [
      makeRow("a", "primary", 600, 60),  // 10:00-11:00
      makeRow("b", "primary", 660, 60),  // 11:00-12:00 (starts exactly at a's end)
    ]
    const groups = buildOverlapGroups(rows)
    expect(groups).toHaveLength(2)
    expect(groups[0]!.isIsolated).toBe(true)
    expect(groups[1]!.isIsolated).toBe(true)
  })

  it("per-track: overlapping entries in DIFFERENT tracks do NOT merge into same group", () => {
    const rows = [
      makeRow("a", "primary", 600, 90),  // primary track 10:00-11:30
      makeRow("b", "video", 600, 90),    // video track 10:00-11:30 (different track)
    ]
    const groups = buildOverlapGroups(rows)
    // Each track has one isolated entry
    expect(groups).toHaveLength(2)
    expect(groups.every((g) => g.isIsolated)).toBe(true)
    expect(groups.every((g) => g.entries.length === 1)).toBe(true)
  })

  it("chain overlap: a-b overlap, b-c overlap → all three in one group", () => {
    const rows = [
      makeRow("a", "primary", 600, 60),  // 10:00-11:00
      makeRow("b", "primary", 630, 60),  // 10:30-11:30
      makeRow("c", "primary", 660, 60),  // 11:00-12:00
    ]
    // a overlaps b (600-660 overlaps 630-690)
    // b overlaps c (630-690 overlaps 660-720)
    // a does NOT directly overlap c (600-660 ends before c 660 starts)
    // But they chain → same group
    const groups = buildOverlapGroups(rows)
    expect(groups).toHaveLength(1)
    expect(groups[0]!.entries).toHaveLength(3)
  })

  it("groups are sorted by startMin", () => {
    const rows = [
      makeRow("c", "primary", 720, 60),  // 12:00
      makeRow("a", "primary", 600, 60),  // 10:00
      makeRow("b", "primary", 480, 60),  // 8:00
    ]
    const groups = buildOverlapGroups(rows)
    expect(groups).toHaveLength(3)
    expect(groups[0]!.startMin).toBe(480)
    expect(groups[1]!.startMin).toBe(600)
    expect(groups[2]!.startMin).toBe(720)
  })

  it("banners are excluded from overlap groups", () => {
    const rows = [
      makeRow("a", "primary", 600, 60),
      makeBannerRow("banner1", 600, 60),
    ]
    const groups = buildOverlapGroups(rows)
    // Banner excluded, only one non-banner entry
    expect(groups).toHaveLength(1)
    expect(groups[0]!.entries[0]!.id).toBe("a")
  })

  it("group records correct startMin and endMin", () => {
    const rows = [
      makeRow("a", "primary", 600, 30),   // 10:00-10:30
      makeRow("b", "primary", 615, 60),   // 10:15-11:15
    ]
    const groups = buildOverlapGroups(rows)
    expect(groups).toHaveLength(1)
    expect(groups[0]!.startMin).toBe(600)
    expect(groups[0]!.endMin).toBe(675)
  })

  it("multiple tracks each have own groups", () => {
    const rows = [
      makeRow("a", "primary", 600, 90),  // primary 10:00-11:30
      makeRow("b", "primary", 630, 60),  // primary 10:30-11:30 → overlaps a
      makeRow("c", "video", 720, 60),    // video 12:00-13:00 (isolated)
    ]
    const groups = buildOverlapGroups(rows)
    // primary: 1 overlap group (a+b), video: 1 isolated group (c)
    expect(groups).toHaveLength(2)
    const primaryGroup = groups.find((g) => g.trackId === "primary")
    const videoGroup = groups.find((g) => g.trackId === "video")
    expect(primaryGroup).toBeDefined()
    expect(videoGroup).toBeDefined()
    expect(primaryGroup!.entries).toHaveLength(2)
    expect(primaryGroup!.isIsolated).toBe(false)
    expect(videoGroup!.isIsolated).toBe(true)
  })

  // ─── Midnight-crossing regression tests ──────────────────────────────

  it("entry exceeding midnight (endMin > 1439) is clamped to 1439", () => {
    // 23:00 + 60min = endMin 1440 → clamp to 1439
    const rows = [makeRow("a", "primary", 1380, 60)]
    const groups = buildOverlapGroups(rows)
    expect(groups).toHaveLength(1)
    expect(groups[0]!.endMin).toBe(1439)
    expect(groups[0]!.startMin).toBe(1380)
  })

  it("midnight-crossing entry (endMin < startMin) is clamped to end-of-day", () => {
    // 23:00 → wraps to 01:00 next day (endMin=60). Should clamp to 1439.
    const rows = [makeRowExplicit("a", "primary", 1380, 60)]
    const groups = buildOverlapGroups(rows)
    expect(groups).toHaveLength(1)
    expect(groups[0]!.endMin).toBe(1439)
    expect(groups[0]!.startMin).toBe(1380)
  })

  it("midnight-crossing entry overlaps with a late-night entry in same track", () => {
    // Entry a: 22:30–23:59 (clamped from midnight cross)
    // Entry b: 23:00–23:30
    // They should overlap into one group.
    const rows = [
      makeRowExplicit("a", "primary", 1350, 30),  // 22:30 → wraps to 00:30 next day
      makeRow("b", "primary", 1380, 30),           // 23:00–23:30
    ]
    const groups = buildOverlapGroups(rows)
    expect(groups).toHaveLength(1)
    expect(groups[0]!.entries).toHaveLength(2)
    expect(groups[0]!.isIsolated).toBe(false)
  })

  it("two midnight-crossing entries in different tracks stay separate", () => {
    const rows = [
      makeRowExplicit("a", "primary", 1380, 60),
      makeRowExplicit("b", "video", 1380, 60),
    ]
    const groups = buildOverlapGroups(rows)
    expect(groups).toHaveLength(2)
    expect(groups.every((g) => g.isIsolated)).toBe(true)
  })

  it("midnight-crossing entry does not false-overlap with early-morning entry", () => {
    // Entry a: 23:00 → wraps to 01:00 (clamped to 23:59)
    // Entry b: 06:00–07:00
    // After clamping, a ends at 1439 and b starts at 360 — no overlap.
    const rows = [
      makeRowExplicit("a", "primary", 1380, 60),
      makeRow("b", "primary", 360, 60),
    ]
    const groups = buildOverlapGroups(rows)
    expect(groups).toHaveLength(2)
    expect(groups[0]!.startMin).toBe(360)
    expect(groups[1]!.startMin).toBe(1380)
  })
})
