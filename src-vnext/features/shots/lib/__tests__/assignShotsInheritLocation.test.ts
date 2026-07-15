import { describe, it, expect, vi, beforeEach } from "vitest"

// Sets initiative — Phase 1, location inheritance (D3). When shots are assigned
// to a Set (Lane) that HAS a location, each shot adopts the Set's
// locationId/locationName. Inheritance must fire ONLY when laneId is non-null
// AND a real locationId is supplied — never on ungroup, never on a location-less
// Set — so a shot's own (possibly-overridden) location is never silently wiped.
//
// Mirrors the Firestore-write mocking pattern in backfillShotDates.test.ts.

vi.mock("@/shared/lib/firebase", () => ({ db: { __db: true } }))

const mockUpdate = vi.fn()
const mockCommit = vi.fn(async () => undefined)

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({ __coll: true })),
  doc: vi.fn((...args: unknown[]) => ({ __doc: args })),
  setDoc: vi.fn(async () => undefined),
  updateDoc: vi.fn(async () => undefined),
  deleteDoc: vi.fn(async () => undefined),
  serverTimestamp: vi.fn(() => ({ __serverTs: true })),
  writeBatch: vi.fn(() => ({ update: mockUpdate, commit: mockCommit })),
}))

vi.mock("@/shared/lib/paths", () => ({
  lanesPath: () => ["clients", "c1", "projects", "p1", "lanes"],
  laneDocPath: () => ["clients", "c1", "projects", "p1", "lanes", "lane-1"],
  shotsPath: () => ["clients", "c1", "shots"],
}))

async function assign(
  params: Parameters<
    typeof import("../laneActions")["assignShotsToLane"]
  >[0],
): Promise<number> {
  const { assignShotsToLane } = await import("../laneActions")
  return assignShotsToLane(params)
}

function payloads(): Record<string, unknown>[] {
  return mockUpdate.mock.calls.map((c) => c?.[1] as Record<string, unknown>)
}

function firstPayload(): Record<string, unknown> {
  const p = mockUpdate.mock.calls[0]?.[1] as Record<string, unknown> | undefined
  if (!p) throw new Error("expected a batch.update call, got none")
  return p
}

describe("assignShotsToLane — Sets location inheritance", () => {
  beforeEach(() => vi.clearAllMocks())

  it("copies the Set's location onto every shot when assigning to a located Set", async () => {
    const n = await assign({
      shotIds: ["s1", "s2"],
      laneId: "lane-1",
      projectId: "p1",
      clientId: "c1",
      inheritLocation: { locationId: "loc-b", locationName: "Studio B" },
    })
    expect(n).toBe(2)
    expect(mockUpdate).toHaveBeenCalledTimes(2)
    for (const p of payloads()) {
      expect(p.laneId).toBe("lane-1")
      expect(p.locationId).toBe("loc-b")
      expect(p.locationName).toBe("Studio B")
      expect((p.updatedAt as { __serverTs?: boolean }).__serverTs).toBe(true)
    }
  })

  it("does NOT touch location when the Set has no location (no inheritLocation)", async () => {
    await assign({ shotIds: ["s1"], laneId: "lane-1", projectId: "p1", clientId: "c1" })
    const p = firstPayload()
    expect(p.laneId).toBe("lane-1")
    expect("locationId" in p).toBe(false)
    expect("locationName" in p).toBe(false)
  })

  it("does NOT inherit when ungrouping (laneId=null), even if a location is passed", async () => {
    await assign({
      shotIds: ["s1"],
      laneId: null,
      projectId: "p1",
      clientId: "c1",
      inheritLocation: { locationId: "loc-b", locationName: "Studio B" },
    })
    const p = firstPayload()
    expect(p.laneId).toBeNull()
    expect("locationId" in p).toBe(false)
    expect("locationName" in p).toBe(false)
  })

  it("does NOT inherit when inheritLocation carries an empty locationId", async () => {
    await assign({
      shotIds: ["s1"],
      laneId: "lane-1",
      projectId: "p1",
      clientId: "c1",
      inheritLocation: { locationId: "", locationName: "x" },
    })
    const p = firstPayload()
    expect("locationId" in p).toBe(false)
  })

  it("denormalizes a missing locationName to null (Firestore-safe, not undefined)", async () => {
    await assign({
      shotIds: ["s1"],
      laneId: "lane-1",
      projectId: "p1",
      clientId: "c1",
      inheritLocation: { locationId: "loc-b" },
    })
    const p = firstPayload()
    expect(p.locationId).toBe("loc-b")
    expect(p.locationName).toBeNull()
  })
})
