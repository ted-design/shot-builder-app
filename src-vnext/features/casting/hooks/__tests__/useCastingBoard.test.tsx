/// <reference types="@testing-library/jest-dom" />
// Phase 5d — useCastingBoard quiet-error plumbing.
// Pins that the hook passes the permission-denied quiet option through to
// useFirestoreCollection (the org read is rules-denied for non-members and
// must not spam the console) while its returned shape — entries passthrough
// and FirestoreCollectionError → Error mapping — stays identical, since
// TalentPicker's flat-list degrade keys off that error state.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"

const collectionState = vi.hoisted(() => ({
  data: [] as unknown[],
  loading: false,
  error: null as { message: string; isMissingIndex: boolean; code?: string } | null,
  calls: [] as Array<{
    path: string[] | null
    options: { quietErrorCodes?: ReadonlyArray<string> } | undefined
  }>,
}))

vi.mock("@/shared/hooks/useFirestoreCollection", () => ({
  useFirestoreCollection: (
    path: string[] | null,
    _constraints: unknown[],
    _mapDoc: unknown,
    options?: { quietErrorCodes?: ReadonlyArray<string> },
  ) => {
    collectionState.calls.push({ path, options })
    return {
      data: collectionState.data,
      loading: collectionState.loading,
      error: collectionState.error,
    }
  },
}))

import { useCastingBoard } from "@/features/casting/hooks/useCastingBoard"

describe("useCastingBoard", () => {
  beforeEach(() => {
    collectionState.data = []
    collectionState.loading = false
    collectionState.error = null
    collectionState.calls = []
  })

  it("quiets permission-denied (and ONLY permission-denied) on the collection read", () => {
    renderHook(() => useCastingBoard("p1", "c1"))

    expect(collectionState.calls).toHaveLength(1)
    expect(collectionState.calls[0]?.options?.quietErrorCodes).toEqual([
      "permission-denied",
    ])
  })

  it("still surfaces a denied read as an Error (flat-list degrade unchanged)", () => {
    collectionState.error = {
      message: "Missing or insufficient permissions.",
      isMissingIndex: false,
      code: "permission-denied",
    }

    const { result } = renderHook(() => useCastingBoard("p1", "c1"))

    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe(
      "Missing or insufficient permissions.",
    )
    expect(result.current.entries).toEqual([])
  })

  it("passes a null path (no subscription) when project or client is missing", () => {
    renderHook(() => useCastingBoard(null, "c1"))
    expect(collectionState.calls[0]?.path).toBeNull()
  })
})
