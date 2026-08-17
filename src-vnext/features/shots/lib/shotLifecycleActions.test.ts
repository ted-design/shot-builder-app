import { describe, expect, it, vi, beforeEach } from "vitest"

// All Firestore mocked — zero live writes. `Timestamp` is kept REAL (spread
// from the actual module) since `makeShot()` below uses `Timestamp.fromMillis`.
vi.mock("firebase/firestore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("firebase/firestore")>()
  return {
    ...actual,
    writeBatch: vi.fn(),
    collection: vi.fn((...args: unknown[]) => ({ __col: args.join("/") })),
    doc: vi.fn((...args: unknown[]) => {
      if (args.length === 1) {
        // doc(collectionRef) — new auto-id doc (bulk copy / clone paths).
        return { id: `new-${Math.random().toString(36).slice(2, 10)}` }
      }
      // doc(db, ...segments) — existing doc ref (bulk move path).
      const segs = args.slice(1) as string[]
      return { id: segs[segs.length - 1], path: segs.join("/") }
    }),
    serverTimestamp: vi.fn(() => ({ _methodName: "serverTimestamp" })),
  }
})

vi.mock("@/shared/lib/firebase", () => ({ db: {} }))

import { Timestamp } from "firebase/firestore"
import * as firestore from "firebase/firestore"
import type { Shot } from "@/shared/types"
import {
  BulkCopyPartialFailureError,
  buildDuplicateShotTitle,
  buildShotClonePayload,
  bulkCopyShotsToProject,
  bulkMoveShotsToProject,
} from "@/features/shots/lib/shotLifecycleActions"

function makeShot(overrides: Partial<Shot> = {}): Shot {
  const now = Timestamp.fromMillis(Date.now())
  return {
    id: overrides.id ?? "s1",
    title: overrides.title ?? "Hero Shot",
    description: overrides.description,
    projectId: overrides.projectId ?? "p1",
    clientId: overrides.clientId ?? "c1",
    status: overrides.status ?? "todo",
    talent: overrides.talent ?? ["talent-1"],
    talentIds: overrides.talentIds ?? ["talent-1"],
    products: overrides.products ?? [{ familyId: "fam-1", familyName: "Jacket" }],
    locationId: overrides.locationId ?? "loc-1",
    locationName: overrides.locationName ?? "Studio A",
    laneId: overrides.laneId ?? "lane-1",
    mediaType: overrides.mediaType,
    sortOrder: overrides.sortOrder ?? 1,
    shotNumber: overrides.shotNumber ?? "12A",
    notes: overrides.notes ?? "<p>Legacy notes</p>",
    notesAddendum: overrides.notesAddendum ?? "On-set note",
    date: overrides.date ?? now,
    heroImage: overrides.heroImage,
    looks: overrides.looks ?? [],
    activeLookId: overrides.activeLookId ?? null,
    tags: overrides.tags ?? [],
    referenceLinks: overrides.referenceLinks ?? [
      { id: "lk-1", title: "Lookbook", url: "https://example.com/lookbook.pdf", type: "document" },
    ],
    deleted: overrides.deleted ?? false,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    createdBy: overrides.createdBy ?? "u1",
  }
}

describe("shotLifecycleActions", () => {
  it("builds a non-colliding duplicate title", () => {
    const title = buildDuplicateShotTitle(
      "Hero Shot",
      new Set(["hero shot", "hero shot (copy)", "hero shot (copy 2)"]),
    )
    expect(title).toBe("Hero Shot (Copy 3)")
  })

  it("builds duplicate payload that resets shot number and keeps lane", () => {
    const payload = buildShotClonePayload({
      shot: makeShot(),
      clientId: "c1",
      targetProjectId: "p1",
      title: "Hero Shot (Copy)",
      createdByUid: "u2",
      preserveLane: true,
    })

    expect(payload["title"]).toBe("Hero Shot (Copy)")
    expect(payload["shotNumber"]).toBeNull()
    expect(payload["laneId"]).toBe("lane-1")
    expect(payload["projectId"]).toBe("p1")
    expect(payload["createdBy"]).toBe("u2")
  })

  it("builds copy payload that clears lane and keeps reference links", () => {
    const payload = buildShotClonePayload({
      shot: makeShot(),
      clientId: "c1",
      targetProjectId: "p2",
      title: "Hero Shot",
      createdByUid: "u2",
      preserveLane: false,
    })

    expect(payload["projectId"]).toBe("p2")
    expect(payload["laneId"]).toBeNull()
    expect(payload["referenceLinks"]).toEqual([
      { id: "lk-1", title: "Lookbook", url: "https://example.com/lookbook.pdf", type: "document" },
    ])
  })

  // -------------------------------------------------------------------
  // Options seam (project-dup + bulk transfer, 2026-08-16). Every default-
  // options case above must keep passing unmodified — these add coverage
  // for the NEW options only.
  // -------------------------------------------------------------------
  describe("buildShotClonePayload options", () => {
    it("mediaType is carried through even without options (bonus fix — was silently dropped)", () => {
      const payload = buildShotClonePayload({
        shot: makeShot({ mediaType: "video" }),
        clientId: "c1",
        targetProjectId: "p1",
        title: "Hero Shot",
        createdByUid: "u2",
        preserveLane: true,
      })
      expect(payload["mediaType"]).toBe("video")
    })

    it("laneIdOverride wins over preserveLane (including null)", () => {
      const payload = buildShotClonePayload({
        shot: makeShot({ laneId: "lane-1" }),
        clientId: "c1",
        targetProjectId: "p2",
        title: "Hero Shot",
        createdByUid: "u2",
        preserveLane: true, // would normally keep lane-1
        options: { laneIdOverride: "lane-remapped" },
      })
      expect(payload["laneId"]).toBe("lane-remapped")

      const cleared = buildShotClonePayload({
        shot: makeShot({ laneId: "lane-1" }),
        clientId: "c1",
        targetProjectId: "p2",
        title: "Hero Shot",
        createdByUid: "u2",
        preserveLane: true,
        options: { laneIdOverride: null },
      })
      expect(cleared["laneId"]).toBeNull()
    })

    it("preserveShotNumber keeps the source shotNumber instead of nulling it", () => {
      const payload = buildShotClonePayload({
        shot: makeShot({ shotNumber: "42B" }),
        clientId: "c1",
        targetProjectId: "p1",
        title: "Hero Shot",
        createdByUid: "u2",
        preserveLane: false,
        options: { preserveShotNumber: true },
      })
      expect(payload["shotNumber"]).toBe("42B")
    })

    it("sortOrderOverride is used verbatim instead of Date.now()", () => {
      const payload = buildShotClonePayload({
        shot: makeShot({ sortOrder: 7 }),
        clientId: "c1",
        targetProjectId: "p1",
        title: "Hero Shot",
        createdByUid: "u2",
        preserveLane: false,
        options: { sortOrderOverride: 12345 },
      })
      expect(payload["sortOrder"]).toBe(12345)
    })

    it("true-clone options (all three together) preserve number/order and remap lane", () => {
      const payload = buildShotClonePayload({
        shot: makeShot({ shotNumber: "9C", sortOrder: 55, laneId: "old-lane" }),
        clientId: "c1",
        targetProjectId: "p-new",
        title: "Hero Shot",
        createdByUid: "u2",
        preserveLane: false,
        options: {
          laneIdOverride: "new-lane",
          preserveShotNumber: true,
          sortOrderOverride: 55,
        },
      })
      expect(payload["shotNumber"]).toBe("9C")
      expect(payload["sortOrder"]).toBe(55)
      expect(payload["laneId"]).toBe("new-lane")
      expect(payload["status"]).toBe("todo") // already preserved unconditionally
      expect(payload["date"]).toBeTruthy() // already preserved unconditionally
    })

    it("heroImageOverride WINS over shot.heroImage: a value clones verbatim, null OMITS the field, absent key keeps today's behavior", () => {
      const materialized = { path: "materialized.jpg", downloadURL: "https://x/materialized.jpg" }

      const overridden = buildShotClonePayload({
        shot: makeShot({ heroImage: materialized }),
        clientId: "c1",
        targetProjectId: "p1",
        title: "Hero Shot",
        createdByUid: "u2",
        preserveLane: false,
        options: { heroImageOverride: { path: "raw.jpg", downloadURL: "https://x/raw.jpg" } },
      })
      expect(overridden["heroImage"]).toEqual({ path: "raw.jpg", downloadURL: "https://x/raw.jpg" })

      const omitted = buildShotClonePayload({
        shot: makeShot({ heroImage: materialized }),
        clientId: "c1",
        targetProjectId: "p1",
        title: "Hero Shot",
        createdByUid: "u2",
        preserveLane: false,
        options: { heroImageOverride: null },
      })
      expect(omitted).not.toHaveProperty("heroImage")

      const defaulted = buildShotClonePayload({
        shot: makeShot({ heroImage: materialized }),
        clientId: "c1",
        targetProjectId: "p1",
        title: "Hero Shot",
        createdByUid: "u2",
        preserveLane: false,
        // no options at all — existing callers (duplicateShotInProject,
        // copyShotToProject, bulkCopyShotsToProject) must keep writing the
        // materialized shot.heroImage byte-for-byte.
      })
      expect(defaulted["heroImage"]).toEqual(materialized)
    })
  })
})

// =====================================================================
// Bulk cross-project Copy/Move (Feature A). All Firestore mocked — zero
// live writes.
// =====================================================================
describe("bulk cross-project transfer", () => {
  let mockBatchSet: ReturnType<typeof vi.fn>
  let mockBatchUpdate: ReturnType<typeof vi.fn>
  let mockBatchCommit: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockBatchSet = vi.fn()
    mockBatchUpdate = vi.fn()
    mockBatchCommit = vi.fn().mockResolvedValue(undefined)
    vi.mocked(firestore.writeBatch).mockReturnValue({
      set: mockBatchSet,
      update: mockBatchUpdate,
      delete: vi.fn(),
      commit: mockBatchCommit,
    } as unknown as ReturnType<typeof firestore.writeBatch>)
  })

  function shotsScrambled(count: number): Shot[] {
    // sortOrder DESCENDING while array/insertion order is ASCENDING id —
    // i.e. iterating this array in place order is the OPPOSITE of
    // canonical sortOrder order. Any code path that trusts array/Set
    // insertion order instead of re-sorting by sortOrder will write the
    // reversed sequence.
    return Array.from({ length: count }, (_, i) =>
      makeShot({ id: `s${i}`, title: `Shot ${i}`, sortOrder: count - i, laneId: undefined }),
    )
  }

  describe("bulkCopyShotsToProject", () => {
    it("no-ops on empty input", async () => {
      const result = await bulkCopyShotsToProject({
        clientId: "c1",
        shots: [],
        targetProjectId: "p2",
        targetTitles: new Set(),
        createdByUid: "u1",
      })
      expect(result.copiedCount).toBe(0)
      expect(mockBatchCommit).not.toHaveBeenCalled()
    })

    it("writes sortOrder = base + i in CANONICAL sortOrder-ascending order, not array order", async () => {
      const shots = shotsScrambled(4) // array order s0..s3, sortOrder DESC (4,3,2,1)
      await bulkCopyShotsToProject({
        clientId: "c1",
        shots,
        targetProjectId: "p2",
        targetTitles: new Set(),
        createdByUid: "u1",
      })

      // Canonical order (sortOrder asc) is s3(1), s2(2), s1(3), s0(4). No
      // titles collide (targetTitles is empty and every source title is
      // distinct), so every title stays BARE — see the dedicated
      // no-collision test below for that behavior; this test's job is
      // ORDER, so just assert on the write sequence via title identity.
      const titlesInWriteOrder = mockBatchSet.mock.calls.map(
        (call) => (call[1] as Record<string, unknown>)["title"],
      )
      expect(titlesInWriteOrder).toEqual(["Shot 3", "Shot 2", "Shot 1", "Shot 0"])

      const sortOrders = mockBatchSet.mock.calls.map(
        (call) => (call[1] as Record<string, unknown>)["sortOrder"] as number,
      )
      expect(sortOrders[1]! - sortOrders[0]!).toBe(1)
      expect(sortOrders[2]! - sortOrders[1]!).toBe(1)
      expect(sortOrders[3]! - sortOrders[2]!).toBe(1)
    })

    it("keeps the BARE title when it doesn't collide with target or already-copied titles (mutation: unconditional rename -> reddens)", async () => {
      const shots = [
        makeShot({ id: "s1", title: "Product Shot", sortOrder: 1 }),
        makeShot({ id: "s2", title: "Lifestyle Shot", sortOrder: 2 }),
      ]
      await bulkCopyShotsToProject({
        clientId: "c1",
        shots,
        targetProjectId: "p2",
        targetTitles: new Set(),
        createdByUid: "u1",
      })
      const titles = mockBatchSet.mock.calls.map((call) => (call[1] as Record<string, unknown>)["title"])
      expect(titles).toEqual(["Product Shot", "Lifestyle Shot"])
    })

    it("clears laneId and resets shotNumber on every copy (single-shot copy precedent)", async () => {
      const shots = [makeShot({ id: "s1", laneId: "lane-1", shotNumber: "3A" })]
      await bulkCopyShotsToProject({
        clientId: "c1",
        shots,
        targetProjectId: "p2",
        targetTitles: new Set(),
        createdByUid: "u1",
      })
      const payload = mockBatchSet.mock.calls[0]![1] as Record<string, unknown>
      expect(payload["laneId"]).toBeNull()
      expect(payload["shotNumber"]).toBeNull()
      expect(payload["projectId"]).toBe("p2")
    })

    it("dedups titles and ACCUMULATES newly-minted titles across the batch", async () => {
      const shots = [
        makeShot({ id: "s1", title: "Look A", sortOrder: 1 }),
        makeShot({ id: "s2", title: "Look A", sortOrder: 2 }),
      ]
      await bulkCopyShotsToProject({
        clientId: "c1",
        shots,
        targetProjectId: "p2",
        targetTitles: new Set(["Look A"]),
        createdByUid: "u1",
      })
      const titles = mockBatchSet.mock.calls.map((call) => (call[1] as Record<string, unknown>)["title"])
      expect(titles).toEqual(["Look A (Copy)", "Look A (Copy 2)"])
    })

    it("chunks at 250: 251 shots write 2 batches", async () => {
      const shots = shotsScrambled(251)
      const result = await bulkCopyShotsToProject({
        clientId: "c1",
        shots,
        targetProjectId: "p2",
        targetTitles: new Set(),
        createdByUid: "u1",
      })
      expect(mockBatchCommit).toHaveBeenCalledTimes(2)
      expect(result.copiedCount).toBe(251)
    })

    it("a chunk failing partway through throws BulkCopyPartialFailureError carrying how many landed", async () => {
      const shots = shotsScrambled(251) // 2 chunks: 250 + 1
      mockBatchCommit.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("network down"))

      try {
        await bulkCopyShotsToProject({
          clientId: "c1",
          shots,
          targetProjectId: "p2",
          targetTitles: new Set(),
          createdByUid: "u1",
        })
        expect.unreachable("expected bulkCopyShotsToProject to throw")
      } catch (err) {
        expect(err).toBeInstanceOf(BulkCopyPartialFailureError)
        const failure = err as BulkCopyPartialFailureError
        expect(failure.copiedCount).toBe(250)
        expect(failure.totalCount).toBe(251)
      }
    })
  })

  describe("bulkMoveShotsToProject", () => {
    it("no-ops on empty input", async () => {
      const result = await bulkMoveShotsToProject({
        clientId: "c1",
        shots: [],
        targetProjectId: "p2",
        user: { uid: "u1", email: null, displayName: null, photoURL: null },
      })
      expect(result.movedCount).toBe(0)
      expect(mockBatchCommit).not.toHaveBeenCalled()
    })

    it("writes sortOrder = base + i in CANONICAL sortOrder-ascending order, not array order", async () => {
      const shots = shotsScrambled(3) // array order s0,s1,s2; sortOrder DESC (3,2,1)
      await bulkMoveShotsToProject({
        clientId: "c1",
        shots,
        targetProjectId: "p2",
        user: null,
      })
      // Canonical order (sortOrder asc) is s2(1), s1(2), s0(3) — the REVERSE
      // of array order. Assert on WHICH shot lands at which position, not
      // just that sortOrders increment by 1 (that alone can't distinguish
      // canonical order from array order).
      const idsInWriteOrder = mockBatchUpdate.mock.calls.map((call) => (call[0] as { id: string }).id)
      expect(idsInWriteOrder).toEqual(["s2", "s1", "s0"])

      const sortOrders = mockBatchUpdate.mock.calls.map(
        (call) => (call[1] as Record<string, unknown>)["sortOrder"] as number,
      )
      expect(sortOrders[1]! - sortOrders[0]!).toBe(1)
      expect(sortOrders[2]! - sortOrders[1]!).toBe(1)
    })

    it("keeps shotNumber (Ted decision 4), nulls laneId, changes projectId", async () => {
      const shots = [makeShot({ id: "s1", shotNumber: "7Z", laneId: "lane-9" })]
      await bulkMoveShotsToProject({
        clientId: "c1",
        shots,
        targetProjectId: "p2",
        user: null,
      })
      const payload = mockBatchUpdate.mock.calls[0]![1] as Record<string, unknown>
      // shotNumber is absent from the update payload entirely — Firestore
      // `update()` only touches named fields, so an absent key means KEPT.
      expect(payload).not.toHaveProperty("shotNumber")
      expect(payload["laneId"]).toBeNull()
      expect(payload["projectId"]).toBe("p2")
    })

    it("chunks at 250: 251 shots write 2 batches", async () => {
      const shots = shotsScrambled(251)
      const result = await bulkMoveShotsToProject({
        clientId: "c1",
        shots,
        targetProjectId: "p2",
        user: null,
      })
      expect(mockBatchCommit).toHaveBeenCalledTimes(2)
      expect(result.movedCount).toBe(251)
    })

    it("tie-breaks by id when sortOrder ties on every shot (all-absent -> 0) — no transient display-order leak (mutation: drop the id tie-break -> reddens)", async () => {
      const shots = [
        makeShot({ id: "s2", title: "B", sortOrder: 0, laneId: undefined }),
        makeShot({ id: "s1", title: "A", sortOrder: 0, laneId: undefined }),
      ]
      await bulkMoveShotsToProject({
        clientId: "c1",
        shots,
        targetProjectId: "p2",
        user: null,
      })
      const idsInWriteOrder = mockBatchUpdate.mock.calls.map((call) => (call[0] as { id: string }).id)
      expect(idsInWriteOrder).toEqual(["s1", "s2"])
    })
  })
})
