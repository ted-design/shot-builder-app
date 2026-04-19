import { describe, it, expect } from "vitest"
import { getFeatureFlags, isFeatureEnabled } from "../flags"

describe("feature flags", () => {
  it("defaults featurePublishing to false (Phase 3 is dark on main)", () => {
    expect(getFeatureFlags().featurePublishing).toBe(false)
  })

  it("isFeatureEnabled returns the flag value", () => {
    expect(isFeatureEnabled("featurePublishing")).toBe(false)
  })
})
