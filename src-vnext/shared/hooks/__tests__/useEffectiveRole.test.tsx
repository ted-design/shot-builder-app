/// <reference types="@testing-library/jest-dom" />
// Phase 5b — unit matrix for the effective-role source (locked Q5/Q6).
// useAuth / useOptionalProjectScope / useFirestoreDoc are mocked so each
// resolution branch is pinned in isolation: admin exception, project-role-wins
// (incl. downgrades), the three silent failure modes, and the session cache
// that keeps `resolving` from re-opening on per-route provider remounts.
// The useFirestoreDoc mock APPLIES the hook's real mapDoc to a raw record, so
// the member-doc normalizeRole path (legacy 'wardrobe') is exercised for real.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"

const authState = vi.hoisted(() => ({
  role: "producer" as string,
  user: { uid: "u1" } as { uid: string } | null,
  clientId: "c1" as string | null,
  loading: false,
}))

const scopeState = vi.hoisted(() => ({
  scope: { projectId: "p1", projectName: "Project 1" } as {
    projectId: string
    projectName: string
  } | null,
}))

const docState = vi.hoisted(() => ({
  /** Raw member-doc record the mock feeds through the caller's mapDoc. */
  raw: null as Record<string, unknown> | null,
  loading: false,
  error: null as string | null,
  errorCode: null as string | null,
  /** Stale record exposed as .data while error is set (real-hook behavior). */
  stale: null as Record<string, unknown> | null,
  calls: [] as Array<string[] | null>,
}))

const toastSpy = vi.hoisted(() => vi.fn())

vi.mock("sonner", () => ({
  toast: Object.assign(toastSpy, { success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({
    role: authState.role,
    user: authState.user,
    clientId: authState.clientId,
    loading: authState.loading,
  }),
}))

vi.mock("@/app/providers/ProjectScopeProvider", () => ({
  useOptionalProjectScope: () => scopeState.scope,
}))

vi.mock("@/shared/hooks/useFirestoreDoc", () => ({
  useFirestoreDoc: (
    path: string[] | null,
    mapDoc?: (id: string, data: Record<string, unknown>) => unknown,
  ) => {
    docState.calls.push(path)
    // Null path mirrors the real hook: no subscription, settled empty.
    if (!path) return { data: null, loading: false, error: null, errorCode: null }
    // Like the real hook, .data keeps the STALE record when error is set.
    const raw = docState.error ? docState.stale : docState.raw
    const data = raw && mapDoc ? mapDoc("u1", raw) : raw
    return {
      data,
      loading: docState.loading,
      error: docState.error,
      errorCode: docState.errorCode,
    }
  },
}))

import {
  useEffectiveRole,
  resetEffectiveRoleCacheForTests,
} from "@/shared/hooks/useEffectiveRole"

function setMemberDoc(role: string | null) {
  docState.raw = role ? { role } : null
  docState.loading = false
  docState.error = null
  docState.errorCode = null
  docState.stale = null
}

function setDocLoading() {
  setMemberDoc(null)
  docState.loading = true
}

function setDocError(errorCode: string, message = "boom") {
  docState.loading = false
  docState.error = message
  docState.errorCode = errorCode
}

describe("useEffectiveRole", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetEffectiveRoleCacheForTests()
    authState.role = "producer"
    authState.user = { uid: "u1" }
    authState.clientId = "c1"
    authState.loading = false
    scopeState.scope = { projectId: "p1", projectName: "Project 1" }
    docState.calls = []
    setMemberDoc(null)
  })

  it("global admin is NEVER downgraded and skips the member subscription (Q6 exception)", () => {
    authState.role = "admin"
    setMemberDoc("viewer")

    const { result } = renderHook(() => useEffectiveRole())

    expect(result.current).toEqual({ role: "admin", resolving: false })
    // The hook never opened a member-doc read (null path only).
    expect(docState.calls.every((p) => p === null)).toBe(true)
  })

  it("returns the global claim with no project scope (org pages, OnSetViewerPage)", () => {
    scopeState.scope = null

    const { result } = renderHook(() => useEffectiveRole())

    expect(result.current).toEqual({ role: "producer", resolving: false })
    expect(docState.calls.every((p) => p === null)).toBe(true)
  })

  it("member doc role WINS over the global claim, including a producer→viewer downgrade (Q6)", () => {
    setMemberDoc("viewer")

    const { result } = renderHook(() => useEffectiveRole())

    expect(result.current).toEqual({ role: "viewer", resolving: false })
    // Member path is uid-keyed under the scoped project (paths.ts).
    expect(docState.calls[docState.calls.length - 1]).toEqual([
      "clients",
      "c1",
      "projects",
      "p1",
      "members",
      "u1",
    ])
  })

  it("normalizes a legacy 'wardrobe' member doc to warehouse", () => {
    setMemberDoc("wardrobe")

    const { result } = renderHook(() => useEffectiveRole())

    expect(result.current).toEqual({ role: "warehouse", resolving: false })
  })

  it("doc absent → global-claim fallback (member-less project)", () => {
    authState.role = "crew"
    setMemberDoc(null)

    const { result } = renderHook(() => useEffectiveRole())

    expect(result.current).toEqual({ role: "crew", resolving: false })
  })

  it("permission-denied → global-claim fallback, silent (non-member reading own path)", () => {
    authState.role = "crew"
    setDocError("permission-denied", "Missing or insufficient permissions.")

    const { result } = renderHook(() => useEffectiveRole())

    expect(result.current).toEqual({ role: "crew", resolving: false })
  })

  it("transient error with a session cache → last-known-resolved role, never stale .data", () => {
    // First mount resolves a member 'viewer' role (cached).
    setMemberDoc("viewer")
    const first = renderHook(() => useEffectiveRole())
    expect(first.result.current.role).toBe("viewer")
    first.unmount()

    // Listener now errors transiently — and useFirestoreDoc still exposes a
    // stale elevated record as .data. The hook must use the CACHE, not .data.
    setDocError("unavailable")
    docState.stale = { role: "producer" }
    const second = renderHook(() => useEffectiveRole())

    expect(second.result.current).toEqual({ role: "viewer", resolving: false })
  })

  it("transient error with NO cache → global-claim fallback (fail toward fewer)", () => {
    authState.role = "crew"
    setDocError("unavailable")

    const { result } = renderHook(() => useEffectiveRole())

    expect(result.current).toEqual({ role: "crew", resolving: false })
  })

  it("resolving=true ONLY on the first uncached in-flight read", () => {
    setDocLoading()

    const { result } = renderHook(() => useEffectiveRole())

    expect(result.current.resolving).toBe(true)
    // While resolving the role value is the global claim, but consumers gate
    // on `resolving` and must render no write affordances from it.
    expect(result.current.role).toBe("producer")
  })

  it("session cache survives unmount/remount: no resolving gap on re-nav", () => {
    setMemberDoc("crew")
    const first = renderHook(() => useEffectiveRole())
    expect(first.result.current).toEqual({ role: "crew", resolving: false })
    first.unmount()

    // Per-route ProjectScopeProvider remount re-opens the subscription
    // (loading) — the cached role answers immediately, resolving stays false.
    setDocLoading()
    const second = renderHook(() => useEffectiveRole())

    expect(second.result.current).toEqual({ role: "crew", resolving: false })
  })

  it("fires ONE downgrade toast when the resolved role transitions downward mid-session", () => {
    setMemberDoc("producer")
    const { rerender } = renderHook(() => useEffectiveRole())
    expect(toastSpy).not.toHaveBeenCalled()

    // Live member-doc edit downgrades the role on the open subscription.
    setMemberDoc("viewer")
    rerender()

    expect(toastSpy).toHaveBeenCalledTimes(1)
    expect(toastSpy).toHaveBeenCalledWith("Your role on this project changed.")

    // Re-render with the same role: no repeat toast.
    rerender()
    expect(toastSpy).toHaveBeenCalledTimes(1)
  })

  it("does not toast on an upgrade or on the first resolution", () => {
    setMemberDoc("crew")
    const { rerender } = renderHook(() => useEffectiveRole())
    expect(toastSpy).not.toHaveBeenCalled()

    setMemberDoc("producer")
    rerender()

    expect(toastSpy).not.toHaveBeenCalled()
  })
})
