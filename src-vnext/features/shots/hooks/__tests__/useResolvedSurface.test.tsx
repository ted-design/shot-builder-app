/// <reference types="@testing-library/jest-dom" />
// 5e-I — unit pins for the shared surface hook. useAuth / useEffectiveRole /
// useMediaQuery are mocked (the hook calls them INTERNALLY so suite-level
// module mocks flow through); resolveSurface is the REAL pure function, so
// the affordances pass-through pins the actual 5e-I device derivations,
// including the one named sub-delta (export keys to desktop, not !mobile).
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"
import type { Role } from "@/shared/types"

const authState = vi.hoisted(() => ({
  loading: false,
}))

const roleState = vi.hoisted(() => ({
  role: "producer" as Role,
  resolving: false,
}))

const deviceState = vi.hoisted(() => ({
  isMobile: false,
  isDesktop: true,
}))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({
    role: "viewer",
    user: { uid: "u1" },
    clientId: "c1",
    loading: authState.loading,
  }),
}))

vi.mock("@/shared/hooks/useEffectiveRole", () => ({
  useEffectiveRole: () => ({ role: roleState.role, resolving: roleState.resolving }),
}))

vi.mock("@/shared/hooks/useMediaQuery", () => ({
  useIsMobile: () => deviceState.isMobile,
  useIsDesktop: () => deviceState.isDesktop,
}))

import { useResolvedSurface } from "../useResolvedSurface"

function setDevice(device: "mobile" | "tablet" | "desktop") {
  deviceState.isMobile = device === "mobile"
  deviceState.isDesktop = device === "desktop"
}

beforeEach(() => {
  authState.loading = false
  roleState.role = "producer"
  roleState.resolving = false
  setDevice("desktop")
})

describe("useResolvedSurface — resolving gate", () => {
  it("returns resolving:true with no resolved values while the effective role is resolving", () => {
    roleState.resolving = true
    const { result } = renderHook(() => useResolvedSurface())
    expect(result.current).toEqual({
      surface: null,
      affordances: null,
      chrome: null,
      resolving: true,
    })
  })

  it("returns resolving:true with no resolved values while auth is loading", () => {
    authState.loading = true
    const { result } = renderHook(() => useResolvedSurface())
    expect(result.current).toEqual({
      surface: null,
      affordances: null,
      chrome: null,
      resolving: true,
    })
  })

  it("resolves once the gate clears on rerender", () => {
    roleState.resolving = true
    const { result, rerender } = renderHook(() => useResolvedSurface())
    expect(result.current.resolving).toBe(true)

    roleState.resolving = false
    rerender()
    expect(result.current.resolving).toBe(false)
    expect(result.current.surface).toBe("plan-build")
    expect(result.current.affordances).not.toBeNull()
    expect(result.current.chrome).not.toBeNull()
  })
})

describe("useResolvedSurface — device mapping", () => {
  it.each([
    ["mobile", "tap-row"],
    ["tablet", "badge-select"],
    ["desktop", "badge-select"],
  ] as const)("maps %s to the 3-valued device like ShotListPage's surfaceDevice", (device, statusControl) => {
    setDevice(device)
    const { result } = renderHook(() => useResolvedSurface())
    // statusControl forks on mobile; export forks tablet vs desktop — together
    // they pin all three device values through the real resolver.
    expect(result.current.chrome?.statusControl).toBe(statusControl)
    expect(result.current.affordances?.export).toBe(device === "desktop")
  })
})

describe("useResolvedSurface — affordances/chrome pass-through", () => {
  it("passes through the desktop affordances (all on, export desktop-keyed true)", () => {
    setDevice("desktop")
    const { result } = renderHook(() => useResolvedSurface())
    expect(result.current.affordances).toEqual({
      fieldEditing: true,
      lifecycle: true,
      imageUpload: true,
      share: true,
      export: true,
      bulkPull: true,
      repair: true,
      versionRestore: true,
    })
    expect(result.current.chrome).toEqual({
      toolbar: "full",
      viewSwitcher: true,
      quickAdd: true,
      statusControl: "badge-select",
    })
  })

  it("passes through the tablet affordances (export false — the named 5e-I sub-delta)", () => {
    setDevice("tablet")
    const { result } = renderHook(() => useResolvedSurface())
    expect(result.current.affordances).toEqual({
      fieldEditing: true,
      lifecycle: true,
      imageUpload: true,
      share: true,
      export: false,
      bulkPull: true,
      repair: true,
      versionRestore: true,
    })
  })

  it("passes through the mobile affordances (all off)", () => {
    setDevice("mobile")
    const { result } = renderHook(() => useResolvedSurface())
    expect(result.current.affordances).toEqual({
      fieldEditing: false,
      lifecycle: false,
      imageUpload: false,
      share: false,
      export: false,
      bulkPull: false,
      repair: false,
      versionRestore: false,
    })
    expect(result.current.chrome?.statusControl).toBe("tap-row")
  })

  it("resolves the surface from the effective role", () => {
    roleState.role = "crew"
    const { result } = renderHook(() => useResolvedSurface())
    expect(result.current.surface).toBe("shoot")
  })
})

describe("useResolvedSurface — memoization", () => {
  it("returns a referentially stable result across rerenders with unchanged inputs", () => {
    const { result, rerender } = renderHook(() => useResolvedSurface())
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })

  it("returns a new result when the device changes", () => {
    const { result, rerender } = renderHook(() => useResolvedSurface())
    const first = result.current
    setDevice("tablet")
    rerender()
    expect(result.current).not.toBe(first)
    expect(result.current.affordances?.export).toBe(false)
  })
})
