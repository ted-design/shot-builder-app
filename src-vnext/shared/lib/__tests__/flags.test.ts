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

  it("defaults featureSurfaceResolver to false (Phase 4 is dark on main; CI build env never defines VITE_SURFACE_RESOLVER)", () => {
    expect(getFeatureFlags().featureSurfaceResolver).toBe(false)
    expect(isFeatureEnabled("featureSurfaceResolver")).toBe(false)
  })

  it("VITE_SURFACE_RESOLVER='1' or 'true' enables featureSurfaceResolver (LoginPage env-parse precedent)", () => {
    vi.stubEnv("VITE_SURFACE_RESOLVER", "1")
    expect(isFeatureEnabled("featureSurfaceResolver")).toBe(true)

    vi.stubEnv("VITE_SURFACE_RESOLVER", "true")
    expect(isFeatureEnabled("featureSurfaceResolver")).toBe(true)

    vi.stubEnv("VITE_SURFACE_RESOLVER", "TRUE")
    expect(isFeatureEnabled("featureSurfaceResolver")).toBe(true)
  })

  it("any other VITE_SURFACE_RESOLVER value stays off (no URL/localStorage override layer)", () => {
    for (const value of ["0", "false", "", "yes", "on"]) {
      vi.stubEnv("VITE_SURFACE_RESOLVER", value)
      expect(isFeatureEnabled("featureSurfaceResolver")).toBe(false)
    }
  })

  it("defaults featureUnifiedShotEditor to false (Phase 5a is dark on main; CI build env never defines VITE_UNIFIED_SHOT_EDITOR)", () => {
    expect(getFeatureFlags().featureUnifiedShotEditor).toBe(false)
    expect(isFeatureEnabled("featureUnifiedShotEditor")).toBe(false)
  })

  it("VITE_UNIFIED_SHOT_EDITOR='1' or 'true' enables featureUnifiedShotEditor (featureSurfaceResolver env-parse precedent)", () => {
    vi.stubEnv("VITE_UNIFIED_SHOT_EDITOR", "1")
    expect(isFeatureEnabled("featureUnifiedShotEditor")).toBe(true)

    vi.stubEnv("VITE_UNIFIED_SHOT_EDITOR", "true")
    expect(isFeatureEnabled("featureUnifiedShotEditor")).toBe(true)

    vi.stubEnv("VITE_UNIFIED_SHOT_EDITOR", "TRUE")
    expect(isFeatureEnabled("featureUnifiedShotEditor")).toBe(true)
  })

  it("any other VITE_UNIFIED_SHOT_EDITOR value stays off (no URL/localStorage override layer)", () => {
    for (const value of ["0", "false", "", "yes", "on"]) {
      vi.stubEnv("VITE_UNIFIED_SHOT_EDITOR", value)
      expect(isFeatureEnabled("featureUnifiedShotEditor")).toBe(false)
    }
  })

  it("featureUnifiedShotEditor is independent of featureSurfaceResolver (separate rollbacks, never coupled)", () => {
    vi.stubEnv("VITE_UNIFIED_SHOT_EDITOR", "1")
    expect(isFeatureEnabled("featureUnifiedShotEditor")).toBe(true)
    expect(isFeatureEnabled("featureSurfaceResolver")).toBe(false)

    vi.unstubAllEnvs()
    vi.stubEnv("VITE_SURFACE_RESOLVER", "1")
    expect(isFeatureEnabled("featureSurfaceResolver")).toBe(true)
    expect(isFeatureEnabled("featureUnifiedShotEditor")).toBe(false)
  })
})
