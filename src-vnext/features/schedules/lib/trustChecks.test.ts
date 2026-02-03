import { describe, it, expect } from "vitest"
import { computeTrustWarnings } from "./trustChecks"
import type {
  Schedule,
  ScheduleEntry,
  DayDetails,
  TalentCallSheet,
  CrewCallSheet,
  CrewRecord,
} from "@/shared/types"
import type { Timestamp } from "firebase/firestore"

const ts = { toDate: () => new Date(), seconds: 0, nanoseconds: 0 } as unknown as Timestamp

function makeSchedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: "s1",
    projectId: "p1",
    name: "Day 1",
    date: ts,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  }
}

function makeEntry(overrides: Partial<ScheduleEntry> = {}): ScheduleEntry {
  return {
    id: "e1",
    type: "shot",
    title: "Shot 1",
    order: 1,
    ...overrides,
  }
}

function makeDayDetails(overrides: Partial<DayDetails> = {}): DayDetails {
  return {
    id: "dd1",
    scheduleId: "s1",
    crewCallTime: "6:00 AM",
    shootingCallTime: "7:00 AM",
    estimatedWrap: "7:00 PM",
    ...overrides,
  }
}

function makeTalentCall(overrides: Partial<TalentCallSheet> = {}): TalentCallSheet {
  return {
    id: "tc1",
    talentId: "t1",
    ...overrides,
  }
}

function makeCrewCall(overrides: Partial<CrewCallSheet> = {}): CrewCallSheet {
  return {
    id: "cc1",
    crewMemberId: "c1",
    ...overrides,
  }
}

function makeCrewRecord(overrides: Partial<CrewRecord> = {}): CrewRecord {
  return {
    id: "c1",
    name: "Jane Gaffer",
    department: "Lighting",
    ...overrides,
  }
}

const emptyInput = {
  schedule: makeSchedule(),
  entries: [makeEntry()],
  dayDetails: makeDayDetails(),
  talentCalls: [] as TalentCallSheet[],
  crewCalls: [] as CrewCallSheet[],
  crewLibrary: [] as CrewRecord[],
}

describe("computeTrustWarnings", () => {
  it("returns no warnings when everything is healthy", () => {
    const warnings = computeTrustWarnings(emptyInput)
    expect(warnings).toEqual([])
  })

  describe("talent-missing-calls", () => {
    it("warns when participatingTalentIds has uncalled talent", () => {
      const warnings = computeTrustWarnings({
        ...emptyInput,
        schedule: makeSchedule(),
        participatingTalentIds: ["t1", "t2"],
        talentCalls: [makeTalentCall({ talentId: "t1" })],
      })
      expect(warnings).toHaveLength(1)
      expect(warnings[0]!.id).toBe("talent-missing-calls")
      expect(warnings[0]!.message).toContain("1 talent member")
    })

    it("warns with correct plural for multiple missing", () => {
      const warnings = computeTrustWarnings({
        ...emptyInput,
        schedule: makeSchedule(),
        participatingTalentIds: ["t1", "t2", "t3"],
        talentCalls: [],
      })
      expect(warnings[0]!.message).toContain("3 talent members")
    })

    it("does not warn when all participating talent have calls", () => {
      const warnings = computeTrustWarnings({
        ...emptyInput,
        schedule: makeSchedule(),
        participatingTalentIds: ["t1"],
        talentCalls: [makeTalentCall({ talentId: "t1" })],
      })
      const talentWarning = warnings.find((w) => w.id === "talent-missing-calls")
      expect(talentWarning).toBeUndefined()
    })

    it("does not warn when participatingTalentIds is empty", () => {
      const warnings = computeTrustWarnings({
        ...emptyInput,
        schedule: makeSchedule(),
        participatingTalentIds: [],
      })
      const talentWarning = warnings.find((w) => w.id === "talent-missing-calls")
      expect(talentWarning).toBeUndefined()
    })
  })

  describe("crew-before-crew-call", () => {
    it("warns when a crew override is earlier than crew call", () => {
      const warnings = computeTrustWarnings({
        ...emptyInput,
        dayDetails: makeDayDetails({ crewCallTime: "6:00 AM" }),
        crewCalls: [makeCrewCall({ callTime: "5:30 AM" })],
        crewLibrary: [makeCrewRecord()],
      })
      const warning = warnings.find((w) => w.id === "crew-before-crew-call")
      expect(warning).toBeDefined()
      expect(warning!.message).toContain("Jane Gaffer")
      expect(warning!.message).toContain("6:00 AM")
    })

    it("does not warn when crew call is at or after crew call time", () => {
      const warnings = computeTrustWarnings({
        ...emptyInput,
        dayDetails: makeDayDetails({ crewCallTime: "6:00 AM" }),
        crewCalls: [makeCrewCall({ callTime: "6:30 AM" })],
        crewLibrary: [makeCrewRecord()],
      })
      const warning = warnings.find((w) => w.id === "crew-before-crew-call")
      expect(warning).toBeUndefined()
    })

    it("does not warn when crew has no override call time", () => {
      const warnings = computeTrustWarnings({
        ...emptyInput,
        dayDetails: makeDayDetails({ crewCallTime: "6:00 AM" }),
        crewCalls: [makeCrewCall({ callTime: null })],
        crewLibrary: [makeCrewRecord()],
      })
      const warning = warnings.find((w) => w.id === "crew-before-crew-call")
      expect(warning).toBeUndefined()
    })
  })

  describe("no-schedule-entries", () => {
    it("warns when entries array is empty", () => {
      const warnings = computeTrustWarnings({
        ...emptyInput,
        entries: [],
      })
      const warning = warnings.find((w) => w.id === "no-schedule-entries")
      expect(warning).toBeDefined()
    })

    it("does not warn when entries exist", () => {
      const warnings = computeTrustWarnings(emptyInput)
      const warning = warnings.find((w) => w.id === "no-schedule-entries")
      expect(warning).toBeUndefined()
    })
  })

  describe("wrap-before-last-entry", () => {
    it("warns when estimated wrap is before last entry time", () => {
      const warnings = computeTrustWarnings({
        ...emptyInput,
        dayDetails: makeDayDetails({ estimatedWrap: "5:00 PM" }),
        entries: [
          makeEntry({ order: 1, time: "9:00 AM" }),
          makeEntry({ id: "e2", order: 2, time: "6:00 PM" }),
        ],
      })
      const warning = warnings.find((w) => w.id === "wrap-before-last-entry")
      expect(warning).toBeDefined()
      expect(warning!.message).toContain("5:00 PM")
      expect(warning!.message).toContain("6:00 PM")
    })

    it("does not warn when wrap is after last entry", () => {
      const warnings = computeTrustWarnings({
        ...emptyInput,
        dayDetails: makeDayDetails({ estimatedWrap: "7:00 PM" }),
        entries: [makeEntry({ order: 1, time: "5:00 PM" })],
      })
      const warning = warnings.find((w) => w.id === "wrap-before-last-entry")
      expect(warning).toBeUndefined()
    })

    it("does not warn when last entry has no time", () => {
      const warnings = computeTrustWarnings({
        ...emptyInput,
        dayDetails: makeDayDetails({ estimatedWrap: "5:00 PM" }),
        entries: [makeEntry({ order: 1 })],
      })
      const warning = warnings.find((w) => w.id === "wrap-before-last-entry")
      expect(warning).toBeUndefined()
    })

    it("does not warn when estimated wrap is empty", () => {
      const warnings = computeTrustWarnings({
        ...emptyInput,
        dayDetails: makeDayDetails({ estimatedWrap: "" }),
        entries: [makeEntry({ order: 1, time: "6:00 PM" })],
      })
      const warning = warnings.find((w) => w.id === "wrap-before-last-entry")
      expect(warning).toBeUndefined()
    })
  })

  describe("24-hour time format support", () => {
    it("handles 24-hour format for crew call comparison", () => {
      const warnings = computeTrustWarnings({
        ...emptyInput,
        dayDetails: makeDayDetails({ crewCallTime: "06:00" }),
        crewCalls: [makeCrewCall({ callTime: "05:30" })],
        crewLibrary: [makeCrewRecord()],
      })
      const warning = warnings.find((w) => w.id === "crew-before-crew-call")
      expect(warning).toBeDefined()
    })
  })
})
