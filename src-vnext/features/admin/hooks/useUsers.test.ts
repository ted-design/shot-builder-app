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
  usersPath: (clientId: string) => ["clients", clientId, "users"],
}))

vi.mock("firebase/firestore", async () => {
  const actual = await vi.importActual<typeof import("firebase/firestore")>("firebase/firestore")
  return { ...actual, orderBy: (field: string, dir: string) => ({ field, dir }) }
})

import { useAuth } from "@/app/providers/AuthProvider"
import { useUsers } from "./useUsers"

const mockAuth = useAuth as unknown as { mockReturnValue: (v: unknown) => void }

describe("useUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseFirestoreCollection.mockReturnValue({ data: [], loading: false, error: null })
  })

  it("passes null path when clientId is absent", () => {
    mockAuth.mockReturnValue({ clientId: null })
    useUsers()
    expect(mockUseFirestoreCollection).toHaveBeenCalledWith(
      null,
      expect.any(Array),
    )
  })

  it("passes correct path when clientId is present", () => {
    mockAuth.mockReturnValue({ clientId: "c1" })
    useUsers()
    expect(mockUseFirestoreCollection).toHaveBeenCalledWith(
      ["clients", "c1", "users"],
      expect.any(Array),
    )
  })

  it("passes orderBy email asc constraint", () => {
    mockAuth.mockReturnValue({ clientId: "c1" })
    useUsers()
    const [, constraints] = mockUseFirestoreCollection.mock.calls[0]!
    expect(constraints).toHaveLength(1)
    expect(constraints[0]).toMatchObject({ field: "email", dir: "asc" })
  })

  it("returns loading state from useFirestoreCollection", () => {
    mockAuth.mockReturnValue({ clientId: "c1" })
    mockUseFirestoreCollection.mockReturnValue({ data: [], loading: true, error: null })
    const result = useUsers()
    expect(result.loading).toBe(true)
    expect(result.data).toHaveLength(0)
  })

  it("returns error state from useFirestoreCollection", () => {
    mockAuth.mockReturnValue({ clientId: "c1" })
    const err = { message: "Firestore error", isMissingIndex: false }
    mockUseFirestoreCollection.mockReturnValue({ data: [], loading: false, error: err })
    const result = useUsers()
    expect(result.error).toEqual(err)
  })

  it("returns user data from useFirestoreCollection", () => {
    mockAuth.mockReturnValue({ clientId: "c1" })
    const users = [
      { id: "u1", email: "alice@example.com", role: "admin" },
      { id: "u2", email: "bob@example.com", role: "producer" },
    ]
    mockUseFirestoreCollection.mockReturnValue({ data: users, loading: false, error: null })
    const result = useUsers()
    expect(result.data).toHaveLength(2)
    expect(result.data[0]!.email).toBe("alice@example.com")
  })
})
