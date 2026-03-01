import { describe, it, expect, vi, beforeEach } from "vitest"

// ---- Mocks ----

const mockUseFirestoreCollection = vi.fn()

vi.mock("@/shared/hooks/useFirestoreCollection", () => ({
  useFirestoreCollection: (...args: unknown[]) =>
    mockUseFirestoreCollection(...args),
}))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: vi.fn(),
}))

vi.mock("@/shared/lib/paths", () => ({
  shotsPath: (clientId: string) => ["clients", clientId, "shots"],
}))

vi.mock("firebase/firestore", async () => {
  const actual =
    await vi.importActual<typeof import("firebase/firestore")>(
      "firebase/firestore",
    )
  return {
    ...actual,
    where: (field: string, op: string, value: unknown) => ({
      field,
      op,
      value,
    }),
    orderBy: (field: string, dir: string) => ({ field, dir }),
  }
})

import { useAuth } from "@/app/providers/AuthProvider"
import { useTalentShotHistory } from "../useTalentShotHistory"

const mockAuth = useAuth as unknown as { mockReturnValue: (v: unknown) => void }

describe("useTalentShotHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseFirestoreCollection.mockReturnValue({
      data: [],
      loading: false,
      error: null,
    })
    mockAuth.mockReturnValue({ clientId: "c1" })
  })

  it("passes null path when talentId is null", () => {
    useTalentShotHistory(null)
    expect(mockUseFirestoreCollection).toHaveBeenCalledWith(
      null,
      expect.any(Array),
      expect.any(Function),
    )
  })

  it("passes null path when clientId is null", () => {
    mockAuth.mockReturnValue({ clientId: null })
    useTalentShotHistory("talent1")
    expect(mockUseFirestoreCollection).toHaveBeenCalledWith(
      null,
      expect.any(Array),
      expect.any(Function),
    )
  })

  it("passes correct shots path when both IDs are present", () => {
    useTalentShotHistory("talent1")
    expect(mockUseFirestoreCollection).toHaveBeenCalledWith(
      ["clients", "c1", "shots"],
      expect.any(Array),
      expect.any(Function),
    )
  })

  it("passes array-contains, deleted, and orderBy constraints", () => {
    useTalentShotHistory("talent1")
    const [, constraints] = mockUseFirestoreCollection.mock.calls[0]!
    expect(constraints).toHaveLength(3)
    expect(constraints[0]).toMatchObject({
      field: "talentIds",
      op: "array-contains",
      value: "talent1",
    })
    expect(constraints[1]).toMatchObject({
      field: "deleted",
      op: "==",
      value: false,
    })
    expect(constraints[2]).toMatchObject({
      field: "updatedAt",
      dir: "desc",
    })
  })

  it("returns entries from useFirestoreCollection data", () => {
    const entries = [
      { shotId: "s1", projectId: "p1", shotTitle: "Hero" },
      { shotId: "s2", projectId: "p2", shotTitle: "Detail" },
    ]
    mockUseFirestoreCollection.mockReturnValue({
      data: entries,
      loading: false,
      error: null,
    })
    const result = useTalentShotHistory("talent1")
    expect(result.entries).toHaveLength(2)
    expect(result.entries[0]!.shotTitle).toBe("Hero")
  })

  it("returns loading state", () => {
    mockUseFirestoreCollection.mockReturnValue({
      data: [],
      loading: true,
      error: null,
    })
    const result = useTalentShotHistory("talent1")
    expect(result.loading).toBe(true)
  })

  it("returns error state", () => {
    const err = { message: "Missing index", isMissingIndex: true }
    mockUseFirestoreCollection.mockReturnValue({
      data: [],
      loading: false,
      error: err,
    })
    const result = useTalentShotHistory("talent1")
    expect(result.error).toEqual(err)
  })

  it("uses explicit clientId parameter over auth clientId", () => {
    useTalentShotHistory("talent1", "explicit-client")
    expect(mockUseFirestoreCollection).toHaveBeenCalledWith(
      ["clients", "explicit-client", "shots"],
      expect.any(Array),
      expect.any(Function),
    )
  })
})
