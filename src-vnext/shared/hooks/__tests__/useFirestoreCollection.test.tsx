/// <reference types="@testing-library/jest-dom" />
// Phase 5d — quietErrorCodes for useFirestoreCollection.
// Mirrors useFirestoreDoc's MEMBER_DOC_OPTIONS pattern: a caller can declare
// error codes EXPECTED at its call site (useCastingBoard → permission-denied
// for non-members). The console.error is suppressed for those codes ONLY;
// the error object (message / code / isMissingIndex) still surfaces through
// the result identically, and the options object never retriggers the
// subscription effect.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"

type SnapshotErrorCallback = (err: Error & { code?: string }) => void

const snapshotState = vi.hoisted(() => ({
  errorCallbacks: [] as SnapshotErrorCallback[],
  onSnapshotCalls: 0,
}))

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => "COLL_REF"),
  query: vi.fn((ref: unknown) => ref),
  onSnapshot: vi.fn(
    (_q: unknown, _next: unknown, onError: SnapshotErrorCallback) => {
      snapshotState.onSnapshotCalls += 1
      snapshotState.errorCallbacks.push(onError)
      return () => {}
    },
  ),
}))

vi.mock("@/shared/lib/firebase", () => ({ db: {} }))

vi.mock("@/shared/lib/devSubscriptionCounter", () => ({
  markSubscriptionMount: vi.fn(),
  markSubscriptionUnmount: vi.fn(),
}))

import { useFirestoreCollection } from "@/shared/hooks/useFirestoreCollection"

function fireError(code: string | undefined, message = "boom") {
  const err = Object.assign(new Error(message), code ? { code } : {})
  act(() => {
    for (const cb of snapshotState.errorCallbacks) cb(err)
  })
}

const QUIET = { quietErrorCodes: ["permission-denied"] } as const

describe("useFirestoreCollection quietErrorCodes", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    snapshotState.errorCallbacks = []
    snapshotState.onSnapshotCalls = 0
    consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
    vi.clearAllMocks()
  })

  it("suppresses console.error for a quieted code but still surfaces the error state", () => {
    const { result } = renderHook(() =>
      useFirestoreCollection(["clients", "c1", "castingBoard"], [], undefined, QUIET),
    )

    fireError("permission-denied", "Missing or insufficient permissions.")

    expect(consoleSpy).not.toHaveBeenCalled()
    expect(result.current.error).not.toBeNull()
    expect(result.current.error?.code).toBe("permission-denied")
    expect(result.current.error?.message).toBe(
      "Missing or insufficient permissions.",
    )
    expect(result.current.error?.isMissingIndex).toBe(false)
    expect(result.current.loading).toBe(false)
    expect(result.current.data).toEqual([])
  })

  it("still logs when no options are passed (default behavior unchanged)", () => {
    const { result } = renderHook(() =>
      useFirestoreCollection(["clients", "c1", "castingBoard"]),
    )

    fireError("permission-denied")

    expect(consoleSpy).toHaveBeenCalledTimes(1)
    expect(consoleSpy.mock.calls[0]?.[0]).toBe("[useFirestoreCollection]")
    expect(result.current.error?.code).toBe("permission-denied")
  })

  it("still logs codes NOT in the quiet list (failed-precondition keeps full index handling)", () => {
    const { result } = renderHook(() =>
      useFirestoreCollection(["clients", "c1", "castingBoard"], [], undefined, QUIET),
    )

    fireError(
      "failed-precondition",
      "The query requires an index. https://console.firebase.google.com/x/y",
    )

    expect(consoleSpy).toHaveBeenCalledTimes(1)
    expect(result.current.error?.isMissingIndex).toBe(true)
    expect(result.current.error?.indexUrl).toBe(
      "https://console.firebase.google.com/x/y",
    )
  })

  it("still logs a code-less error even with a quiet list", () => {
    renderHook(() =>
      useFirestoreCollection(["clients", "c1", "castingBoard"], [], undefined, QUIET),
    )

    fireError(undefined)

    expect(consoleSpy).toHaveBeenCalledTimes(1)
  })

  it("a new options identity does not retrigger the subscription effect", () => {
    const { rerender } = renderHook(
      ({ options }) =>
        useFirestoreCollection(
          ["clients", "c1", "castingBoard"],
          [],
          undefined,
          options,
        ),
      { initialProps: { options: { quietErrorCodes: ["permission-denied"] } } },
    )

    expect(snapshotState.onSnapshotCalls).toBe(1)
    rerender({ options: { quietErrorCodes: ["permission-denied"] } })
    expect(snapshotState.onSnapshotCalls).toBe(1)
  })
})
