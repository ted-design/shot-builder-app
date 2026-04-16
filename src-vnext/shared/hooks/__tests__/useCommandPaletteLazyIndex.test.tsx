/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { StrictMode, type ReactNode } from "react"
import { renderHook, waitFor } from "@testing-library/react"

// ---------------------------------------------------------------------------
// Mocks (declared before imports that depend on them)
// ---------------------------------------------------------------------------

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((...args: unknown[]) => ({ __collection: args })),
  query: vi.fn((...args: unknown[]) => ({ __query: args })),
  where: vi.fn((...args: unknown[]) => ({ __where: args })),
  orderBy: vi.fn((...args: unknown[]) => ({ __orderBy: args })),
  limit: vi.fn((n: number) => ({ __limit: n })),
  getDocs: vi.fn(),
  Timestamp: {
    fromMillis: (ms: number) => ({ __ts: ms, toMillis: () => ms }),
  },
}))

vi.mock("@/shared/lib/firebase", () => ({
  db: { __fakeDb: true },
}))

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

// ---------------------------------------------------------------------------
// Subject under test (post-mock)
// ---------------------------------------------------------------------------

import * as firestore from "firebase/firestore"
import { toast } from "sonner"
import { useCommandPaletteLazyIndex } from "@/shared/hooks/useCommandPaletteLazyIndex"

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeShotDoc(
  id: string,
  overrides: Record<string, unknown> = {},
): { id: string; data: () => Record<string, unknown> } {
  return {
    id,
    data: () => ({
      projectId: "p1",
      clientId: "c1",
      title: "Sunset Beach Shot",
      shotNumber: "A001",
      description: "Wide establishing shot",
      deleted: false,
      ...overrides,
    }),
  }
}

function makePullDoc(
  id: string,
  overrides: Record<string, unknown> = {},
): { id: string; data: () => Record<string, unknown> } {
  return {
    id,
    data: () => ({
      projectId: "p1",
      clientId: "c1",
      title: "Wardrobe Pull",
      status: "draft",
      ...overrides,
    }),
  }
}

function makeLaneDoc(
  id: string,
  overrides: Record<string, unknown> = {},
): { id: string; data: () => Record<string, unknown> } {
  return {
    id,
    data: () => ({
      projectId: "p1",
      clientId: "c1",
      name: "Evening Looks",
      sceneNumber: 3,
      sortOrder: 0,
      direction: "Handheld, moody lighting",
      ...overrides,
    }),
  }
}

function primeLazyFetch(params: {
  readonly shots?: ReadonlyArray<ReturnType<typeof makeShotDoc>>
  readonly pulls?: ReadonlyArray<ReturnType<typeof makePullDoc>>
  readonly lanes?: ReadonlyArray<ReturnType<typeof makeLaneDoc>>
}) {
  const responses = [
    { docs: params.shots ?? [] },
    { docs: params.pulls ?? [] },
    { docs: params.lanes ?? [] },
  ]
  let call = 0
  vi.mocked(firestore.getDocs).mockImplementation(async () => {
    const next = responses[call] ?? { docs: [] }
    call += 1
    return next as unknown as Awaited<ReturnType<typeof firestore.getDocs>>
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useCommandPaletteLazyIndex", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns an empty array when the palette is closed", () => {
    const { result } = renderHook(() =>
      useCommandPaletteLazyIndex({ open: false, projectId: "p1", clientId: "c1" }),
    )
    expect(result.current).toEqual([])
    expect(firestore.getDocs).not.toHaveBeenCalled()
  })

  it("returns an empty array when projectId is null", () => {
    const { result } = renderHook(() =>
      useCommandPaletteLazyIndex({ open: true, projectId: null, clientId: "c1" }),
    )
    expect(result.current).toEqual([])
    expect(firestore.getDocs).not.toHaveBeenCalled()
  })

  it("fetches and shapes shots/pulls/lanes on open", async () => {
    primeLazyFetch({
      shots: [makeShotDoc("s1", { title: "Sunset" })],
      pulls: [makePullDoc("pl1", { title: "Wardrobe" })],
      lanes: [makeLaneDoc("l1", { name: "Evening" })],
    })

    const { result } = renderHook(() =>
      useCommandPaletteLazyIndex({ open: true, projectId: "p1", clientId: "c1" }),
    )

    await waitFor(() => {
      expect(result.current.length).toBe(3)
    })
    expect(firestore.getDocs).toHaveBeenCalledTimes(3)

    const types = result.current.map((e) => e.type)
    expect(types).toEqual(["shot", "pull", "scene"])
  })

  it("short-circuits duplicate fetches under StrictMode (first-open cache populates)", async () => {
    primeLazyFetch({
      shots: [makeShotDoc("s1", { title: "Moonrise" })],
    })

    function Wrapper({ children }: { readonly children: ReactNode }) {
      return <StrictMode>{children}</StrictMode>
    }

    const { result } = renderHook(
      () => useCommandPaletteLazyIndex({ open: true, projectId: "p1", clientId: "c1" }),
      { wrapper: Wrapper },
    )

    await waitFor(() => {
      expect(result.current.length).toBe(1)
    })
    // StrictMode double-invokes effects — but promise memoization should cap
    // real Firestore reads at 3 (one per collection), not 6.
    expect(firestore.getDocs).toHaveBeenCalledTimes(3)
  })

  it("does not re-fetch on a second render cycle when projectId is unchanged", async () => {
    primeLazyFetch({ shots: [makeShotDoc("s1")] })

    const { result, rerender } = renderHook(
      ({ open }: { readonly open: boolean }) =>
        useCommandPaletteLazyIndex({ open, projectId: "p1", clientId: "c1" }),
      { initialProps: { open: true } },
    )

    await waitFor(() => {
      expect(firestore.getDocs).toHaveBeenCalledTimes(3)
    })
    expect(result.current.length).toBeGreaterThan(0)

    // Close and reopen — still cached
    rerender({ open: false })
    rerender({ open: true })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(firestore.getDocs).toHaveBeenCalledTimes(3)
  })

  it("purges stale entries and re-fetches when projectId flips", async () => {
    primeLazyFetch({ shots: [makeShotDoc("s1", { title: "Alpha Shot" })] })

    const { result, rerender } = renderHook(
      ({ projectId }: { readonly projectId: string }) =>
        useCommandPaletteLazyIndex({ open: true, projectId, clientId: "c1" }),
      { initialProps: { projectId: "p1" } },
    )

    await waitFor(() => {
      expect(firestore.getDocs).toHaveBeenCalledTimes(3)
    })
    expect(result.current.some((e) => e.name === "Alpha Shot")).toBe(true)

    // Re-prime for p2
    primeLazyFetch({ shots: [makeShotDoc("s99", { title: "Beta Shot" })] })

    rerender({ projectId: "p2" })

    await waitFor(() => {
      expect(firestore.getDocs).toHaveBeenCalledTimes(6)
    })
    await waitFor(() => {
      expect(result.current.some((e) => e.name === "Beta Shot")).toBe(true)
    })
    expect(result.current.some((e) => e.name === "Alpha Shot")).toBe(false)
  })

  it("surfaces a toast error and evicts the cache on fetch failure", async () => {
    vi.mocked(firestore.getDocs).mockRejectedValueOnce(new Error("boom"))

    renderHook(() =>
      useCommandPaletteLazyIndex({ open: true, projectId: "p1", clientId: "c1" }),
    )

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to index project content.")
    })
  })
})
