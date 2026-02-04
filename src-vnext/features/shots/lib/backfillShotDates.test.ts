import { describe, it, expect, vi, beforeEach } from "vitest"
import { backfillMissingShotDates } from "@/features/shots/lib/backfillShotDates"

vi.mock("@/shared/lib/firebase", () => ({
  db: { __db: true },
}))

const mockWriteBatchUpdate = vi.fn()
const mockWriteBatchCommit = vi.fn(async () => undefined)

vi.mock("firebase/firestore", () => {
  return {
    collection: vi.fn(() => ({ __coll: true })),
    getDocs: vi.fn(),
    query: vi.fn((...args: unknown[]) => ({ __query: args })),
    where: vi.fn((...args: unknown[]) => ({ __where: args })),
    serverTimestamp: vi.fn(() => ({ __serverTs: true })),
    writeBatch: vi.fn(() => ({
      update: mockWriteBatchUpdate,
      commit: mockWriteBatchCommit,
    })),
  }
})

vi.mock("@/shared/lib/paths", () => ({
  shotsPath: () => ["clients", "c1", "shots"],
}))

type FakeDoc = {
  readonly ref: { readonly id: string }
  readonly data: () => Record<string, unknown>
}

function makeDoc(id: string, data: Record<string, unknown>): FakeDoc {
  return {
    ref: { id },
    data: () => data,
  }
}

describe("backfillMissingShotDates", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("updates only non-deleted shots missing list-required fields", async () => {
    const { getDocs } = await import("firebase/firestore")
    ;(getDocs as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      size: 5,
      docs: [
        makeDoc("a", { projectId: "p1", deleted: false }), // missing date -> update
        makeDoc("b", { projectId: "p1", deleted: false, date: null }), // already present -> no update
        makeDoc("c", { projectId: "p1", deleted: true }), // deleted -> no update
        makeDoc("d", { projectId: "p1" }), // missing deleted, missing date -> update (needs deleted:false too)
        makeDoc("e", { projectId: "p1", date: { seconds: 1, nanoseconds: 0 } }), // has date -> no update
      ],
    })

    const res = await backfillMissingShotDates({
      clientId: "c1",
      projectId: "p1",
      updatedBy: "u1",
    })

    expect(res.scanned).toBe(5)
    expect(res.updated).toBe(3)
    expect(mockWriteBatchUpdate).toHaveBeenCalledTimes(3)
    expect(mockWriteBatchCommit).toHaveBeenCalledTimes(1)

    const payloads = mockWriteBatchUpdate.mock.calls.map((c) => c?.[1]) as Record<string, unknown>[]
    expect(payloads.every((p) => p.updatedBy === "u1")).toBe(true)
    expect(payloads.every((p) => (p.updatedAt as { __serverTs?: boolean } | undefined)?.__serverTs === true)).toBe(true)
    expect(payloads.some((p) => p.date === null)).toBe(true)
    expect(payloads.some((p) => p.deleted === false)).toBe(true)
  })
})
