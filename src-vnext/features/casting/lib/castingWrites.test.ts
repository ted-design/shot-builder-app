/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((...args: unknown[]) => ({ path: args.join("/") })),
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({
    path: segments.join("/"),
  })),
  getDocs: vi.fn(),
  writeBatch: vi.fn(),
  serverTimestamp: vi.fn(() => ({ _methodName: "serverTimestamp" })),
  updateDoc: vi.fn(),
  setDoc: vi.fn(),
  arrayUnion: vi.fn(),
}))

vi.mock("@/shared/lib/firebase", () => ({ db: {} }))

vi.mock("@/shared/lib/paths", () => ({
  castingBoardPath: (projectId: string, clientId: string) => [
    "clients",
    clientId,
    "projects",
    projectId,
    "castingBoard",
  ],
  castingBoardDocPath: (
    entryId: string,
    projectId: string,
    clientId: string,
  ) => [
    "clients",
    clientId,
    "projects",
    projectId,
    "castingBoard",
    entryId,
  ],
  castingShareDocPath: (token: string) => ["castingShares", token],
  castingShareVoteDocPath: (token: string, voteId: string) => [
    "castingShares",
    token,
    "votes",
    voteId,
  ],
  talentPath: (clientId: string) => ["clients", clientId, "talent"],
}))

import * as firestore from "firebase/firestore"
import { updateCastingEntryVisibility } from "./castingWrites"

describe("updateCastingEntryVisibility", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(firestore.updateDoc).mockResolvedValue(undefined)
  })

  it("writes the sanitized visibility payload to the talent's entry doc", async () => {
    await updateCastingEntryVisibility({
      clientId: "c1",
      projectId: "p1",
      talentId: "t1",
      hiddenImageIds: ["g1", "s1i2"],
      hiddenSessionIds: ["s2"],
    })

    expect(firestore.updateDoc).toHaveBeenCalledTimes(1)
    const call = vi.mocked(firestore.updateDoc).mock.calls[0] as unknown[]
    const ref = call[0] as { path: string }
    const payload = call[1] as Record<string, unknown>

    // Doc ref resolves via castingBoardDocPath(talentId, projectId, clientId)
    expect(ref.path).toBe(
      "clients/c1/projects/p1/castingBoard/t1",
    )

    // Real sanitizeForFirestore ran: arrays survive, serverTimestamp sentinel passes through.
    expect(payload).toEqual({
      hiddenImageIds: ["g1", "s1i2"],
      hiddenSessionIds: ["s2"],
      updatedAt: { _methodName: "serverTimestamp" },
    })
  })

  it("survives empty arrays unchanged", async () => {
    await updateCastingEntryVisibility({
      clientId: "c1",
      projectId: "p1",
      talentId: "t1",
      hiddenImageIds: [],
      hiddenSessionIds: [],
    })
    const call = vi.mocked(firestore.updateDoc).mock.calls[0] as unknown[]
    const payload = call[1] as Record<string, unknown>
    expect(payload["hiddenImageIds"]).toEqual([])
    expect(payload["hiddenSessionIds"]).toEqual([])
    expect(payload["updatedAt"]).toEqual({ _methodName: "serverTimestamp" })
  })
})
