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

  it("defaults featureTalentRosterIA to false (Talent redesign Phase 1a is dark on main)", () => {
    expect(getFeatureFlags().featureTalentRosterIA).toBe(false)
    expect(isFeatureEnabled("featureTalentRosterIA")).toBe(false)
  })

  it("VITE_TALENT_ROSTER_IA='1' or 'true' enables featureTalentRosterIA", () => {
    vi.stubEnv("VITE_TALENT_ROSTER_IA", "1")
    expect(isFeatureEnabled("featureTalentRosterIA")).toBe(true)

    vi.stubEnv("VITE_TALENT_ROSTER_IA", "true")
    expect(isFeatureEnabled("featureTalentRosterIA")).toBe(true)
  })

  it("any other VITE_TALENT_ROSTER_IA value stays off (no URL/localStorage override layer)", () => {
    for (const value of ["0", "false", "", "yes", "on"]) {
      vi.stubEnv("VITE_TALENT_ROSTER_IA", value)
      expect(isFeatureEnabled("featureTalentRosterIA")).toBe(false)
    }
  })

  it("defaults featureTalentDetailIA to false (Talent redesign Phase 2 is dark on main)", () => {
    expect(getFeatureFlags().featureTalentDetailIA).toBe(false)
    expect(isFeatureEnabled("featureTalentDetailIA")).toBe(false)
  })

  it("VITE_TALENT_DETAIL_IA='1' or 'true' enables featureTalentDetailIA", () => {
    vi.stubEnv("VITE_TALENT_DETAIL_IA", "1")
    expect(isFeatureEnabled("featureTalentDetailIA")).toBe(true)

    vi.stubEnv("VITE_TALENT_DETAIL_IA", "true")
    expect(isFeatureEnabled("featureTalentDetailIA")).toBe(true)
  })

  it("any other VITE_TALENT_DETAIL_IA value stays off (no URL/localStorage override layer)", () => {
    for (const value of ["0", "false", "", "yes", "on"]) {
      vi.stubEnv("VITE_TALENT_DETAIL_IA", value)
      expect(isFeatureEnabled("featureTalentDetailIA")).toBe(false)
    }
  })

  it("defaults featureShotFilterTalentScope to false (shot-list talent filter stays full-library on main)", () => {
    expect(getFeatureFlags().featureShotFilterTalentScope).toBe(false)
    expect(isFeatureEnabled("featureShotFilterTalentScope")).toBe(false)
  })

  it("VITE_SHOT_FILTER_TALENT_SCOPE='1' or 'true' enables featureShotFilterTalentScope", () => {
    vi.stubEnv("VITE_SHOT_FILTER_TALENT_SCOPE", "1")
    expect(isFeatureEnabled("featureShotFilterTalentScope")).toBe(true)

    vi.stubEnv("VITE_SHOT_FILTER_TALENT_SCOPE", "true")
    expect(isFeatureEnabled("featureShotFilterTalentScope")).toBe(true)
  })

  it("any other VITE_SHOT_FILTER_TALENT_SCOPE value stays off (no URL/localStorage override layer)", () => {
    for (const value of ["0", "false", "", "yes", "on"]) {
      vi.stubEnv("VITE_SHOT_FILTER_TALENT_SCOPE", value)
      expect(isFeatureEnabled("featureShotFilterTalentScope")).toBe(false)
    }
  })

  it("defaults featureTalentAgencyCombobox to false (agency stays free-text on main; normalize before flip)", () => {
    expect(getFeatureFlags().featureTalentAgencyCombobox).toBe(false)
    expect(isFeatureEnabled("featureTalentAgencyCombobox")).toBe(false)
  })

  it("VITE_TALENT_AGENCY_COMBOBOX='1' or 'true' enables featureTalentAgencyCombobox", () => {
    vi.stubEnv("VITE_TALENT_AGENCY_COMBOBOX", "1")
    expect(isFeatureEnabled("featureTalentAgencyCombobox")).toBe(true)

    vi.stubEnv("VITE_TALENT_AGENCY_COMBOBOX", "true")
    expect(isFeatureEnabled("featureTalentAgencyCombobox")).toBe(true)
  })

  it("any other VITE_TALENT_AGENCY_COMBOBOX value stays off (no URL/localStorage override layer)", () => {
    for (const value of ["0", "false", "", "yes", "on"]) {
      vi.stubEnv("VITE_TALENT_AGENCY_COMBOBOX", value)
      expect(isFeatureEnabled("featureTalentAgencyCombobox")).toBe(false)
    }
  })

  it("defaults featureCastingMatcherSurface to false (Talent redesign Phase 3 is dark on main)", () => {
    expect(getFeatureFlags().featureCastingMatcherSurface).toBe(false)
    expect(isFeatureEnabled("featureCastingMatcherSurface")).toBe(false)
  })

  it("VITE_CASTING_MATCHER_SURFACE='1' or 'true' enables featureCastingMatcherSurface", () => {
    vi.stubEnv("VITE_CASTING_MATCHER_SURFACE", "1")
    expect(isFeatureEnabled("featureCastingMatcherSurface")).toBe(true)

    vi.stubEnv("VITE_CASTING_MATCHER_SURFACE", "true")
    expect(isFeatureEnabled("featureCastingMatcherSurface")).toBe(true)
  })

  it("any other VITE_CASTING_MATCHER_SURFACE value stays off (no URL/localStorage override layer)", () => {
    for (const value of ["0", "false", "", "yes", "on"]) {
      vi.stubEnv("VITE_CASTING_MATCHER_SURFACE", value)
      expect(isFeatureEnabled("featureCastingMatcherSurface")).toBe(false)
    }
  })

  it("defaults featureTalentLazy to false (Talent redesign Phase 6 is dark on main)", () => {
    expect(getFeatureFlags().featureTalentLazy).toBe(false)
    expect(isFeatureEnabled("featureTalentLazy")).toBe(false)
  })

  it("VITE_TALENT_LAZY='1' or 'true' enables featureTalentLazy", () => {
    vi.stubEnv("VITE_TALENT_LAZY", "1")
    expect(isFeatureEnabled("featureTalentLazy")).toBe(true)

    vi.stubEnv("VITE_TALENT_LAZY", "true")
    expect(isFeatureEnabled("featureTalentLazy")).toBe(true)
  })

  it("any other VITE_TALENT_LAZY value stays off (no URL/localStorage override layer)", () => {
    for (const value of ["0", "false", "", "yes", "on"]) {
      vi.stubEnv("VITE_TALENT_LAZY", value)
      expect(isFeatureEnabled("featureTalentLazy")).toBe(false)
    }
  })
})
