import { describe, it, expect, vi, afterEach } from "vitest"
import { getFeatureFlags, isFeatureEnabled } from "../flags"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("feature flags", () => {
  it("defaults featurePublishing to false (Phase 3 is dark on main)", () => {
    expect(getFeatureFlags().featurePublishing).toBe(false)
  })

  it("isFeatureEnabled returns the flag value", () => {
    expect(isFeatureEnabled("featurePublishing")).toBe(false)
  })

  it("defaults featureSurfaceResolver to TRUE (5e-I default flip — never-customized producers on tablet/desktop get the table surface default)", () => {
    expect(getFeatureFlags().featureSurfaceResolver).toBe(true)
    expect(isFeatureEnabled("featureSurfaceResolver")).toBe(true)
  })

  it("VITE_SURFACE_RESOLVER stays an enable-only override hook: no env value can turn the default-ON resolver off", () => {
    for (const value of ["0", "false", "", "off"]) {
      vi.stubEnv("VITE_SURFACE_RESOLVER", value)
      expect(isFeatureEnabled("featureSurfaceResolver")).toBe(true)
    }
    vi.stubEnv("VITE_SURFACE_RESOLVER", "1")
    expect(isFeatureEnabled("featureSurfaceResolver")).toBe(true)
  })

  it("defaults featureShootSurface to false (Phase 5e is dark on main; CI build env never defines VITE_SHOOT_SURFACE)", () => {
    expect(getFeatureFlags().featureShootSurface).toBe(false)
    expect(isFeatureEnabled("featureShootSurface")).toBe(false)
  })

  it("VITE_SHOOT_SURFACE='1' or 'true' enables featureShootSurface (VITE_SURFACE_RESOLVER env-parse precedent)", () => {
    vi.stubEnv("VITE_SHOOT_SURFACE", "1")
    expect(isFeatureEnabled("featureShootSurface")).toBe(true)

    vi.stubEnv("VITE_SHOOT_SURFACE", "true")
    expect(isFeatureEnabled("featureShootSurface")).toBe(true)

    vi.stubEnv("VITE_SHOOT_SURFACE", "TRUE")
    expect(isFeatureEnabled("featureShootSurface")).toBe(true)
  })

  it("any other VITE_SHOOT_SURFACE value stays off (no URL/localStorage override layer)", () => {
    for (const value of ["0", "false", "", "yes", "on"]) {
      vi.stubEnv("VITE_SHOOT_SURFACE", value)
      expect(isFeatureEnabled("featureShootSurface")).toBe(false)
    }
  })
})
