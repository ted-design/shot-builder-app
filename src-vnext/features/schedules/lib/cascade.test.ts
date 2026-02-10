import { describe, it, expect } from "vitest"
import {
  buildCascadeDirectStartEditPatches,
  buildCascadeMoveBetweenTracksPatches,
  buildCascadeReorderPatches,
} from "./cascade"
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
  it("moves entry to another track and recomputes moved + downstream per affected track when cascade is ON", () => {
    const entries = [
      makeEntry({ id: "a", trackId: "primary", order: 0, startTime: "06:00", duration: 15 }),
      makeEntry({ id: "b", trackId: "primary", order: 1, startTime: "06:15", duration: 15 }),
      makeEntry({ id: "d", trackId: "primary", order: 2, startTime: "06:30", duration: 15 }),
      makeEntry({ id: "c", trackId: "track-2", order: 0, startTime: "06:00", duration: 30 }),
      makeEntry({ id: "e", trackId: "track-2", order: 1, startTime: "06:30", duration: 15 }),
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
    // Primary becomes a(06:00), d(06:15) — only downstream of removed entry shifts.
    expect(byId.get("a")?.startTime).toBeUndefined()
    expect(byId.get("d")?.startTime).toBe("06:15")
    // Track-2 becomes c(06:00-06:30), b(06:30-06:45), e(06:45) — upstream unchanged.
    expect(byId.get("c")?.startTime).toBeUndefined()
    expect(byId.get("b")?.startTime).toBe("06:30")
    expect(byId.get("e")?.startTime).toBe("06:45")
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

describe("buildCascadeDirectStartEditPatches", () => {
  it("reorders by edited start time and cascades downstream from edited entry", () => {
    const entries = [
      makeEntry({ id: "a", trackId: "primary", order: 0, startTime: "09:40", duration: 10 }),
      makeEntry({ id: "b", trackId: "primary", order: 1, startTime: "10:00", duration: 15 }),
      makeEntry({ id: "c", trackId: "primary", order: 2, startTime: "10:30", duration: 15 }),
    ]

    const patches = buildCascadeDirectStartEditPatches({
      entries,
      trackId: "primary",
      entryId: "c",
      nextStartTime: "09:30",
      settings,
    })

    const byId = new Map(patches.map((p) => [p.entryId, p.patch]))

    expect(byId.get("c")).toMatchObject({ order: 0, startTime: "09:30" })
    expect(byId.get("a")).toMatchObject({ order: 1, startTime: "09:45" })
    expect(byId.get("b")).toMatchObject({ order: 2, startTime: "09:55" })
  })

  it("infers edited entry duration from next explicit start when duration is missing", () => {
    const entries = [
      makeEntry({ id: "a", trackId: "primary", order: 0, startTime: "09:50", duration: undefined }),
      makeEntry({ id: "b", trackId: "primary", order: 1, startTime: "10:00", duration: 15 }),
      makeEntry({ id: "c", trackId: "primary", order: 2, startTime: "10:15", duration: 15 }),
    ]

    const patches = buildCascadeDirectStartEditPatches({
      entries,
      trackId: "primary",
      entryId: "a",
      nextStartTime: "09:40",
      settings,
    })

    const byId = new Map(patches.map((p) => [p.entryId, p.patch]))
    expect(byId.get("a")).toMatchObject({ startTime: "09:40", duration: 20 })
    expect(byId.get("b")?.startTime).toBeUndefined()
    expect(byId.get("c")?.startTime).toBeUndefined()
  })
})
