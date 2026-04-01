import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("firebase/firestore", () => ({
  writeBatch: vi.fn(),
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({
    path: segments.join("/"),
  })),
  serverTimestamp: vi.fn(() => ({ _type: "serverTimestamp" })),
  addDoc: vi.fn(),
  collection: vi.fn(),
  updateDoc: vi.fn(),
}))

vi.mock("@/shared/lib/firebase", () => ({ db: {} }))

vi.mock("@/shared/lib/paths", () => ({
  shotPath: (shotId: string, clientId: string) => [
    "clients",
    clientId,
    "shots",
    shotId,
  ],
  shotsPath: (clientId: string) => ["clients", clientId, "shots"],
}))

vi.mock("@/features/shots/lib/shotVersioning", () => ({
  createShotVersionSnapshot: vi.fn(),
}))

import * as firestore from "firebase/firestore"
import { bulkSoftDeleteShots } from "./shotLifecycleActions"

describe("bulkSoftDeleteShots", () => {
  let mockBatchUpdate: ReturnType<typeof vi.fn>
  let mockBatchCommit: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()

    mockBatchUpdate = vi.fn()
    mockBatchCommit = vi.fn().mockResolvedValue(undefined)

    vi.mocked(firestore.writeBatch).mockReturnValue({
      set: vi.fn(),
      commit: mockBatchCommit,
      delete: vi.fn(),
      update: mockBatchUpdate,
    } as unknown as ReturnType<typeof firestore.writeBatch>)
  })

  it("does nothing for empty shotIds array", async () => {
    await bulkSoftDeleteShots({
      clientId: "c1",
      shotIds: [],
      user: null,
    })
    expect(firestore.writeBatch).not.toHaveBeenCalled()
  })

  it("calls batch.update with correct fields for each shot", async () => {
    await bulkSoftDeleteShots({
      clientId: "c1",
      shotIds: ["s1", "s2", "s3"],
      user: { uid: "u1" } as Parameters<typeof bulkSoftDeleteShots>[0]["user"],
    })

    expect(firestore.writeBatch).toHaveBeenCalledTimes(1)
    expect(mockBatchUpdate).toHaveBeenCalledTimes(3)
    expect(mockBatchCommit).toHaveBeenCalledTimes(1)

    const firstCallData = mockBatchUpdate.mock.calls[0]![1] as Record<
      string,
      unknown
    >
    expect(firstCallData["deleted"]).toBe(true)
    expect(firstCallData["deletedAt"]).toEqual({ _type: "serverTimestamp" })
    expect(firstCallData["updatedAt"]).toEqual({ _type: "serverTimestamp" })
    expect(firstCallData["updatedBy"]).toBe("u1")
  })

  it("omits updatedBy when user is null", async () => {
    await bulkSoftDeleteShots({
      clientId: "c1",
      shotIds: ["s1"],
      user: null,
    })

    const data = mockBatchUpdate.mock.calls[0]![1] as Record<string, unknown>
    expect(data["deleted"]).toBe(true)
    expect(data).not.toHaveProperty("updatedBy")
  })

  it("chunks into batches of 250", async () => {
    const ids = Array.from({ length: 300 }, (_, i) => `s${i}`)

    await bulkSoftDeleteShots({
      clientId: "c1",
      shotIds: ids,
      user: null,
    })

    expect(firestore.writeBatch).toHaveBeenCalledTimes(2)
    expect(mockBatchCommit).toHaveBeenCalledTimes(2)
    expect(mockBatchUpdate).toHaveBeenCalledTimes(300)
  })

  it("creates doc refs with correct paths", async () => {
    await bulkSoftDeleteShots({
      clientId: "c1",
      shotIds: ["shot-abc"],
      user: null,
    })

    expect(firestore.doc).toHaveBeenCalledWith(
      {},
      "clients",
      "c1",
      "shots",
      "shot-abc",
    )
  })
})
