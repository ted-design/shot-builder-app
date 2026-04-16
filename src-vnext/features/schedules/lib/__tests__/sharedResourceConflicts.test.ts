import { describe, expect, it } from "vitest"
import {
  detectSharedResourceConflicts,
  type SharedResourceConflict,
} from "../sharedResourceConflicts"
import type { TalentCallSheet, TalentRecord } from "@/shared/types"

// ─── Factories ────────────────────────────────────────────────────────

function makeTalentCall(
  id: string,
  talentId: string,
  trackId?: string,
): TalentCallSheet {
  return { id, talentId, trackId } as TalentCallSheet
}

function makeTalent(id: string, name: string): TalentRecord {
  return { id, name } as TalentRecord
}

// ─── Tests ────────────────────────────────────────────────────────────

describe("detectSharedResourceConflicts", () => {
  it("returns empty for no talent calls", () => {
    const result = detectSharedResourceConflicts([], [])
    expect(result).toEqual([])
  })

  it("returns empty when all talent are on a single track", () => {
    const calls = [
      makeTalentCall("c1", "t1", "track-a"),
      makeTalentCall("c2", "t2", "track-a"),
    ]
    const talent = [makeTalent("t1", "Alice"), makeTalent("t2", "Bob")]
    const result = detectSharedResourceConflicts(calls, talent)
    expect(result).toEqual([])
  })

  it("returns empty when talent calls are unscoped", () => {
    const calls = [
      makeTalentCall("c1", "t1", undefined),
      makeTalentCall("c2", "t1", undefined),
    ]
    const talent = [makeTalent("t1", "Alice")]
    const result = detectSharedResourceConflicts(calls, talent)
    expect(result).toEqual([])
  })

  it("detects talent assigned to 2 different tracks", () => {
    const calls = [
      makeTalentCall("c1", "t1", "track-a"),
      makeTalentCall("c2", "t1", "track-b"),
    ]
    const talent = [makeTalent("t1", "Alice")]
    const result = detectSharedResourceConflicts(calls, talent)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual<SharedResourceConflict>({
      resourceType: "talent",
      resourceId: "t1",
      resourceName: "Alice",
      trackIds: ["track-a", "track-b"],
    })
  })

  it("does not flag talent on one scoped + one unscoped call", () => {
    const calls = [
      makeTalentCall("c1", "t1", "track-a"),
      makeTalentCall("c2", "t1", undefined),
    ]
    const talent = [makeTalent("t1", "Alice")]
    const result = detectSharedResourceConflicts(calls, talent)
    expect(result).toEqual([])
  })

  it("detects multiple conflicting talent", () => {
    const calls = [
      makeTalentCall("c1", "t1", "track-a"),
      makeTalentCall("c2", "t1", "track-b"),
      makeTalentCall("c3", "t2", "track-a"),
      makeTalentCall("c4", "t2", "track-c"),
    ]
    const talent = [makeTalent("t1", "Alice"), makeTalent("t2", "Bob")]
    const result = detectSharedResourceConflicts(calls, talent)
    expect(result).toHaveLength(2)

    const byId = new Map(result.map((c) => [c.resourceId, c]))
    expect(byId.get("t1")?.trackIds).toEqual(["track-a", "track-b"])
    expect(byId.get("t2")?.trackIds).toEqual(["track-a", "track-c"])
  })

  it("resolves resource name from talent lookup", () => {
    const calls = [
      makeTalentCall("c1", "t1", "track-a"),
      makeTalentCall("c2", "t1", "track-b"),
    ]
    const talent = [makeTalent("t1", "Alice")]
    const result = detectSharedResourceConflicts(calls, talent)
    expect(result[0]?.resourceName).toBe("Alice")
  })

  it("falls back to talentId when not found in lookup", () => {
    const calls = [
      makeTalentCall("c1", "t-unknown", "track-a"),
      makeTalentCall("c2", "t-unknown", "track-b"),
    ]
    const result = detectSharedResourceConflicts(calls, [])
    expect(result).toHaveLength(1)
    expect(result[0]?.resourceName).toBe("t-unknown")
  })
})
