import { describe, expect, it } from "vitest"
import { buildScheduleProjection } from "@/features/schedules/lib/projection"
import type { Schedule, ScheduleEntry } from "@/shared/types"
import type { Timestamp } from "firebase/firestore"

const ts = { toDate: () => new Date(), seconds: 0, nanoseconds: 0 } as unknown as Timestamp

const schedule: Schedule = {
  id: "s1",
  projectId: "p1",
  name: "Day 1",
  date: ts,
  tracks: [
    { id: "primary", name: "Primary", order: 0 },
    { id: "track-2", name: "Track 2", order: 1 },
  ],
  settings: {
    cascadeChanges: true,
    dayStartTime: "06:00",
    defaultEntryDurationMinutes: 15,
  },
  createdAt: ts,
  updatedAt: ts,
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

describe("buildScheduleProjection shared banner semantics", () => {
  it("treats trackId shared marker as all-track banner", () => {
    const entries = [
      makeEntry({ id: "b1", type: "banner", title: "Shared note", trackId: "shared", startTime: "09:00" }),
    ]

    const projection = buildScheduleProjection({ schedule, entries, mode: "time" })
    const row = projection.rows[0]!
    expect(row.isBanner).toBe(true)
    expect(row.applicabilityKind).toBe("all")
    expect(row.appliesToTrackIds).toEqual(["primary", "track-2"])
  })

  it("treats legacy trackId all marker as all-track banner", () => {
    const entries = [
      makeEntry({ id: "b1", type: "banner", title: "Legacy shared", trackId: "all", startTime: "09:00" }),
    ]

    const projection = buildScheduleProjection({ schedule, entries, mode: "time" })
    const row = projection.rows[0]!
    expect(row.isBanner).toBe(true)
    expect(row.applicabilityKind).toBe("all")
    expect(row.appliesToTrackIds).toEqual(["primary", "track-2"])
  })
})
