import { describe, it, expect, vi, beforeEach } from "vitest"

// ---- Mocks ----

const mockOnSnapshot = vi.fn()
const mockCollection = vi.fn()
const mockQuery = vi.fn()
const mockOrderBy = vi.fn()

vi.mock("firebase/firestore", async () => {
  const actual = await vi.importActual<typeof import("firebase/firestore")>("firebase/firestore")
  return {
    ...actual,
    collection: (...args: unknown[]) => mockCollection(...args),
    onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
    query: (...args: unknown[]) => mockQuery(...args),
    orderBy: (...args: unknown[]) => mockOrderBy(...args),
  }
})

vi.mock("@/shared/lib/firebase", () => ({ db: {} }))

vi.mock("@/shared/lib/paths", () => ({
  shotRequestCommentsPath: (clientId: string, requestId: string) => [
    "clients", clientId, "shotRequests", requestId, "comments",
  ],
}))

import { renderHook, act } from "@testing-library/react"
import { useRequestComments } from "./useRequestComments"

function makeDoc(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    data: () => ({
      authorId: "user-1",
      authorName: "Alice",
      body: "Hello",
      createdAt: { toMillis: () => Date.now() },
      ...overrides,
    }),
  }
}

describe("useRequestComments", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCollection.mockReturnValue("comments-ref")
    mockOrderBy.mockReturnValue("orderBy-constraint")
    mockQuery.mockReturnValue("ordered-query")
  })

  it("returns empty comments and loading=false when clientId is null", () => {
    const { result } = renderHook(() => useRequestComments(null, "req-1"))
    expect(result.current.loading).toBe(false)
    expect(result.current.comments).toHaveLength(0)
    expect(result.current.error).toBeNull()
    expect(mockOnSnapshot).not.toHaveBeenCalled()
  })

  it("returns empty comments and loading=false when requestId is null", () => {
    const { result } = renderHook(() => useRequestComments("c1", null))
    expect(result.current.loading).toBe(false)
    expect(result.current.comments).toHaveLength(0)
    expect(mockOnSnapshot).not.toHaveBeenCalled()
  })

  it("subscribes to comments collection when clientId and requestId are provided", () => {
    mockOnSnapshot.mockReturnValue(() => {})

    renderHook(() => useRequestComments("c1", "req-1"))

    expect(mockCollection).toHaveBeenCalledWith(
      {},
      "clients",
      "c1",
      "shotRequests",
      "req-1",
      "comments",
    )
    expect(mockOrderBy).toHaveBeenCalledWith("createdAt", "asc")
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1)
  })

  it("maps snapshot docs to ShotRequestComment objects", () => {
    let capturedCallback: ((snap: unknown) => void) | null = null
    mockOnSnapshot.mockImplementation((_, successCb: (snap: unknown) => void) => {
      capturedCallback = successCb
      return () => {}
    })

    const { result } = renderHook(() => useRequestComments("c1", "req-1"))

    act(() => {
      capturedCallback!({
        docs: [
          makeDoc("comment-1", { authorId: "u1", authorName: "Alice", body: "First" }),
          makeDoc("comment-2", { authorId: "u2", authorName: "Bob", body: "Second" }),
        ],
      })
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.comments).toHaveLength(2)
    expect(result.current.comments[0]).toMatchObject({
      id: "comment-1",
      authorId: "u1",
      authorName: "Alice",
      body: "First",
    })
    expect(result.current.comments[1]).toMatchObject({
      id: "comment-2",
      authorId: "u2",
      authorName: "Bob",
      body: "Second",
    })
  })

  it("sets error when onSnapshot fires error callback", () => {
    let capturedError: ((err: unknown) => void) | null = null
    mockOnSnapshot.mockImplementation(
      (_: unknown, _success: unknown, errorCb: (err: unknown) => void) => {
        capturedError = errorCb
        return () => {}
      },
    )

    const { result } = renderHook(() => useRequestComments("c1", "req-1"))

    act(() => {
      capturedError!({ message: "permission-denied" })
    })

    expect(result.current.error).toBe("permission-denied")
    expect(result.current.loading).toBe(false)
  })

  it("calls unsubscribe on unmount", () => {
    const unsubscribe = vi.fn()
    mockOnSnapshot.mockReturnValue(unsubscribe)

    const { unmount } = renderHook(() => useRequestComments("c1", "req-1"))
    unmount()

    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it("starts loading when clientId/requestId are provided", () => {
    mockOnSnapshot.mockReturnValue(() => {})

    const { result } = renderHook(() => useRequestComments("c1", "req-1"))

    // Initial state before snapshot fires should be loading
    expect(result.current.loading).toBe(true)
  })
})
