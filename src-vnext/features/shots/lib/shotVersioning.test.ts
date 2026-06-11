// Phase 5d — version snapshots must survive mapShot-shaped shots.
// Firestore's addDoc rejects `undefined` anywhere in the payload, and
// mapShot-produced shots carry nested `undefined`s (look products' optional
// colourId/quantity, heroImage fields, …). Before the stripUndefinedDeep fix
// every snapshot whose UNPATCHED fields included such a value (e.g. a talent
// save on a shot with looks) failed addDoc — silently, because the caller
// treats snapshots as best-effort. These specs pin the cleaning and the diff.
import { describe, it, expect, vi, beforeEach } from "vitest"
import type { AuthUser, Shot } from "@/shared/types"

// ---- Mocks ----

const mockAddDoc = vi.fn()
const mockCollection = vi.fn((_db: unknown, ...segments: string[]) => segments.join("/"))

vi.mock("firebase/firestore", async () => {
  const actual =
    await vi.importActual<typeof import("firebase/firestore")>("firebase/firestore")
  return {
    ...actual,
    addDoc: (...args: unknown[]) => mockAddDoc(...args),
    collection: (...args: unknown[]) => mockCollection(...args),
    serverTimestamp: () => "SERVER_TS",
  }
})

vi.mock("@/shared/lib/firebase", () => ({ db: {}, auth: {} }))

import { createShotVersionSnapshot } from "./shotVersioning"

// ---- Helpers ----

const user = {
  uid: "user-1",
  displayName: "Test User",
  email: null,
  photoURL: null,
} as unknown as AuthUser

/** mapShot-shaped shot: nested undefineds inside looks, like production. */
function buildShot(overrides: Partial<Shot> = {}): Shot {
  return {
    id: "shot-1",
    title: "Shot",
    status: "draft",
    talent: ["t-old"],
    talentIds: ["t-old"],
    looks: [
      {
        id: "look-1",
        label: "Primary",
        products: [
          { familyId: "fam-1", skuId: "sku-1", colourId: undefined, quantity: undefined },
        ],
      },
    ],
    ...overrides,
  } as unknown as Shot
}

function hasDeepUndefined(value: unknown): boolean {
  if (value === undefined) return true
  if (Array.isArray(value)) return value.some(hasDeepUndefined)
  if (value !== null && typeof value === "object") {
    return Object.values(value).some(hasDeepUndefined)
  }
  return false
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAddDoc.mockResolvedValue({ id: "version-1" })
})

// ---- Specs ----

describe("createShotVersionSnapshot", () => {
  it("writes a snapshot free of undefined for a talent patch on a mapShot-shaped shot", async () => {
    const id = await createShotVersionSnapshot({
      clientId: "client-1",
      shotId: "shot-1",
      previousShot: buildShot(),
      patch: { talent: ["t-new"], talentIds: ["t-new"] },
      user,
      changeType: "update",
    })

    expect(id).toBe("version-1")
    expect(mockAddDoc).toHaveBeenCalledTimes(1)
    const payload = mockAddDoc.mock.calls[0]![1] as Record<string, unknown>
    expect(hasDeepUndefined(payload)).toBe(false)
    expect(payload.changedFields).toEqual(["talent", "talentIds"])
    // The dirty look survives minus its undefined entries.
    const snapshot = payload.snapshot as { looks: Array<{ products: Array<Record<string, unknown>> }> }
    expect(snapshot.looks[0]!.products[0]).toEqual({ familyId: "fam-1", skuId: "sku-1" })
  })

  it("nulls undefined entries inside arrays instead of dropping them", async () => {
    await createShotVersionSnapshot({
      clientId: "client-1",
      shotId: "shot-1",
      previousShot: buildShot({ tags: ["a", undefined, "b"] as unknown as Shot["tags"] }),
      patch: { talent: ["t-new"], talentIds: ["t-new"] },
      user,
      changeType: "update",
    })

    const payload = mockAddDoc.mock.calls[0]![1] as Record<string, unknown>
    const snapshot = payload.snapshot as { tags: unknown[] }
    expect(snapshot.tags).toEqual(["a", null, "b"])
  })

  it("passes non-plain objects (Timestamp-like) through untouched", async () => {
    class FakeTimestamp {
      constructor(readonly seconds: number) {}
      toDate() {
        return new Date(this.seconds * 1000)
      }
    }
    const ts = new FakeTimestamp(1700000000)

    await createShotVersionSnapshot({
      clientId: "client-1",
      shotId: "shot-1",
      previousShot: buildShot({ date: ts as unknown as Shot["date"] }),
      patch: { talent: ["t-new"], talentIds: ["t-new"] },
      user,
      changeType: "update",
    })

    const payload = mockAddDoc.mock.calls[0]![1] as Record<string, unknown>
    const snapshot = payload.snapshot as { date: unknown }
    expect(snapshot.date).toBe(ts)
  })

  it("still skips the snapshot when nothing in the patch changed", async () => {
    const id = await createShotVersionSnapshot({
      clientId: "client-1",
      shotId: "shot-1",
      previousShot: buildShot(),
      patch: { talent: ["t-old"], talentIds: ["t-old"] },
      user,
      changeType: "update",
    })

    expect(id).toBeNull()
    expect(mockAddDoc).not.toHaveBeenCalled()
  })
})
