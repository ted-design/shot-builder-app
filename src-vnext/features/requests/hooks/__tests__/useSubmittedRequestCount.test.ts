/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"

// ---- Mocks ----

const mockOnSnapshot = vi.fn()
const mockQuery = vi.fn((...args: unknown[]) => ({ _type: "query", args }))
const mockWhere = vi.fn((...args: unknown[]) => ({ _type: "where", args }))
const mockCollection = vi.fn((...args: unknown[]) => ({ _type: "collection", args }))

vi.mock("firebase/firestore", () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
}))

vi.mock("@/shared/lib/firebase", () => ({ db: {} }))

vi.mock("@/shared/lib/paths", () => ({
  shotRequestsPath: (clientId: string) => ["clients", clientId, "shotRequests"],
}))

import { useSubmittedRequestCount } from "../useSubmittedRequestCount"

function captureSnapshotCallback(): {
  success: ((snap: unknown) => void) | null
  error: ((err: unknown) => void) | null
} {
  const captured = { success: null as ((snap: unknown) => void) | null, error: null as ((err: unknown) => void) | null }
  mockOnSnapshot.mockImplementation((_q, onSuccess, onError) => {
    captured.success = onSuccess
    captured.error = onError
    return vi.fn() // unsubscribe
  })
  return captured
}

describe("useSubmittedRequestCount", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns count 0 and loading true initially", () => {
    mockOnSnapshot.mockReturnValue(vi.fn())
    const { result } = renderHook(() => useSubmittedRequestCount("client-1"))
    expect(result.current.loading).toBe(true)
    expect(result.current.count).toBe(0)
  })

  it("returns count 0 and loading false when clientId is null", () => {
    const { result } = renderHook(() => useSubmittedRequestCount(null))
    expect(result.current.loading).toBe(false)
    expect(result.current.count).toBe(0)
    expect(mockOnSnapshot).not.toHaveBeenCalled()
  })

  it("returns count 0 and loading false when clientId is undefined", () => {
    const { result } = renderHook(() => useSubmittedRequestCount(undefined))
    expect(result.current.loading).toBe(false)
    expect(result.current.count).toBe(0)
  })

  it("updates count when snapshot fires", () => {
    const captured = captureSnapshotCallback()
    const { result } = renderHook(() => useSubmittedRequestCount("client-1"))

    act(() => {
      captured.success?.({ size: 5 })
    })

    expect(result.current.count).toBe(5)
    expect(result.current.loading).toBe(false)
  })

  it("reacts to count changes on subsequent snapshots", () => {
    const captured = captureSnapshotCallback()
    const { result } = renderHook(() => useSubmittedRequestCount("client-1"))

    act(() => {
      captured.success?.({ size: 3 })
    })
    expect(result.current.count).toBe(3)

    act(() => {
      captured.success?.({ size: 7 })
    })
    expect(result.current.count).toBe(7)
  })

  it("resets to 0 and stops loading on snapshot error", () => {
    const captured = captureSnapshotCallback()
    const { result } = renderHook(() => useSubmittedRequestCount("client-1"))

    act(() => {
      captured.error?.(new Error("permission denied"))
    })

    expect(result.current.count).toBe(0)
    expect(result.current.loading).toBe(false)
  })

  it("calls onSnapshot with where status == submitted query", () => {
    mockOnSnapshot.mockReturnValue(vi.fn())
    renderHook(() => useSubmittedRequestCount("client-1"))

    expect(mockWhere).toHaveBeenCalledWith("status", "==", "submitted")
    expect(mockQuery).toHaveBeenCalled()
    expect(mockOnSnapshot).toHaveBeenCalled()
  })

  it("unsubscribes on unmount", () => {
    const unsubscribeMock = vi.fn()
    mockOnSnapshot.mockReturnValue(unsubscribeMock)

    const { unmount } = renderHook(() => useSubmittedRequestCount("client-1"))
    unmount()

    expect(unsubscribeMock).toHaveBeenCalledTimes(1)
  })

  it("re-subscribes when clientId changes", () => {
    const unsubscribeMock = vi.fn()
    mockOnSnapshot.mockReturnValue(unsubscribeMock)

    const { rerender } = renderHook(
      ({ cid }: { cid: string }) => useSubmittedRequestCount(cid),
      { initialProps: { cid: "client-1" } },
    )

    expect(mockOnSnapshot).toHaveBeenCalledTimes(1)

    rerender({ cid: "client-2" })

    expect(unsubscribeMock).toHaveBeenCalledTimes(1)
    expect(mockOnSnapshot).toHaveBeenCalledTimes(2)
  })
})
