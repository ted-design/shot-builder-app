import { describe, it, expect } from "vitest"
import { Timestamp } from "firebase/firestore"
import type { Schedule } from "@/shared/types"
import { deriveDefaultCallSheetTitle } from "../callSheetTitle"

const makeSchedule = (overrides: Partial<Schedule> = {}): Schedule => ({
  id: "s1",
  projectId: "p1",
  name: "",
  date: null,
  createdAt: Timestamp.fromDate(new Date("2026-01-01T00:00:00Z")),
  updatedAt: Timestamp.fromDate(new Date("2026-01-01T00:00:00Z")),
  ...overrides,
})

describe("deriveDefaultCallSheetTitle", () => {
  it("returns a short-format date label when the schedule has a date", () => {
    const schedule = makeSchedule({
      date: Timestamp.fromDate(new Date("2026-04-14T12:00:00Z")),
    })
    expect(deriveDefaultCallSheetTitle(schedule)).toBe("Tue, Apr 14")
  })

  it("returns a date label with the schedule date when the schedule also has a name", () => {
    const schedule = makeSchedule({
      name: "Downtown Shoot Day 3",
      date: Timestamp.fromDate(new Date("2026-04-14T12:00:00Z")),
    })
    expect(deriveDefaultCallSheetTitle(schedule)).toBe("Tue, Apr 14")
  })

  it("falls back to the schedule name when the date is null", () => {
    const schedule = makeSchedule({ name: "Downtown Shoot Day 3", date: null })
    expect(deriveDefaultCallSheetTitle(schedule)).toBe("Downtown Shoot Day 3")
  })

  it("trims whitespace on the name fallback", () => {
    const schedule = makeSchedule({ name: "  Pickups  ", date: null })
    expect(deriveDefaultCallSheetTitle(schedule)).toBe("Pickups")
  })

  it("falls back to 'Call Sheet' when date is null and name is empty", () => {
    const schedule = makeSchedule({ name: "", date: null })
    expect(deriveDefaultCallSheetTitle(schedule)).toBe("Call Sheet")
  })

  it("falls back to 'Call Sheet' when date is null and name is whitespace-only", () => {
    const schedule = makeSchedule({ name: "   ", date: null })
    expect(deriveDefaultCallSheetTitle(schedule)).toBe("Call Sheet")
  })

  it("uses en-US locale so the label is deterministic regardless of runtime", () => {
    const schedule = makeSchedule({
      date: Timestamp.fromDate(new Date("2026-12-01T12:00:00Z")),
    })
    // en-US short format — if this were runtime-locale-dependent, the test
    // would flicker in CI environments with different LC_ALL.
    expect(deriveDefaultCallSheetTitle(schedule)).toBe("Tue, Dec 1")
  })
})
