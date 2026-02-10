import { describe, expect, it } from "vitest"
import { findTrackOverlapConflicts } from "@/features/schedules/lib/conflicts"
import type { ScheduleEntry, ScheduleSettings, ScheduleTrack } from "@/shared/types"

function makeEntry(overrides: Partial<ScheduleEntry> = {}): ScheduleEntry {
  return {
    id: "e1",
    type: "shot",
    title: "Entry",
    order: 0,
    trackId: "primary",
    startTime: "06:00",
    duration: 15,
    ...overrides,
  }
}

const tracks: readonly ScheduleTrack[] = [
  { id: "primary", name: "Primary", order: 0 },
  { id: "track-2", name: "Track 2", order: 1 },
]

const settings: ScheduleSettings = {
  cascadeChanges: true,
  dayStartTime: "06:00",
  defaultEntryDurationMinutes: 15,
}

describe("findTrackOverlapConflicts", () => {
  it("detects same-track overlap conflicts", () => {
    const entries = [
      makeEntry({ id: "a", title: "Load In", startTime: "09:00", duration: 60 }),
      makeEntry({ id: "b", title: "Shot 1", order: 1, startTime: "09:30", duration: 15 }),
    ]

    const conflicts = findTrackOverlapConflicts({ entries, tracks, settings })
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]).toMatchObject({
      trackId: "primary",
      firstEntryId: "a",
      secondEntryId: "b",
    })
  })

  it("does not treat cross-track simultaneous timings as conflicts", () => {
    const entries = [
      makeEntry({ id: "a", startTime: "09:00", duration: 60, trackId: "primary" }),
      makeEntry({ id: "b", startTime: "09:00", duration: 60, trackId: "track-2" }),
    ]

    const conflicts = findTrackOverlapConflicts({ entries, tracks, settings })
    expect(conflicts).toEqual([])
  })

  it("derives missing duration from the next explicit start for conflict checks", () => {
    const entries = [
      makeEntry({ id: "a", startTime: "09:00", duration: undefined }),
      makeEntry({ id: "b", order: 1, startTime: "09:20", duration: 15 }),
      makeEntry({ id: "c", order: 2, startTime: "09:35", duration: 15 }),
    ]

    const conflicts = findTrackOverlapConflicts({ entries, tracks, settings })
    expect(conflicts).toEqual([])
  })

  it("ignores banner entries", () => {
    const entries = [
      makeEntry({ id: "a", startTime: "09:00", duration: 60 }),
      makeEntry({ id: "b", type: "banner", order: 1, startTime: "09:15", duration: 30 }),
      makeEntry({ id: "c", order: 2, startTime: "10:00", duration: 15 }),
    ]

    const conflicts = findTrackOverlapConflicts({ entries, tracks, settings })
    expect(conflicts).toEqual([])
  })

  it("ignores shared-track marker entries for conflict checks", () => {
    const entries = [
      makeEntry({ id: "a", startTime: "09:00", duration: 60, trackId: "primary" }),
      makeEntry({ id: "b", type: "setup", startTime: "09:10", duration: 30, trackId: "shared" }),
      makeEntry({ id: "c", order: 2, startTime: "10:00", duration: 15, trackId: "primary" }),
    ]

    const conflicts = findTrackOverlapConflicts({ entries, tracks, settings })
    expect(conflicts).toEqual([])
  })

  it("supports track filtering", () => {
    const entries = [
      makeEntry({ id: "a", startTime: "09:00", duration: 60, trackId: "primary" }),
      makeEntry({ id: "b", order: 1, startTime: "09:30", duration: 15, trackId: "primary" }),
      makeEntry({ id: "c", startTime: "09:00", duration: 60, trackId: "track-2" }),
      makeEntry({ id: "d", order: 1, startTime: "09:20", duration: 15, trackId: "track-2" }),
    ]

    const primaryOnly = findTrackOverlapConflicts({ entries, tracks, settings, trackIds: ["primary"] })
    expect(primaryOnly).toHaveLength(1)
    expect(primaryOnly[0]?.trackId).toBe("primary")
  })
})
