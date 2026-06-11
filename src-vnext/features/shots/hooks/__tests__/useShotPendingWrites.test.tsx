/// <reference types="@testing-library/jest-dom" />
// 5e-II Decision C — unit matrix for the Shoot shell's pending-write signal.
//
// The hook is a dedicated metadata-inclusive doc listener (the pending→acked
// transition is a METADATA-ONLY snapshot event that the shared useFirestoreDoc
// listener never receives), mounted only by the flag-gated shell. These pins
// drive the mocked onSnapshot callbacks; what only CI/E2E can prove is the
// real SDK behavior (durable queue + ack after reconnect) — the airplane-mode
// eyeball in the spec's test plan covers that.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"

vi.mock("@/shared/lib/firebase", () => ({ db: {} }))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ clientId: "c1", user: { uid: "u1" }, loading: false }),
}))

type SnapshotNext = (snapshot: {
  metadata: { hasPendingWrites: boolean }
}) => void
type SnapshotError = (err: unknown) => void

const listenerState = vi.hoisted(() => ({
  next: null as SnapshotNext | null,
  error: null as SnapshotError | null,
  options: null as { includeMetadataChanges?: boolean } | null,
  docPath: null as string | null,
  unsubscribe: vi.fn(),
  subscribeCount: 0,
}))

vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, ...segments: string[]) => ({ path: segments.join("/") }),
  onSnapshot: (
    ref: { path: string },
    options: { includeMetadataChanges?: boolean },
    next: SnapshotNext,
    error: SnapshotError,
  ) => {
    listenerState.subscribeCount += 1
    listenerState.docPath = ref.path
    listenerState.options = options
    listenerState.next = next
    listenerState.error = error
    return listenerState.unsubscribe
  },
}))

import { useShotPendingWrites } from "@/features/shots/hooks/useShotPendingWrites"

function emit(hasPendingWrites: boolean) {
  act(() => {
    listenerState.next?.({ metadata: { hasPendingWrites } })
  })
}

describe("useShotPendingWrites (Decision C pending signal)", () => {
  beforeEach(() => {
    listenerState.next = null
    listenerState.error = null
    listenerState.options = null
    listenerState.docPath = null
    listenerState.subscribeCount = 0
    listenerState.unsubscribe = vi.fn()
  })

  it("subscribes to the shot doc WITH includeMetadataChanges (the pending→acked event is metadata-only)", () => {
    renderHook(() => useShotPendingWrites("s1"))

    expect(listenerState.subscribeCount).toBe(1)
    expect(listenerState.docPath).toBe("clients/c1/shots/s1")
    expect(listenerState.options).toEqual({ includeMetadataChanges: true })
  })

  it("tracks hasPendingWrites: false → true on a queued write → false on server ack", () => {
    const { result } = renderHook(() => useShotPendingWrites("s1"))
    expect(result.current).toBe(false)

    emit(true)
    expect(result.current).toBe(true)

    emit(false)
    expect(result.current).toBe(false)
  })

  it("no shotId: never subscribes, stays false", () => {
    const { result } = renderHook(() => useShotPendingWrites(undefined))

    expect(listenerState.subscribeCount).toBe(0)
    expect(result.current).toBe(false)
  })

  it("listener error resets to false (presentation-only — the bundle's listener owns error surfacing)", () => {
    const { result } = renderHook(() => useShotPendingWrites("s1"))
    emit(true)
    expect(result.current).toBe(true)

    act(() => {
      listenerState.error?.(new Error("watch failed"))
    })
    expect(result.current).toBe(false)
  })

  it("unsubscribes on unmount", () => {
    const { unmount } = renderHook(() => useShotPendingWrites("s1"))
    expect(listenerState.unsubscribe).not.toHaveBeenCalled()

    unmount()
    expect(listenerState.unsubscribe).toHaveBeenCalledTimes(1)
  })
})
