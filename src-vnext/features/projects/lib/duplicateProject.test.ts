import { describe, expect, it, vi, beforeEach } from "vitest"

// All Firestore mocked (getDoc/getDocs/writeBatch) — zero live writes.
vi.mock("firebase/firestore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("firebase/firestore")>()
  return {
    ...actual,
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    writeBatch: vi.fn(),
    collection: vi.fn((...args: unknown[]) => ({ __col: args.join("/") })),
    doc: vi.fn((...args: unknown[]) => {
      if (args.length === 1) {
        return { id: `new-${Math.random().toString(36).slice(2, 10)}` }
      }
      const segs = args.slice(1) as string[]
      return { id: segs[segs.length - 1], path: segs.join("/") }
    }),
    query: vi.fn((...args: unknown[]) => ({ __query: args })),
    where: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
    serverTimestamp: vi.fn(() => ({ _methodName: "serverTimestamp" })),
  }
})

vi.mock("@/shared/lib/firebase", () => ({ db: {} }))

import * as firestore from "firebase/firestore"
import {
  duplicateProject,
  DuplicateProjectPartialFailureError,
} from "@/features/projects/lib/duplicateProject"
import type { AuthUser } from "@/shared/types"

const USER: AuthUser = { uid: "u1", email: null, displayName: null, photoURL: null }

function fakeDocSnap(id: string, data: Record<string, unknown> | undefined) {
  return {
    id,
    exists: () => data !== undefined,
    data: () => data,
  }
}

function fakeQuerySnap(docs: ReadonlyArray<{ id: string; data: Record<string, unknown> }>) {
  return { docs: docs.map((d) => fakeDocSnap(d.id, d.data)) }
}

describe("duplicateProject", () => {
  let mockBatchSet: ReturnType<typeof vi.fn>
  let mockBatchCommit: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // resetAllMocks (not clearAllMocks): getDoc/getDocs are re-armed per test
    // via mockResolvedValueOnce chains in mockReads() — clearAllMocks only
    // clears call history, leaving unconsumed "once" queues from a PRIOR
    // test to leak into the next one and serve stale data.
    vi.resetAllMocks()
    mockBatchSet = vi.fn()
    mockBatchCommit = vi.fn().mockResolvedValue(undefined)
    vi.mocked(firestore.writeBatch).mockReturnValue({
      set: mockBatchSet,
      update: vi.fn(),
      delete: vi.fn(),
      commit: mockBatchCommit,
    } as unknown as ReturnType<typeof firestore.writeBatch>)
  })

  function mockReads(params: {
    readonly project: Record<string, unknown> | undefined
    readonly lanes: ReadonlyArray<{ id: string; data: Record<string, unknown> }>
    readonly shots: ReadonlyArray<{ id: string; data: Record<string, unknown> }>
  }) {
    vi.mocked(firestore.getDoc).mockResolvedValue(
      fakeDocSnap("src-p1", params.project) as unknown as Awaited<ReturnType<typeof firestore.getDoc>>,
    )
    vi.mocked(firestore.getDocs)
      .mockResolvedValueOnce(fakeQuerySnap(params.lanes) as unknown as Awaited<ReturnType<typeof firestore.getDocs>>)
      .mockResolvedValueOnce(fakeQuerySnap(params.shots) as unknown as Awaited<ReturnType<typeof firestore.getDocs>>)
  }

  it("source project not found throws a plain Error and writes nothing", async () => {
    mockReads({ project: undefined, lanes: [], shots: [] })
    await expect(
      duplicateProject({ clientId: "c1", sourceProjectId: "src-p1", newName: "Copy", role: "producer", user: USER }),
    ).rejects.toThrow("Source project not found.")
    expect(mockBatchCommit).not.toHaveBeenCalled()
  })

  it("duplicating an ARCHIVED project creates the new project as active (mutation: force source status -> reddens)", async () => {
    mockReads({
      project: { name: "Old Job", status: "archived", visibility: "team", shootDates: ["2026-01-01"] },
      lanes: [],
      shots: [],
    })
    await duplicateProject({ clientId: "c1", sourceProjectId: "src-p1", newName: "Old Job (Copy)", role: "producer", user: USER })

    const projectPayload = mockBatchSet.mock.calls[0]![1] as Record<string, unknown>
    expect(projectPayload["status"]).toBe("active")
    expect(projectPayload["name"]).toBe("Old Job (Copy)")
    expect(projectPayload["visibility"]).toBe("team")
    expect(projectPayload["shootDates"]).toEqual(["2026-01-01"])
  })

  it("auto-membership: non-admin creator gets a producer membership doc", async () => {
    mockReads({ project: { name: "P", status: "active", shootDates: [] }, lanes: [], shots: [] })
    await duplicateProject({ clientId: "c1", sourceProjectId: "src-p1", newName: "P (Copy)", role: "crew", user: USER })
    // Project batch: [0] = project doc, [1] = membership doc (crew is non-admin).
    expect(mockBatchSet).toHaveBeenCalledTimes(2)
    const membershipPayload = mockBatchSet.mock.calls[1]![1] as Record<string, unknown>
    expect(membershipPayload["role"]).toBe("producer")
  })

  it("auto-membership: admin creator does NOT get a membership doc", async () => {
    mockReads({ project: { name: "P", status: "active", shootDates: [] }, lanes: [], shots: [] })
    await duplicateProject({ clientId: "c1", sourceProjectId: "src-p1", newName: "P (Copy)", role: "admin", user: USER })
    expect(mockBatchSet).toHaveBeenCalledTimes(1) // project doc only
  })

  it("clones lanes with new ids and remaps shot laneId through the map; missing lane -> null", async () => {
    mockReads({
      project: { name: "P", status: "active", shootDates: [] },
      lanes: [{ id: "lane-A", data: { name: "Scene A", projectId: "src-p1", clientId: "c1", sortOrder: 0 } }],
      shots: [
        {
          id: "shot-1",
          data: {
            title: "In Lane", projectId: "src-p1", clientId: "c1", status: "todo",
            laneId: "lane-A", sortOrder: 5, deleted: false,
          },
        },
        {
          id: "shot-2",
          data: {
            title: "Orphan Lane", projectId: "src-p1", clientId: "c1", status: "todo",
            laneId: "lane-MISSING", sortOrder: 6, deleted: false,
          },
        },
      ],
    })

    await duplicateProject({ clientId: "c1", sourceProjectId: "src-p1", newName: "P (Copy)", role: "admin", user: USER })

    // set() calls: [0] project, [1] lane, [2] shot-1, [3] shot-2 (admin -> no membership doc).
    const lanePayload = mockBatchSet.mock.calls[1]![1] as Record<string, unknown>
    const newLaneRefId = (mockBatchSet.mock.calls[1]![0] as { id: string }).id
    expect(lanePayload["name"]).toBe("Scene A")

    const shot1Payload = mockBatchSet.mock.calls[2]![1] as Record<string, unknown>
    expect(shot1Payload["laneId"]).toBe(newLaneRefId)

    const shot2Payload = mockBatchSet.mock.calls[3]![1] as Record<string, unknown>
    expect(shot2Payload["laneId"]).toBeNull()
  })

  it("TRUE CLONE: preserves status, date, shotNumber, sortOrder exactly", async () => {
    mockReads({
      project: { name: "P", status: "active", shootDates: [] },
      lanes: [],
      shots: [
        {
          id: "shot-1",
          data: {
            title: "Hero", projectId: "src-p1", clientId: "c1", status: "complete",
            shotNumber: "14A", sortOrder: 42, date: { seconds: 1000, nanoseconds: 0 }, deleted: false,
          },
        },
      ],
    })
    await duplicateProject({ clientId: "c1", sourceProjectId: "src-p1", newName: "P (Copy)", role: "admin", user: USER })
    const payload = mockBatchSet.mock.calls[1]![1] as Record<string, unknown> // [0]=project, [1]=shot (no lanes)
    expect(payload["status"]).toBe("complete")
    expect(payload["shotNumber"]).toBe("14A")
    expect(payload["sortOrder"]).toBe(42)
    expect(payload["title"]).toBe("Hero") // unchanged, no "(Copy)" suffix
  })

  it("query semantics: a legacy shot with NO `deleted` field is still cloned (mutation: add ==false filter -> reddens)", async () => {
    mockReads({
      project: { name: "P", status: "active", shootDates: [] },
      lanes: [],
      shots: [
        {
          id: "legacy-shot",
          data: { title: "Legacy", projectId: "src-p1", clientId: "c1", status: "todo", sortOrder: 1 },
          // deliberately no `deleted` key at all
        },
      ],
    })
    const result = await duplicateProject({
      clientId: "c1", sourceProjectId: "src-p1", newName: "P (Copy)", role: "admin", user: USER,
    })
    expect(result.shotCount).toBe(1)
    const payload = mockBatchSet.mock.calls[1]![1] as Record<string, unknown>
    expect(payload["title"]).toBe("Legacy")
  })

  it("skips a genuinely soft-deleted shot (deleted === true)", async () => {
    mockReads({
      project: { name: "P", status: "active", shootDates: [] },
      lanes: [],
      shots: [
        { id: "gone", data: { title: "Deleted", projectId: "src-p1", clientId: "c1", status: "todo", sortOrder: 1, deleted: true } },
        { id: "kept", data: { title: "Kept", projectId: "src-p1", clientId: "c1", status: "todo", sortOrder: 2, deleted: false } },
      ],
    })
    const result = await duplicateProject({
      clientId: "c1", sourceProjectId: "src-p1", newName: "P (Copy)", role: "admin", user: USER,
    })
    expect(result.shotCount).toBe(1)
    const payload = mockBatchSet.mock.calls[1]![1] as Record<string, unknown>
    expect(payload["title"]).toBe("Kept")
  })

  it("partial failure on the LANES step surfaces a DuplicateProjectPartialFailureError naming 0 shots copied", async () => {
    mockReads({
      project: { name: "P", status: "active", shootDates: [] },
      lanes: [{ id: "lane-A", data: { name: "A", projectId: "src-p1", clientId: "c1", sortOrder: 0 } }],
      shots: [],
    })
    // First commit (project batch) succeeds; second commit (lane batch) fails.
    mockBatchCommit.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("network down"))

    await expect(
      duplicateProject({ clientId: "c1", sourceProjectId: "src-p1", newName: "P (Copy)", role: "admin", user: USER }),
    ).rejects.toBeInstanceOf(DuplicateProjectPartialFailureError)
  })

  it("partial failure on the SHOTS step names how many shots landed before it failed", async () => {
    mockReads({
      project: { name: "P", status: "active", shootDates: [] },
      lanes: [],
      shots: [
        { id: "s1", data: { title: "A", projectId: "src-p1", clientId: "c1", status: "todo", sortOrder: 1, deleted: false } },
      ],
    })
    // project batch commit ok, shots batch commit fails.
    mockBatchCommit.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("write failed"))

    try {
      await duplicateProject({ clientId: "c1", sourceProjectId: "src-p1", newName: "P (Copy)", role: "admin", user: USER })
      expect.unreachable("expected duplicateProject to throw")
    } catch (err) {
      expect(err).toBeInstanceOf(DuplicateProjectPartialFailureError)
      const failure = err as DuplicateProjectPartialFailureError
      expect(failure.shotsWritten).toBe(0)
      expect(failure.newProjectId).toBeTruthy()
    }
  })
})
