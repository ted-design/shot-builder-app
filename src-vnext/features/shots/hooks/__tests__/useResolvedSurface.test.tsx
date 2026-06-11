/// <reference types="@testing-library/jest-dom" />
// 5e-I/5e-II — unit pins for the shared surface hook. useAuth /
// useEffectiveRole / useMediaQuery / flags are mocked (the hook calls them
// INTERNALLY so suite-level module mocks flow through); resolveSurface is the
// REAL pure function, so the affordances pass-through pins the actual device
// derivations, including the one named sub-delta (export keys to desktop, not
// !mobile). featureShootSurface defaults OFF here — the flag-off pins are the
// 5e-I values, byte-identical; the flag-ON block pins the 5e-II value flips.
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

const flagState = vi.hoisted(() => ({
  shootSurface: false,
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

vi.mock("@/shared/lib/flags", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/lib/flags")>()
  return {
    ...actual,
    isFeatureEnabled: (flag: keyof import("@/shared/lib/flags").FeatureFlags) =>
      flag === "featureShootSurface" ? flagState.shootSurface : actual.isFeatureEnabled(flag),
  }
})

import { useResolvedSurface } from "../useResolvedSurface"

function setDevice(device: "mobile" | "tablet" | "desktop") {
  deviceState.isMobile = device === "mobile"
  deviceState.isDesktop = device === "desktop"
}

beforeEach(() => {
  authState.loading = false
  roleState.role = "producer"
  roleState.resolving = false
  flagState.shootSurface = false
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

// ---------------------------------------------------------------------------
// featureShootSurface ON — the hook reads the flag and passes it as the
// resolver's explicit `shootSurfaceEnabled` input (5e-II value flips).
// ---------------------------------------------------------------------------

describe("useResolvedSurface — featureShootSurface flag ON", () => {
  beforeEach(() => {
    flagState.shootSurface = true
  })

  it("crew on mobile gets the shoot chrome (minimal toolbar, tap-row) with the device term dropped from affordances", () => {
    roleState.role = "crew"
    setDevice("mobile")
    const { result } = renderHook(() => useResolvedSurface())
    expect(result.current.surface).toBe("shoot")
    expect(result.current.affordances).toEqual({
      fieldEditing: true,
      lifecycle: true,
      imageUpload: true,
      share: true,
      export: false, // desktop-keyed route constraint, flag-independent
      bulkPull: true,
      repair: true,
      versionRestore: true,
    })
    expect(result.current.chrome).toEqual({
      toolbar: "minimal",
      viewSwitcher: false,
      quickAdd: true,
      statusControl: "tap-row",
    })
  })

  it("crew keeps the tap-row at every density (tablet/desktop too — the shell control, not layout)", () => {
    roleState.role = "crew"
    for (const device of ["mobile", "tablet", "desktop"] as const) {
      setDevice(device)
      const { result } = renderHook(() => useResolvedSurface())
      expect(result.current.chrome?.statusControl).toBe("tap-row")
      expect(result.current.chrome?.toolbar).toBe("minimal")
      expect(result.current.chrome?.viewSwitcher).toBe(false)
    }
  })

  it("plan-build on phone gets the affordance unlock but keeps today's chrome (non-shoot chrome unchanged)", () => {
    roleState.role = "producer"
    setDevice("mobile")
    const { result } = renderHook(() => useResolvedSurface())
    expect(result.current.surface).toBe("plan-build")
    expect(result.current.affordances?.fieldEditing).toBe(true)
    expect(result.current.affordances?.lifecycle).toBe(true)
    expect(result.current.affordances?.export).toBe(false)
    // Chrome identical to flag-off mobile: full toolbar, mobile tap-row fork.
    expect(result.current.chrome).toEqual({
      toolbar: "full",
      viewSwitcher: false,
      quickAdd: true,
      statusControl: "tap-row",
    })
  })

  it("plan-build desktop is unchanged except nothing: affordances already all-on, chrome identical", () => {
    roleState.role = "producer"
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

  it("recomputes when the flag flips between renders (the flag is a memo dependency)", () => {
    roleState.role = "crew"
    setDevice("mobile")
    flagState.shootSurface = false
    const { result, rerender } = renderHook(() => useResolvedSurface())
    const off = result.current
    expect(off.affordances?.fieldEditing).toBe(false)
    expect(off.chrome?.toolbar).toBe("full")

    flagState.shootSurface = true
    rerender()
    expect(result.current).not.toBe(off)
    expect(result.current.affordances?.fieldEditing).toBe(true)
    expect(result.current.chrome?.toolbar).toBe("minimal")
  })
})
