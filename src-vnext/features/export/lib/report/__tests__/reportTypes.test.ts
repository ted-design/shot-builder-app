import { describe, it, expect } from "vitest"
import { DEFAULT_REPORT_CONFIG, type ReportConfig } from "../reportTypes"

describe("ReportConfig persistence round-trip", () => {
  it("survives JSON serialize/parse unchanged (Firestore-safe — no Set/Date)", () => {
    const config: ReportConfig = { groupBy: "none", excludedShotIds: ["a", "b"] }
    expect(JSON.parse(JSON.stringify(config))).toEqual(config)
  })

  it("default-merges a stored blob, filling any field it omits", () => {
    // How ShotReportPage hydrates a persisted config; forward-compatible by design.
    const stored = JSON.parse('{"groupBy":"none","excludedShotIds":["x"]}')
    const hydrated: ReportConfig = { ...DEFAULT_REPORT_CONFIG, ...stored }
    expect(hydrated.groupBy).toBe("none")
    expect(hydrated.excludedShotIds).toEqual(["x"])
  })
})
