import { describe, expect, it } from "vitest"
import { buildAutoDurationFillPatches } from "./autoDuration"
import type { ScheduleEntry, ScheduleTrack } from "@/shared/types"

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

describe("buildAutoDurationFillPatches", () => {
  it("fills missing duration from next start time within the same track", () => {
    const entries = [
      makeEntry({ id: "a", trackId: "primary", order: 0, startTime: "10:00", duration: undefined }),
      makeEntry({ id: "b", trackId: "primary", order: 1, startTime: "10:15", duration: 20 }),
      makeEntry({ id: "c", trackId: "track-2", order: 0, startTime: "10:00", duration: 30 }),
    ]

    const patches = buildAutoDurationFillPatches({ entries, tracks })
    expect(patches).toEqual([{ entryId: "a", patch: { duration: 15 } }])
  })

  it("does not overwrite an explicit valid duration", () => {
    const entries = [
      makeEntry({ id: "a", order: 0, startTime: "10:00", duration: 25 }),
      makeEntry({ id: "b", order: 1, startTime: "10:15", duration: 20 }),
    ]

    const patches = buildAutoDurationFillPatches({ entries, tracks })
    expect(patches).toEqual([])
  })

  it("skips invalid or non-positive deltas and banner rows", () => {
    const entries = [
      makeEntry({ id: "a", order: 0, startTime: "10:00", duration: 0 }),
      makeEntry({ id: "b", order: 1, startTime: "09:50", duration: 20 }),
      makeEntry({ id: "c", type: "banner", order: 0, startTime: "10:10", duration: undefined }),
    ]

    const patches = buildAutoDurationFillPatches({ entries, tracks })
    expect(patches).toEqual([])
  })

  it("evaluates each track independently", () => {
    const entries = [
      makeEntry({ id: "a", trackId: "primary", order: 0, startTime: "08:00", duration: undefined }),
      makeEntry({ id: "b", trackId: "primary", order: 1, startTime: "08:10", duration: 15 }),
      makeEntry({ id: "c", trackId: "track-2", order: 0, startTime: "09:00", duration: undefined }),
      makeEntry({ id: "d", trackId: "track-2", order: 1, startTime: "09:30", duration: 20 }),
    ]

    const patches = buildAutoDurationFillPatches({ entries, tracks })
    expect(patches).toEqual([
      { entryId: "a", patch: { duration: 10 } },
      { entryId: "c", patch: { duration: 30 } },
    ])
  })
})
