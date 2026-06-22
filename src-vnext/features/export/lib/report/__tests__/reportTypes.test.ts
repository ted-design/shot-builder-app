import { describe, it, expect } from "vitest"
import { DEFAULT_REPORT_CONFIG, type ReportConfig } from "../reportTypes"

describe("ReportConfig persistence round-trip", () => {
  it("survives JSON serialize/parse unchanged (Firestore-safe — no Set/Date)", () => {
    const config: ReportConfig = { groupBy: "none", excludedShotIds: ["a", "b"], looksMode: "primary-only" }
    expect(JSON.parse(JSON.stringify(config))).toEqual(config)
  })

  it("default-merges a pre-looksMode blob, filling looksMode from the default", () => {
    // How ShotReportPage hydrates a persisted config; forward-compatible by design.
    // An older blob written before looksMode existed must hydrate to looksMode "all".
    const stored = JSON.parse('{"groupBy":"none","excludedShotIds":["x"]}')
    const hydrated: ReportConfig = { ...DEFAULT_REPORT_CONFIG, ...stored }
    expect(hydrated.groupBy).toBe("none")
    expect(hydrated.excludedShotIds).toEqual(["x"])
    expect(hydrated.looksMode).toBe("all")
  })

  it("default-merges a pre-layout blob to layout 'image-led' (R3 forward-compat)", () => {
    // A pre-R3 shot-report doc has no layout — it must hydrate to the shipped image-led layout.
    const stored = JSON.parse('{"groupBy":"gender","excludedShotIds":[],"looksMode":"all"}')
    const hydrated: ReportConfig = { ...DEFAULT_REPORT_CONFIG, ...stored }
    expect(hydrated.layout).toBe("image-led")
  })
})
