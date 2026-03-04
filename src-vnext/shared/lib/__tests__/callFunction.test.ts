import { describe, it, expect, vi, beforeEach, type Mock } from "vitest"

// --- Mocks ---

const mockSetDoc = vi.fn()
const mockOnSnapshot = vi.fn()
const mockServerTimestamp = vi.fn(() => ({ _type: "serverTimestamp" }))
const mockCollectionRef = { _type: "collectionRef" }
const mockDocRef = { _type: "docRef", id: "queue-doc-123" }

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => mockCollectionRef),
  doc: vi.fn(() => mockDocRef),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  serverTimestamp: () => mockServerTimestamp(),
}))

vi.mock("@/shared/lib/firebase", () => ({
  auth: { currentUser: null },
  db: { _type: "firestore" },
}))

import { callFunction } from "../callFunction"
import { auth } from "../firebase"

beforeEach(() => {
  vi.clearAllMocks()
  ;(auth as { currentUser: unknown }).currentUser = null
})

describe("callFunction (Firestore queue)", () => {
  it("rejects when not authenticated and skipAuth is not set", async () => {
    const error = await callFunction("setUserClaims", { targetEmail: "a@b.com" })
      .catch((e: Error & { code: string }) => e)

    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe("Not authenticated")
    expect(error.code).toBe("functions/unauthenticated")
  })

  it("writes queue doc with correct shape for authenticated call", async () => {
    ;(auth as { currentUser: unknown }).currentUser = { uid: "user-123" }

    mockOnSnapshot.mockImplementation((_ref: unknown, cb: (snap: unknown) => void) => {
      setTimeout(() => {
        cb({
          data: () => ({ status: "complete", result: { ok: true, uid: "target-456" } }),
        })
      }, 0)
      return vi.fn()
    })

    const result = await callFunction("setUserClaims", {
      targetEmail: "test@example.com",
      role: "admin",
      clientId: "client-1",
    })

    expect(mockSetDoc).toHaveBeenCalledOnce()
    const [ref, docData] = mockSetDoc.mock.calls[0] as [unknown, Record<string, unknown>]
    expect(ref).toBe(mockDocRef)
    expect(docData.action).toBe("setUserClaims")
    expect(docData.status).toBe("pending")
    expect(docData.createdBy).toBe("user-123")
    expect(docData.data).toEqual({
      targetEmail: "test@example.com",
      role: "admin",
      clientId: "client-1",
    })
    expect(docData.expiresAt).toBeInstanceOf(Date)
    expect(result).toEqual({ ok: true, uid: "target-456" })
  })

  it("writes createdBy as 'anonymous' when skipAuth is true", async () => {
    mockOnSnapshot.mockImplementation((_ref: unknown, cb: (snap: unknown) => void) => {
      setTimeout(() => {
        cb({ data: () => ({ status: "complete", result: { ok: true } }) })
      }, 0)
      return vi.fn()
    })

    await callFunction("publicUpdatePull", { shareToken: "abc123" }, { skipAuth: true })

    const [, docData] = mockSetDoc.mock.calls[0] as [unknown, Record<string, unknown>]
    expect(docData.createdBy).toBe("anonymous")
    expect(docData.action).toBe("publicUpdatePull")
  })

  it("resolves with result when status changes to complete", async () => {
    ;(auth as { currentUser: unknown }).currentUser = { uid: "user-123" }

    const expectedResult = { shareToken: "share-xyz" }

    mockOnSnapshot.mockImplementation((_ref: unknown, cb: (snap: unknown) => void) => {
      // First snapshot: still pending (should be ignored)
      setTimeout(() => {
        cb({ data: () => ({ status: "pending" }) })
      }, 0)
      // Second snapshot: complete
      setTimeout(() => {
        cb({ data: () => ({ status: "complete", result: expectedResult }) })
      }, 10)
      return vi.fn()
    })

    const result = await callFunction("createShotShareLink", { projectId: "p1" })
    expect(result).toEqual(expectedResult)
  })

  it("rejects with correct error when status is error", async () => {
    ;(auth as { currentUser: unknown }).currentUser = { uid: "user-123" }

    mockOnSnapshot.mockImplementation((_ref: unknown, cb: (snap: unknown) => void) => {
      setTimeout(() => {
        cb({
          data: () => ({
            status: "error",
            error: "Not authorized.",
            code: "permission-denied",
          }),
        })
      }, 0)
      return vi.fn()
    })

    await expect(callFunction("setUserClaims", { targetEmail: "x@y.com" }))
      .rejects.toMatchObject({
        message: "Not authorized.",
        code: "functions/permission-denied",
      })
  })

  it("unsubscribes on resolve", async () => {
    ;(auth as { currentUser: unknown }).currentUser = { uid: "user-123" }

    const mockUnsub = vi.fn()
    mockOnSnapshot.mockImplementation((_ref: unknown, cb: (snap: unknown) => void) => {
      setTimeout(() => {
        cb({ data: () => ({ status: "complete", result: { ok: true } }) })
      }, 0)
      return mockUnsub
    })

    await callFunction("claimInvitation", {})
    expect(mockUnsub).toHaveBeenCalledOnce()
  })

  it("unsubscribes on error", async () => {
    ;(auth as { currentUser: unknown }).currentUser = { uid: "user-123" }

    const mockUnsub = vi.fn()
    mockOnSnapshot.mockImplementation((_ref: unknown, cb: (snap: unknown) => void) => {
      setTimeout(() => {
        cb({
          data: () => ({ status: "error", error: "fail", code: "internal" }),
        })
      }, 0)
      return mockUnsub
    })

    await callFunction("test", {}).catch(() => {})
    expect(mockUnsub).toHaveBeenCalledOnce()
  })

  it("rejects with deadline-exceeded on timeout", async () => {
    vi.useFakeTimers()
    ;(auth as { currentUser: unknown }).currentUser = { uid: "user-123" }

    const mockUnsub = vi.fn()
    mockOnSnapshot.mockImplementation(() => mockUnsub)

    const promise = callFunction("setUserClaims", { targetEmail: "a@b.com" })
    // Attach early catch to prevent unhandled rejection warning with fake timers
    promise.catch(() => {})

    await vi.advanceTimersByTimeAsync(30_000)

    await expect(promise).rejects.toMatchObject({
      message: "Function call timed out",
      code: "functions/deadline-exceeded",
    })
    expect(mockUnsub).toHaveBeenCalledOnce()

    vi.useRealTimers()
  })

  it("ignores snapshots with no data", async () => {
    ;(auth as { currentUser: unknown }).currentUser = { uid: "user-123" }

    mockOnSnapshot.mockImplementation((_ref: unknown, cb: (snap: unknown) => void) => {
      // Snapshot with no data
      setTimeout(() => {
        cb({ data: () => undefined })
      }, 0)
      // Then a complete snapshot
      setTimeout(() => {
        cb({ data: () => ({ status: "complete", result: { ok: true } }) })
      }, 10)
      return vi.fn()
    })

    const result = await callFunction("test", {})
    expect(result).toEqual({ ok: true })
  })

  it("uses default error message and code when not provided", async () => {
    ;(auth as { currentUser: unknown }).currentUser = { uid: "user-123" }

    mockOnSnapshot.mockImplementation((_ref: unknown, cb: (snap: unknown) => void) => {
      setTimeout(() => {
        cb({ data: () => ({ status: "error" }) })
      }, 0)
      return vi.fn()
    })

    await expect(callFunction("test", {})).rejects.toMatchObject({
      message: "Function call failed",
      code: "functions/internal",
    })
  })

  it("rejects when onSnapshot listener errors (e.g. permission denied)", async () => {
    ;(auth as { currentUser: unknown }).currentUser = { uid: "user-123" }

    mockOnSnapshot.mockImplementation(
      (_ref: unknown, _cb: unknown, errorCb: (err: Error) => void) => {
        setTimeout(() => {
          errorCb(new Error("Missing or insufficient permissions."))
        }, 0)
        return vi.fn()
      },
    )

    await expect(callFunction("test", {})).rejects.toMatchObject({
      message: "Missing or insufficient permissions.",
      code: "functions/internal",
    })
  })
})
