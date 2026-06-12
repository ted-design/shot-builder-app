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
  mapDoc: null as
    | ((id: string, data: Record<string, unknown>) => unknown)
    | null,
}))

vi.mock("@/shared/hooks/useFirestoreCollection", () => ({
  useFirestoreCollection: (
    path: string[] | null,
    _constraints: unknown[],
    mapDoc: (id: string, data: Record<string, unknown>) => unknown,
    options?: { quietErrorCodes?: ReadonlyArray<string> },
  ) => {
    collectionState.calls.push({ path, options })
    collectionState.mapDoc = mapDoc
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
    collectionState.mapDoc = null
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

  it("maps hiddenImageIds / hiddenSessionIds arrays from the doc (undefined-safe)", () => {
    renderHook(() => useCastingBoard("p1", "c1"))
    const mapDoc = collectionState.mapDoc!

    // Arrays present → passed through.
    const withArrays = mapDoc("t1", {
      talentId: "t1",
      hiddenImageIds: ["g1", "s1i2"],
      hiddenSessionIds: ["s2"],
    }) as { hiddenImageIds: string[]; hiddenSessionIds: string[] }
    expect(withArrays.hiddenImageIds).toEqual(["g1", "s1i2"])
    expect(withArrays.hiddenSessionIds).toEqual(["s2"])

    // Missing / non-array → default to [].
    const missing = mapDoc("t2", { talentId: "t2" }) as {
      hiddenImageIds: string[]
      hiddenSessionIds: string[]
    }
    expect(missing.hiddenImageIds).toEqual([])
    expect(missing.hiddenSessionIds).toEqual([])

    const notArray = mapDoc("t3", {
      talentId: "t3",
      hiddenImageIds: "nope",
      hiddenSessionIds: 42,
    }) as { hiddenImageIds: string[]; hiddenSessionIds: string[] }
    expect(notArray.hiddenImageIds).toEqual([])
    expect(notArray.hiddenSessionIds).toEqual([])
  })
})
