import { describe, it, expect } from "vitest"
import { DEFAULT_REPORT_CONFIG, type ReportConfig } from "../reportTypes"
import { DEFAULT_PRODUCT_INFO_CONFIG, type ProductInfoConfig } from "../productInfoTypes"
import { DEFAULT_TALENT_CONFIG, type TalentConfig } from "../talentTypes"

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

  it("default-merges a pre-hiddenStatuses blob to hiddenStatuses [] (R3-filter forward-compat)", () => {
    // A blob written before the status filter existed must hydrate to [] -> nothing hidden.
    const stored = JSON.parse('{"groupBy":"gender","excludedShotIds":[],"looksMode":"all","layout":"image-led"}')
    const hydrated: ReportConfig = { ...DEFAULT_REPORT_CONFIG, ...stored }
    expect(hydrated.hiddenStatuses).toEqual([])
  })

  it("default-merges a pre-Phase-B blob to sortBy 'shot-number' / sortDir 'asc' (R2 forward-compat)", () => {
    // A blob written before order-by existed must hydrate to the shipped legacy order.
    const stored = JSON.parse('{"groupBy":"gender","excludedShotIds":[],"looksMode":"all","layout":"image-led","hiddenStatuses":[]}')
    const hydrated: ReportConfig = { ...DEFAULT_REPORT_CONFIG, ...stored }
    expect(hydrated.sortBy).toBe("shot-number")
    expect(hydrated.sortDir).toBe("asc")
  })

  it("round-trips sortBy/sortDir + the widened groupBy 'status' through JSON unchanged", () => {
    const config: ReportConfig = { groupBy: "status", excludedShotIds: [], sortBy: "talent", sortDir: "desc" }
    expect(JSON.parse(JSON.stringify(config))).toEqual(config)
  })
})

describe("ProductInfoConfig persistence round-trip (Phase B)", () => {
  it("default-merges a pre-Phase-B blob to sortBy 'style' / sortDir 'asc'", () => {
    const stored = JSON.parse('{"groupBy":"gender","productScope":"in-use","imageSize":"m","excludedFamilyIds":[]}')
    const hydrated: ProductInfoConfig = { ...DEFAULT_PRODUCT_INFO_CONFIG, ...stored }
    expect(hydrated.sortBy).toBe("style")
    expect(hydrated.sortDir).toBe("asc")
  })

  it("round-trips sortBy/sortDir through JSON unchanged", () => {
    const config: ProductInfoConfig = {
      groupBy: "none", productScope: "in-use", imageSize: "m", excludedFamilyIds: [], sortBy: "gender", sortDir: "desc",
    }
    expect(JSON.parse(JSON.stringify(config))).toEqual(config)
  })
})

describe("TalentConfig persistence round-trip (Phase B)", () => {
  it("default-merges a pre-Phase-B blob to sortBy 'name' / sortDir 'asc'", () => {
    const stored = JSON.parse('{"groupBy":"none","talentScope":"in-shots","excludedTalentIds":[]}')
    const hydrated: TalentConfig = { ...DEFAULT_TALENT_CONFIG, ...stored }
    expect(hydrated.sortBy).toBe("name")
    expect(hydrated.sortDir).toBe("asc")
  })

  it("round-trips sortBy/sortDir through JSON unchanged", () => {
    const config: TalentConfig = {
      groupBy: "agency", talentScope: "in-shots", excludedTalentIds: [], sortBy: "agency", sortDir: "desc",
    }
    expect(JSON.parse(JSON.stringify(config))).toEqual(config)
  })
})
