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
})
