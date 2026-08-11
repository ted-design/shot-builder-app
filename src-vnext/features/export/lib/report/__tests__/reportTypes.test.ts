import { describe, it, expect } from "vitest"
import {
  DEFAULT_REPORT_CONFIG,
  LEGACY_REPORT_LAYOUT,
  REPORT_STATUS_LABEL,
  REPORT_STATUS_OPTIONS,
  hydrateReportConfig,
  resolveReportLayout,
  type ReportConfig,
} from "../reportTypes"
import { DEFAULT_PRODUCT_INFO_CONFIG, type ProductInfoConfig } from "../productInfoTypes"
import { DEFAULT_TALENT_CONFIG, type TalentConfig } from "../talentTypes"

describe("ReportConfig persistence round-trip", () => {
  it("survives JSON serialize/parse unchanged (Firestore-safe — no Set/Date)", () => {
    const config: ReportConfig = { groupBy: "none", excludedShotIds: ["a", "b"], looksMode: "primary-only" }
    expect(JSON.parse(JSON.stringify(config))).toEqual(config)
  })

  it("default-merges a pre-looksMode blob, filling looksMode from the default", () => {
    // hydrateReportConfig is the REAL fn ShotReportPage calls to hydrate a
    // persisted config — not a copy of its merge logic — so this breaks if
    // that code path ever diverges. An older blob written before looksMode
    // existed must hydrate to looksMode "all".
    const stored = JSON.parse('{"groupBy":"none","excludedShotIds":["x"]}')
    const hydrated = hydrateReportConfig(stored)
    expect(hydrated.groupBy).toBe("none")
    expect(hydrated.excludedShotIds).toEqual(["x"])
    expect(hydrated.looksMode).toBe("all")
  })

  it("default-merges a pre-layout blob to LEGACY_REPORT_LAYOUT 'image-led' (R3 forward-compat) — even though DEFAULT_REPORT_CONFIG.layout is now a different value", () => {
    // A pre-R3 shot-report doc has no layout at all — it must hydrate to the
    // shipped image-led layout it always rendered, NOT to whatever NEW
    // reports currently default to. Pin both sides of the decoupling so a
    // future "just re-point the floor at the default" edit goes red here.
    expect(DEFAULT_REPORT_CONFIG.layout).not.toBe("image-led")
    expect(DEFAULT_REPORT_CONFIG.layout).toBe("production-sheet")
    const stored = JSON.parse('{"groupBy":"gender","excludedShotIds":[],"looksMode":"all"}')
    const hydrated = hydrateReportConfig(stored)
    expect(hydrated.layout).toBe(LEGACY_REPORT_LAYOUT)
    expect(hydrated.layout).toBe("image-led")
  })

  it("a persisted layout ALWAYS wins over both the legacy floor and the current default", () => {
    const stored = JSON.parse('{"groupBy":"gender","excludedShotIds":[],"layout":"balanced-rows"}')
    expect(hydrateReportConfig(stored).layout).toBe("balanced-rows")
    const storedImageLed = JSON.parse('{"groupBy":"gender","excludedShotIds":[],"layout":"image-led"}')
    expect(hydrateReportConfig(storedImageLed).layout).toBe("image-led")
  })

  it("a brand-new report (no persisted doc) defaults to layout 'production-sheet' (2026-08-09 decision)", () => {
    expect(DEFAULT_REPORT_CONFIG.layout).toBe("production-sheet")
  })

  it("default-merges a pre-hiddenStatuses blob to hiddenStatuses [] (R3-filter forward-compat)", () => {
    // A blob written before the status filter existed must hydrate to [] -> nothing hidden.
    const stored = JSON.parse('{"groupBy":"gender","excludedShotIds":[],"looksMode":"all","layout":"image-led"}')
    const hydrated = hydrateReportConfig(stored)
    expect(hydrated.hiddenStatuses).toEqual([])
  })

  it("default-merges a pre-Phase-B blob to sortBy 'shot-number' / sortDir 'asc' (R2 forward-compat)", () => {
    // A blob written before order-by existed must hydrate to the shipped legacy order.
    const stored = JSON.parse('{"groupBy":"gender","excludedShotIds":[],"looksMode":"all","layout":"image-led","hiddenStatuses":[]}')
    const hydrated = hydrateReportConfig(stored)
    expect(hydrated.sortBy).toBe("shot-number")
    expect(hydrated.sortDir).toBe("asc")
  })

  it("round-trips sortBy/sortDir + the widened groupBy 'status' through JSON unchanged", () => {
    const config: ReportConfig = { groupBy: "status", excludedShotIds: [], sortBy: "talent", sortDir: "desc" }
    expect(JSON.parse(JSON.stringify(config))).toEqual(config)
  })
})

describe("resolveReportLayout — featureShotReportRecipes flag-off clamp", () => {
  it("flag OFF always resolves to image-led, even for a fresh DEFAULT_REPORT_CONFIG (the mutation-check the 2026-08-09 default-recipe change must survive)", () => {
    // DEFAULT_REPORT_CONFIG.layout is production-sheet — a naive
    // `config.layout ?? "image-led"` with no flag branch would leak it
    // through here. This is exactly the ShotReportListPage.handleCreate
    // flag-off create path: a fresh default config, flag off.
    expect(resolveReportLayout(DEFAULT_REPORT_CONFIG, false)).toBe("image-led")
  })

  it("flag OFF clamps to image-led even when config.layout explicitly carries a different recipe", () => {
    const config: ReportConfig = { groupBy: "gender", excludedShotIds: [], layout: "balanced-rows" }
    expect(resolveReportLayout(config, false)).toBe("image-led")
  })

  it("flag ON resolves DEFAULT_REPORT_CONFIG.layout (production-sheet) for a fresh config", () => {
    expect(resolveReportLayout(DEFAULT_REPORT_CONFIG, true)).toBe("production-sheet")
  })

  it("flag ON respects an explicit persisted choice of any recipe", () => {
    const imageLed: ReportConfig = { groupBy: "gender", excludedShotIds: [], layout: "image-led" }
    const balanced: ReportConfig = { groupBy: "gender", excludedShotIds: [], layout: "balanced-rows" }
    expect(resolveReportLayout(imageLed, true)).toBe("image-led")
    expect(resolveReportLayout(balanced, true)).toBe("balanced-rows")
  })

  it("flag ON with layout absent falls back to image-led (matches the pre-R3-blob hydrate floor)", () => {
    const config = { groupBy: "gender", excludedShotIds: [] } as ReportConfig
    expect(resolveReportLayout(config, true)).toBe("image-led")
  })
})

describe("REPORT_STATUS_LABEL / REPORT_STATUS_OPTIONS — 'Hide statuses' vocabulary", () => {
  it("carries the canonical wording (statusMappings.ts), not a local literal", () => {
    expect(REPORT_STATUS_LABEL).toEqual({
      complete: "Shot",
      in_progress: "In Progress",
      on_hold: "On Hold",
      todo: "Draft",
    })
  })

  // Pins the rendered chip ORDER in all three "Hide statuses" control bars
  // (ReportView, TalentReportView, ProductInfoReportView all derive from
  // REPORT_STATUS_OPTIONS). Nothing else in the suite asserted this order,
  // so a re-derivation that silently reshuffles the keys (e.g. building the
  // map from a differently-ordered source) would ship unnoticed.
  it("preserves the pre-existing 'Hide statuses' chip order: complete, in_progress, on_hold, todo", () => {
    expect(REPORT_STATUS_OPTIONS.map((o) => o.value)).toEqual([
      "complete",
      "in_progress",
      "on_hold",
      "todo",
    ])
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

  it("default-merges a pre-Phase-C blob (no layout) to layout 'gallery' (R4 forward-compat)", () => {
    // A doc written before the density variant existed must hydrate to the shipped gallery layout.
    const stored = JSON.parse(
      '{"groupBy":"gender","productScope":"in-use","imageSize":"m","excludedFamilyIds":[],"sortBy":"style","sortDir":"asc"}',
    )
    const hydrated: ProductInfoConfig = { ...DEFAULT_PRODUCT_INFO_CONFIG, ...stored }
    expect(hydrated.layout).toBe("gallery")
  })

  it("round-trips a persisted layout 'index' through JSON unchanged", () => {
    const config: ProductInfoConfig = {
      groupBy: "none", productScope: "in-use", imageSize: "m", excludedFamilyIds: [], layout: "index",
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

describe("TalentConfig layout density (Phase C)", () => {
  it("default-merges a pre-Phase-C blob (no layout) to layout 'detail' (R4 forward-compat)", () => {
    // A doc written before the density variant existed must hydrate to the shipped detail layout.
    const stored = JSON.parse(
      '{"groupBy":"none","talentScope":"in-shots","excludedTalentIds":[],"sortBy":"name","sortDir":"asc"}',
    )
    const hydrated: TalentConfig = { ...DEFAULT_TALENT_CONFIG, ...stored }
    expect(hydrated.layout).toBe("detail")
  })

  it("round-trips a persisted layout 'contact-sheet' through JSON unchanged", () => {
    const config: TalentConfig = {
      groupBy: "none", talentScope: "in-shots", excludedTalentIds: [], layout: "contact-sheet",
    }
    expect(JSON.parse(JSON.stringify(config))).toEqual(config)
  })
})

describe("TalentConfig headshot crop (Phase C, R4 part 2)", () => {
  it("default-merges a pre-crop blob (no headshotCrops) to an empty {} map", () => {
    // A doc written before the adjustable crop existed must hydrate to no crops.
    const stored = JSON.parse(
      '{"groupBy":"none","talentScope":"in-shots","excludedTalentIds":[],"layout":"contact-sheet"}',
    )
    const hydrated: TalentConfig = { ...DEFAULT_TALENT_CONFIG, ...stored }
    expect(hydrated.headshotCrops).toEqual({})
  })

  it("round-trips a persisted per-talent crop map through JSON unchanged", () => {
    const config: TalentConfig = {
      groupBy: "none",
      talentScope: "in-shots",
      excludedTalentIds: [],
      layout: "contact-sheet",
      headshotCrops: { tA: { scale: 1.5, x: 0.25, y: 0.1 } },
    }
    expect(JSON.parse(JSON.stringify(config))).toEqual(config)
  })
})
