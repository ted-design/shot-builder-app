import { describe, it, expect, vi, beforeEach } from "vitest"

// ---- Mocks ----

const mockUseFirestoreCollection = vi.fn()

vi.mock("@/shared/hooks/useFirestoreCollection", () => ({
  useFirestoreCollection: (...args: unknown[]) => mockUseFirestoreCollection(...args),
}))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: vi.fn(),
}))

vi.mock("@/shared/lib/paths", () => ({
  shotRequestsPath: (clientId: string) => ["clients", clientId, "shotRequests"],
}))

vi.mock("firebase/firestore", async () => {
  const actual = await vi.importActual<typeof import("firebase/firestore")>("firebase/firestore")
  return { ...actual, orderBy: (field: string, dir: string) => ({ field, dir }) }
})

import { useAuth } from "@/app/providers/AuthProvider"
import { useShotRequests } from "./useShotRequests"

const mockAuth = useAuth as unknown as { mockReturnValue: (v: unknown) => void }

describe("useShotRequests", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseFirestoreCollection.mockReturnValue({ data: [], loading: false, error: null })
  })

  it("passes null path when clientId is absent", () => {
    mockAuth.mockReturnValue({ clientId: null })
    useShotRequests()
    expect(mockUseFirestoreCollection).toHaveBeenCalledWith(
      null,
      expect.any(Array),
    )
  })

  it("passes correct path when clientId is present", () => {
    mockAuth.mockReturnValue({ clientId: "c1" })
    useShotRequests()
    expect(mockUseFirestoreCollection).toHaveBeenCalledWith(
      ["clients", "c1", "shotRequests"],
      expect.any(Array),
    )
  })

  it("passes orderBy submittedAt desc constraint", () => {
    mockAuth.mockReturnValue({ clientId: "c1" })
    useShotRequests()
    const [, constraints] = mockUseFirestoreCollection.mock.calls[0]!
    expect(constraints).toHaveLength(1)
    expect(constraints[0]).toMatchObject({ field: "submittedAt", dir: "desc" })
  })

  it("returns loading state from useFirestoreCollection", () => {
    mockAuth.mockReturnValue({ clientId: "c1" })
    mockUseFirestoreCollection.mockReturnValue({ data: [], loading: true, error: null })
    const result = useShotRequests()
    expect(result.loading).toBe(true)
    expect(result.data).toHaveLength(0)
  })

  it("returns error state from useFirestoreCollection", () => {
    mockAuth.mockReturnValue({ clientId: "c1" })
    const err = { message: "Firestore error", isMissingIndex: false }
    mockUseFirestoreCollection.mockReturnValue({ data: [], loading: false, error: err })
    const result = useShotRequests()
    expect(result.error).toEqual(err)
  })

  it("returns request data from useFirestoreCollection", () => {
    mockAuth.mockReturnValue({ clientId: "c1" })
    const requests = [
      { id: "r1", title: "Need hero shot", status: "submitted" },
      { id: "r2", title: "Product close-up", status: "triaged" },
    ]
    mockUseFirestoreCollection.mockReturnValue({ data: requests, loading: false, error: null })
    const result = useShotRequests()
    expect(result.data).toHaveLength(2)
    expect(result.data[0]!.title).toBe("Need hero shot")
  })
})
