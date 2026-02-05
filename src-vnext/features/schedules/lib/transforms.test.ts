import { describe, it, expect } from "vitest"
import { buildCollapseToSingleTrack } from "./transforms"
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

describe("buildCollapseToSingleTrack", () => {
  it("merges to primary and normalizes order + startTime gapless", () => {
    const entries = [
      makeEntry({ id: "a", trackId: "track-2", startTime: "07:00", order: 0, duration: 30 }),
      makeEntry({ id: "b", trackId: "primary", startTime: "06:00", order: 0, duration: 15 }),
      makeEntry({ id: "c", type: "banner", startTime: "06:30", order: 0, duration: 15 }),
    ]

    const result = buildCollapseToSingleTrack({ entries, settings })
    expect(result.tracks).toHaveLength(1)
    expect(result.tracks[0]!.id).toBe("primary")

    const patchById = new Map(result.entryUpdates.map((u) => [u.entryId, u.patch]))
    const final = entries
      .map((e) => ({ ...e, ...(patchById.get(e.id) ?? {}) }))
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

    expect(final.map((e) => e.id)).toEqual(["b", "c", "a"])
    expect(final.map((e) => e.trackId ?? "primary")).toEqual(["primary", "primary", "primary"])
    expect(final.find((e) => e.id === "a")?.appliesToTrackIds ?? null).toBeNull()

    // Gapless times from first start ("06:00") respecting durations.
    expect(final[0]!.startTime).toBe("06:00")
    expect(final[1]!.startTime).toBe("06:15")
    expect(final[2]!.startTime).toBe("06:30")
  })
})
