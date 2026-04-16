import { describe, expect, it } from "vitest"

import type {
  CrewCallSheet,
  LocationBlock,
  ScheduleEntry,
  ScheduleTrack,
  TalentCallSheet,
} from "@/shared/types"

import {
  reinsertLocationAtIndex,
  takeCollapseSnapshot,
  takeLocationRemoveSnapshot,
  type UndoSnapshot,
} from "@/features/schedules/lib/undoSnapshots"

function makeBlock(id: string, title: string): LocationBlock {
  return {
    id,
    title,
    ref: null,
    showName: true,
    showPhone: false,
  }
}

function makeTrack(id: string, name: string, order: number): ScheduleTrack {
  return { id, name, order }
}

function makeEntry(id: string, overrides: Partial<ScheduleEntry> = {}): ScheduleEntry {
  return {
    id,
    type: "shot",
    title: `Entry ${id}`,
    order: 0,
    ...overrides,
  }
}

describe("takeLocationRemoveSnapshot", () => {
  it("returns null when the id is not found", () => {
    const locations = [makeBlock("a", "Basecamp"), makeBlock("b", "Parking")]
    expect(takeLocationRemoveSnapshot(locations, "missing")).toBeNull()
  })

  it("captures the correct index and block and returns the filtered next array", () => {
    const locations = [
      makeBlock("a", "Basecamp"),
      makeBlock("b", "Parking"),
      makeBlock("c", "Hospital"),
    ]
    const capture = takeLocationRemoveSnapshot(locations, "b")
    expect(capture).not.toBeNull()
    expect(capture!.snapshot.index).toBe(1)
    expect(capture!.snapshot.block.id).toBe("b")
    expect(capture!.snapshot.block.title).toBe("Parking")
    expect(capture!.next.map((b) => b.id)).toEqual(["a", "c"])
  })

  it("does not mutate the source array", () => {
    const locations = [makeBlock("a", "Basecamp"), makeBlock("b", "Parking")]
    const capture = takeLocationRemoveSnapshot(locations, "a")
    expect(locations.map((b) => b.id)).toEqual(["a", "b"])
    expect(capture!.next).not.toBe(locations)
  })
})

describe("reinsertLocationAtIndex", () => {
  it("reinserts at the original index when the array length matches", () => {
    const locations = [makeBlock("a", "Basecamp"), makeBlock("c", "Hospital")]
    const reinserted = reinsertLocationAtIndex(locations, {
      index: 1,
      block: makeBlock("b", "Parking"),
    })
    expect(reinserted.map((b) => b.id)).toEqual(["a", "b", "c"])
  })

  it("clamps to array end when the original index is now out of bounds", () => {
    const locations = [makeBlock("a", "Basecamp")]
    const reinserted = reinsertLocationAtIndex(locations, {
      index: 5,
      block: makeBlock("b", "Parking"),
    })
    expect(reinserted.map((b) => b.id)).toEqual(["a", "b"])
  })

  it("clamps to 0 for a negative index", () => {
    const locations = [makeBlock("a", "Basecamp"), makeBlock("c", "Hospital")]
    const reinserted = reinsertLocationAtIndex(locations, {
      index: -3,
      block: makeBlock("b", "Parking"),
    })
    expect(reinserted.map((b) => b.id)).toEqual(["b", "a", "c"])
  })
})

describe("takeCollapseSnapshot", () => {
  it("deep-clones tracks so source mutation does not leak into the snapshot", () => {
    const tracks: ScheduleTrack[] = [
      makeTrack("primary", "Primary", 0),
      makeTrack("t2", "Unit 2", 1),
    ]
    const entries: ScheduleEntry[] = [makeEntry("e1", { trackId: "primary" })]

    const snapshot = takeCollapseSnapshot(tracks, entries)

    tracks[0] = makeTrack("primary", "MUTATED", 99)

    expect(snapshot.tracks.map((t) => t.name)).toEqual(["Primary", "Unit 2"])
    expect(snapshot.tracks[0]).not.toBe(tracks[0])
  })

  it("captures every entry's trackId and defaults missing ones to null", () => {
    const tracks: ScheduleTrack[] = [makeTrack("primary", "Primary", 0)]
    const entries: ScheduleEntry[] = [
      makeEntry("e1", { trackId: "primary" }),
      makeEntry("e2", { trackId: "t2" }),
      makeEntry("e3"),
    ]

    const snapshot = takeCollapseSnapshot(tracks, entries)

    expect(snapshot.entryTrackIds).toEqual([
      { entryId: "e1", trackId: "primary" },
      { entryId: "e2", trackId: "t2" },
      { entryId: "e3", trackId: null },
    ])
  })
})

describe("UndoSnapshot exhaustiveness", () => {
  it("compiles a switch that handles every variant", () => {
    // Fixture payloads to smoke-test the discriminated union at
    // compile time (via `assertNever`) and at runtime (via return).
    const crewPayload: CrewCallSheet = {
      id: "crew-1",
      crewMemberId: "member-1",
    }
    const talentPayload: TalentCallSheet = {
      id: "talent-1",
      talentId: "actor-1",
    }
    const locationBlock = makeBlock("loc-1", "Basecamp")
    const track = makeTrack("primary", "Primary", 0)
    const entry = makeEntry("entry-1", { trackId: "primary" })

    const fixtures: ReadonlyArray<UndoSnapshot> = [
      { kind: "crewCallRemoved", payload: crewPayload },
      { kind: "talentCallRemoved", payload: talentPayload },
      {
        kind: "locationRemoved",
        payload: { index: 0, block: locationBlock },
      },
      {
        kind: "tracksCollapsed",
        payload: {
          tracks: [track],
          entryTrackIds: [{ entryId: "entry-1", trackId: "primary" }],
        },
      },
      { kind: "scheduleEntryRemoved", payload: entry },
    ]

    function describeSnapshot(snapshot: UndoSnapshot): string {
      switch (snapshot.kind) {
        case "crewCallRemoved":
          return `crew:${snapshot.payload.id}`
        case "talentCallRemoved":
          return `talent:${snapshot.payload.id}`
        case "locationRemoved":
          return `loc:${snapshot.payload.block.id}@${snapshot.payload.index}`
        case "tracksCollapsed":
          return `collapsed:${snapshot.payload.tracks.length}`
        case "scheduleEntryRemoved":
          return `entry:${snapshot.payload.id}`
        default: {
          const _exhaustive: never = snapshot
          return _exhaustive
        }
      }
    }

    const labels = fixtures.map(describeSnapshot)
    expect(labels).toEqual([
      "crew:crew-1",
      "talent:talent-1",
      "loc:loc-1@0",
      "collapsed:1",
      "entry:entry-1",
    ])
  })
})
