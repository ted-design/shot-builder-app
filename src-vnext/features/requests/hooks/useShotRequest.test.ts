import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"

// ---- Mocks ----

let snapshotCallback: ((snap: unknown) => void) | null = null
let errorCallback: ((err: Error) => void) | null = null
const mockUnsubscribe = vi.fn()

const mockDoc = vi.fn((_db: unknown, ...segments: string[]) => segments.join("/"))
const mockOnSnapshot = vi.fn((_ref: unknown, onNext: (snap: unknown) => void, onError: (err: Error) => void) => {
  snapshotCallback = onNext
  errorCallback = onError
  return mockUnsubscribe
})

vi.mock("firebase/firestore", async () => {
  const actual = await vi.importActual<typeof import("firebase/firestore")>("firebase/firestore")
  return {
    ...actual,
    doc: (...args: unknown[]) => mockDoc(...args),
    onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  }
})

vi.mock("@/shared/lib/firebase", () => ({ db: {} }))

vi.mock("@/shared/lib/paths", () => ({
  shotRequestDocPath: (requestId: string, clientId: string) => [
    "clients", clientId, "shotRequests", requestId,
  ],
}))

import { useShotRequest } from "./useShotRequest"

describe("useShotRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    snapshotCallback = null
    errorCallback = null
  })

  it("returns null data and loading=false when requestId is null", () => {
    const { result } = renderHook(() => useShotRequest(null, "c1"))
    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(mockOnSnapshot).not.toHaveBeenCalled()
  })

  it("returns null data and loading=false when clientId is null", () => {
    const { result } = renderHook(() => useShotRequest("r1", null))
    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(mockOnSnapshot).not.toHaveBeenCalled()
  })

  it("subscribes with correct path when both params provided", () => {
    renderHook(() => useShotRequest("r1", "c1"))
    expect(mockDoc).toHaveBeenCalledWith({}, "clients", "c1", "shotRequests", "r1")
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1)
  })

  it("sets data when snapshot exists", () => {
    const { result } = renderHook(() => useShotRequest("r1", "c1"))

    act(() => {
      snapshotCallback!({
        exists: () => true,
        id: "r1",
        data: () => ({ title: "Hero shot", status: "submitted", clientId: "c1" }),
      })
    })

    expect(result.current.data).toMatchObject({
      id: "r1",
      title: "Hero shot",
      status: "submitted",
    })
    expect(result.current.loading).toBe(false)
  })

  it("sets data to null when snapshot does not exist", () => {
    const { result } = renderHook(() => useShotRequest("r1", "c1"))

    act(() => {
      snapshotCallback!({
        exists: () => false,
        id: "r1",
        data: () => null,
      })
    })

    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it("sets error on snapshot error", () => {
    const { result } = renderHook(() => useShotRequest("r1", "c1"))

    act(() => {
      errorCallback!(new Error("permission-denied"))
    })

    expect(result.current.error).toBe("permission-denied")
    expect(result.current.loading).toBe(false)
    expect(result.current.data).toBeNull()
  })

  it("unsubscribes on unmount", () => {
    const { unmount } = renderHook(() => useShotRequest("r1", "c1"))
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })

  it("resubscribes when params change", () => {
    const { rerender } = renderHook(
      ({ requestId, clientId }: { requestId: string | null; clientId: string | null }) =>
        useShotRequest(requestId, clientId),
      { initialProps: { requestId: "r1", clientId: "c1" } },
    )

    expect(mockOnSnapshot).toHaveBeenCalledTimes(1)

    rerender({ requestId: "r2", clientId: "c1" })

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
    expect(mockOnSnapshot).toHaveBeenCalledTimes(2)
  })
})
