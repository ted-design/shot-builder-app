import { describe, expect, it } from "vitest"
import {
  filterCrewCallsByTrack,
  filterTalentCallsByTrack,
} from "../trackFiltering"
import type { CrewCallSheet, TalentCallSheet } from "@/shared/types"

function makeCrewCall(
  overrides: Partial<CrewCallSheet> & { id: string; crewMemberId: string },
): CrewCallSheet {
  return { ...overrides } as CrewCallSheet
}

function makeTalentCall(
  overrides: Partial<TalentCallSheet> & { id: string; talentId: string },
): TalentCallSheet {
  return { ...overrides } as TalentCallSheet
}

describe("filterCrewCallsByTrack", () => {
  it("returns all calls when trackId filter is null", () => {
    const calls = [
      makeCrewCall({ id: "c1", crewMemberId: "m1" }),
      makeCrewCall({ id: "c2", crewMemberId: "m2", trackId: "track-a" } as never),
      makeCrewCall({ id: "c3", crewMemberId: "m3", trackId: "track-b" } as never),
    ]

    const result = filterCrewCallsByTrack(calls, null)

    expect(result).toHaveLength(3)
    expect(result.map((c) => c.id)).toEqual(["c1", "c2", "c3"])
  })

  it("returns unscoped and matching calls for a specific trackId", () => {
    const calls = [
      makeCrewCall({ id: "c1", crewMemberId: "m1" }),
      makeCrewCall({ id: "c2", crewMemberId: "m2", trackId: "track-a" } as never),
      makeCrewCall({ id: "c3", crewMemberId: "m3", trackId: "track-b" } as never),
    ]

    const result = filterCrewCallsByTrack(calls, "track-a")

    expect(result).toHaveLength(2)
    expect(result.map((c) => c.id)).toEqual(["c1", "c2"])
  })

  it("excludes calls scoped to a different track", () => {
    const calls = [
      makeCrewCall({ id: "c1", crewMemberId: "m1", trackId: "track-b" } as never),
      makeCrewCall({ id: "c2", crewMemberId: "m2", trackId: "track-b" } as never),
    ]

    const result = filterCrewCallsByTrack(calls, "track-a")

    expect(result).toHaveLength(0)
    expect(result).toEqual([])
  })

  it("treats null trackId on a call as unscoped (included in any filter)", () => {
    const calls = [
      makeCrewCall({ id: "c1", crewMemberId: "m1", trackId: null } as never),
    ]

    const result = filterCrewCallsByTrack(calls, "track-a")

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("c1")
  })

  it("returns empty array for empty input", () => {
    const result = filterCrewCallsByTrack([], "track-a")

    expect(result).toHaveLength(0)
    expect(result).toEqual([])
  })

  it("returns all calls when all are unscoped and filter is specific", () => {
    const calls = [
      makeCrewCall({ id: "c1", crewMemberId: "m1" }),
      makeCrewCall({ id: "c2", crewMemberId: "m2" }),
      makeCrewCall({ id: "c3", crewMemberId: "m3" }),
    ]

    const result = filterCrewCallsByTrack(calls, "track-a")

    expect(result).toHaveLength(3)
    expect(result.map((c) => c.id)).toEqual(["c1", "c2", "c3"])
  })
})

describe("filterTalentCallsByTrack", () => {
  it("returns all calls when trackId filter is null", () => {
    const calls = [
      makeTalentCall({ id: "t1", talentId: "a1" }),
      makeTalentCall({ id: "t2", talentId: "a2", trackId: "track-a" } as never),
      makeTalentCall({ id: "t3", talentId: "a3", trackId: "track-b" } as never),
    ]

    const result = filterTalentCallsByTrack(calls, null)

    expect(result).toHaveLength(3)
    expect(result.map((c) => c.id)).toEqual(["t1", "t2", "t3"])
  })

  it("returns unscoped and matching talent calls for a specific trackId", () => {
    const calls = [
      makeTalentCall({ id: "t1", talentId: "a1" }),
      makeTalentCall({ id: "t2", talentId: "a2", trackId: "track-a" } as never),
      makeTalentCall({ id: "t3", talentId: "a3", trackId: "track-b" } as never),
    ]

    const result = filterTalentCallsByTrack(calls, "track-a")

    expect(result).toHaveLength(2)
    expect(result.map((c) => c.id)).toEqual(["t1", "t2"])
  })

  it("excludes talent calls scoped to a different track", () => {
    const calls = [
      makeTalentCall({ id: "t1", talentId: "a1", trackId: "track-b" } as never),
      makeTalentCall({ id: "t2", talentId: "a2", trackId: "track-b" } as never),
    ]

    const result = filterTalentCallsByTrack(calls, "track-a")

    expect(result).toHaveLength(0)
    expect(result).toEqual([])
  })

  it("preserves order of filtered results", () => {
    const calls = [
      makeTalentCall({ id: "t1", talentId: "a1", trackId: "track-a" } as never),
      makeTalentCall({ id: "t2", talentId: "a2", trackId: "track-b" } as never),
      makeTalentCall({ id: "t3", talentId: "a3" }),
      makeTalentCall({ id: "t4", talentId: "a4", trackId: "track-a" } as never),
    ]

    const result = filterTalentCallsByTrack(calls, "track-a")

    expect(result).toHaveLength(3)
    expect(result.map((c) => c.id)).toEqual(["t1", "t3", "t4"])
  })
})
