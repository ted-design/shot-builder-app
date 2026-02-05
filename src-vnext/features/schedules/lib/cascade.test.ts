import { describe, it, expect } from "vitest"
import { buildCascadeMoveBetweenTracksPatches, buildCascadeReorderPatches } from "./cascade"
import type { ScheduleEntry, ScheduleSettings } from "@/shared/types"

const settings: ScheduleSettings = {
  cascadeChanges: true,
  dayStartTime: "06:00",
  defaultEntryDurationMinutes: 15,
}

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

describe("buildCascadeReorderPatches", () => {
  it("recomputes moved + downstream startTime when cascade is ON", () => {
    const entries = [
      makeEntry({ id: "a", order: 0, startTime: "06:00" }),
      makeEntry({ id: "b", order: 1, startTime: "06:15" }),
      makeEntry({ id: "c", order: 2, startTime: "06:30" }),
    ]

    // Move "c" to index 1: order becomes a, c, b
    const patches = buildCascadeReorderPatches({
      entries,
      trackId: "primary",
      movedEntryId: "c",
      nextOrderedIds: ["a", "c", "b"],
      settings,
    })

    const byId = new Map(patches.map((p) => [p.entryId, p.patch]))
    expect(byId.get("a")?.order).toBeUndefined()
    expect(byId.get("c")?.order).toBe(1)
    expect(byId.get("b")?.order).toBe(2)
    expect(byId.get("c")?.startTime).toBe("06:15")
    expect(byId.get("b")?.startTime).toBe("06:30")
  })

  it("does not write startTime when cascade is OFF", () => {
    const entries = [
      makeEntry({ id: "a", order: 0, startTime: "06:00" }),
      makeEntry({ id: "b", order: 1, startTime: "06:15" }),
    ]

    const patches = buildCascadeReorderPatches({
      entries,
      trackId: "primary",
      movedEntryId: "b",
      nextOrderedIds: ["b", "a"],
      settings: { ...settings, cascadeChanges: false },
    })

    const merged = Object.assign({}, ...patches.map((p) => p.patch))
    expect(merged).toHaveProperty("order")
    expect(merged).not.toHaveProperty("startTime")
  })
})

describe("buildCascadeMoveBetweenTracksPatches", () => {
  it("moves entry to another track and recomputes times for both tracks when cascade is ON", () => {
    const entries = [
      makeEntry({ id: "a", trackId: "primary", order: 0, startTime: "06:00", duration: 15 }),
      makeEntry({ id: "b", trackId: "primary", order: 1, startTime: "06:15", duration: 15 }),
      makeEntry({ id: "c", trackId: "track-2", order: 0, startTime: "06:00", duration: 30 }),
    ]

    const patches = buildCascadeMoveBetweenTracksPatches({
      entries,
      fromTrackId: "primary",
      toTrackId: "track-2",
      entryId: "b",
      insertIndex: 1,
      settings,
    })

    const byId = new Map(patches.map((p) => [p.entryId, p.patch]))
    expect(byId.get("b")?.trackId).toBe("track-2")
    // Primary now only has "a" at 06:00.
    expect(byId.get("a")?.startTime).toBeUndefined()
    // Track-2 becomes: c(06:00-06:30), b(06:30)
    expect(byId.get("b")?.startTime).toBe("06:30")
  })

  it("does not recompute times when cascade is OFF", () => {
    const entries = [
      makeEntry({ id: "a", trackId: "primary", order: 0, startTime: "06:00", duration: 15 }),
      makeEntry({ id: "b", trackId: "primary", order: 1, startTime: "06:15", duration: 15 }),
      makeEntry({ id: "c", trackId: "track-2", order: 0, startTime: "06:00", duration: 30 }),
    ]

    const patches = buildCascadeMoveBetweenTracksPatches({
      entries,
      fromTrackId: "primary",
      toTrackId: "track-2",
      entryId: "b",
      insertIndex: 0,
      settings: { ...settings, cascadeChanges: false },
    })

    const merged = Object.assign({}, ...patches.map((p) => p.patch))
    expect(merged).toHaveProperty("trackId")
    expect(merged).toHaveProperty("order")
    expect(merged).not.toHaveProperty("startTime")
  })
})
