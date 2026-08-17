import { describe, it, expect } from "vitest"
import {
  DEFAULT_REPORT_CONFIG,
  LEGACY_HIDDEN_STATUSES_FILTER_ID,
  LEGACY_REPORT_LAYOUT,
  REPORT_STATUS_LABEL,
  REPORT_STATUS_OPTIONS,
  formatFilterSummary,
  hydrateReportConfig,
  neutralizeReportConfigForFlag,
  reportLayoutSupportsAdditionalImages,
  resolveReportFilters,
  resolveReportLayout,
  resolveShowAdditionalImages,
  resolveShowTags,
  type ReportConfig,
  type ReportFilterCondition,
  type ReportLayout,
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

  it("round-trips groupBy 'scene' and sortBy 'custom' through JSON unchanged", () => {
    const config: ReportConfig = { groupBy: "scene", excludedShotIds: [], sortBy: "custom", sortDir: "asc" }
    expect(JSON.parse(JSON.stringify(config))).toEqual(config)
  })

  it("round-trips a persisted filters array through JSON unchanged", () => {
    const config: ReportConfig = {
      groupBy: "none",
      excludedShotIds: [],
      filters: [{ id: "tag", field: "tag", operator: "in", value: ["t1", "t2"] }],
    }
    expect(JSON.parse(JSON.stringify(config))).toEqual(config)
  })
})

describe("hydrateReportConfig — legacy hiddenStatuses -> filters migration (2026-08-11)", () => {
  it("a genuinely pre-filters blob (no filters, no hiddenStatuses) hydrates with filters absent", () => {
    const stored = JSON.parse('{"groupBy":"gender","excludedShotIds":[],"looksMode":"all","layout":"image-led"}')
    const hydrated = hydrateReportConfig(stored)
    expect(hydrated.filters).toBeUndefined()
  })

  it("a legacy blob with a non-empty hiddenStatuses migrates to an equivalent status/notIn filter", () => {
    const stored = JSON.parse(
      '{"groupBy":"gender","excludedShotIds":[],"looksMode":"all","layout":"image-led","hiddenStatuses":["on_hold","todo"]}',
    )
    const hydrated = hydrateReportConfig(stored)
    expect(hydrated.filters).toEqual([
      { id: LEGACY_HIDDEN_STATUSES_FILTER_ID, field: "status", operator: "notIn", value: ["on_hold", "todo"] },
    ])
    // hiddenStatuses is READ once (to synthesize the filter above) then
    // cleared on the returned object — it has done its only job, and page
    // state (which this becomes) must never carry a non-empty legacy value
    // forward into a future unrelated save. See "hydrateReportConfig clears
    // hiddenStatuses" below for the write-back guarantee this protects.
    expect(hydrated.hiddenStatuses).toEqual([])
  })

  it("a legacy blob with an EMPTY hiddenStatuses does not synthesize a filter", () => {
    const stored = JSON.parse('{"groupBy":"gender","excludedShotIds":[],"hiddenStatuses":[]}')
    expect(hydrateReportConfig(stored).filters).toBeUndefined()
  })

  it("both present: a blob that already carries `filters` is left untouched — hiddenStatuses is never merged in (no double-apply)", () => {
    const storedFilters: ReportFilterCondition[] = [{ id: "tag", field: "tag", operator: "in", value: ["t1"] }]
    const stored: Partial<ReportConfig> = {
      groupBy: "gender",
      excludedShotIds: [],
      hiddenStatuses: ["on_hold"],
      filters: storedFilters,
    }
    const hydrated = hydrateReportConfig(stored)
    expect(hydrated.filters).toEqual(storedFilters)
    expect(hydrated.filters).toHaveLength(1) // NOT 2 — the hiddenStatuses entry was never appended
  })

  it("both present with filters explicitly [] — the empty array wins, hiddenStatuses stays inert", () => {
    const stored: Partial<ReportConfig> = {
      groupBy: "gender",
      excludedShotIds: [],
      hiddenStatuses: ["on_hold"],
      filters: [],
    }
    expect(hydrateReportConfig(stored).filters).toEqual([])
  })

  it("hydrateReportConfig clears hiddenStatuses on EVERY path — migrated, already-filters, and no-op — so a future save can never re-persist it", () => {
    // The write-back guarantee this protects: the hydrated object becomes
    // live page state, and every non-filter setter in ReportView.tsx spreads
    // `{...config, X}` — so anything left in `hiddenStatuses` here would get
    // silently re-saved to Firestore on the next unrelated edit, forever.
    const migrated = hydrateReportConfig({
      groupBy: "gender",
      excludedShotIds: [],
      hiddenStatuses: ["on_hold", "todo"],
    })
    expect(migrated.hiddenStatuses).toEqual([])

    const alreadyFilters = hydrateReportConfig({
      groupBy: "gender",
      excludedShotIds: [],
      hiddenStatuses: ["on_hold"],
      filters: [{ id: "tag", field: "tag", operator: "in", value: ["t1"] }],
    })
    expect(alreadyFilters.hiddenStatuses).toEqual([])

    const brandNew = hydrateReportConfig({})
    expect(brandNew.hiddenStatuses).toEqual([])
  })
})

describe("resolveReportFilters — de-dupes a hand-edited blob to at most one condition per field", () => {
  it("a hand-edited blob with TWO conditions on the same field collapses to ONE, last occurrence wins", () => {
    // The Filters control itself can never produce this (setFieldFilter
    // always replaces, never appends) — only a hand-edited/legacy blob can.
    // Before this fix, the three readers of `filters` disagreed on what such
    // a blob meant: ReportView's `.find()` read the FIRST condition,
    // formatFilterSummary's Map read the LAST, and filterEngine ANDed BOTH.
    const dup: ReportFilterCondition[] = [
      { id: "status-1", field: "status", operator: "notIn", value: ["todo"] },
      { id: "status-2", field: "status", operator: "in", value: ["complete", "on_hold"] },
    ]
    const resolved = resolveReportFilters({ filters: dup })
    expect(resolved).toHaveLength(1)
    expect(resolved[0]).toEqual(dup[1]) // last occurrence wins
  })

  it("the de-duped result is what formatFilterSummary and a ReportView-style .find() BOTH read — they can no longer disagree", () => {
    const dup: ReportFilterCondition[] = [
      { id: "status-1", field: "status", operator: "notIn", value: ["todo"] },
      { id: "status-2", field: "status", operator: "in", value: ["complete", "on_hold"] },
    ]
    const resolved = resolveReportFilters({ filters: dup })
    const foundFirst = resolved.find((f) => f.field === "status")
    expect(foundFirst).toEqual(dup[1]) // .find() now sees the SAME (last) condition the summary counts
    expect(formatFilterSummary(resolved)).toBe("filtered: status included (2)")
  })

  it("a normal single-condition-per-field blob is unaffected", () => {
    const filters: ReportFilterCondition[] = [
      { id: "status", field: "status", operator: "notIn", value: ["todo"] },
      { id: "tag", field: "tag", operator: "in", value: ["t1"] },
    ]
    expect(resolveReportFilters({ filters })).toEqual(filters)
  })
})

describe("neutralizeReportConfigForFlag — filters/custom/scene stripped the same way as sortBy/hiddenStatuses", () => {
  it("flag off strips filters, clamps groupBy 'scene' back to 'gender', and blanks sortBy (so 'custom' can't leak through)", () => {
    const config: ReportConfig = {
      groupBy: "scene",
      excludedShotIds: [],
      sortBy: "custom",
      sortDir: "asc",
      filters: [{ id: "tag", field: "tag", operator: "in", value: ["t1"] }],
    }
    const neutralized = neutralizeReportConfigForFlag(config, false)
    expect(neutralized.filters).toBeUndefined()
    expect(neutralized.sortBy).toBeUndefined()
    expect(neutralized.groupBy).toBe("gender")
  })

  it("flag on returns the config verbatim, filters and all", () => {
    const config: ReportConfig = {
      groupBy: "scene",
      excludedShotIds: [],
      filters: [{ id: "status", field: "status", operator: "in", value: ["todo"] }],
    }
    expect(neutralizeReportConfigForFlag(config, true)).toBe(config)
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

describe("ReportConfig.showAdditionalImages (WS-C, 2026-08-11) — default, hydrate, neutralize", () => {
  it("DEFAULT_REPORT_CONFIG carries showAdditionalImages: false — a brand-new report starts OFF", () => {
    expect(DEFAULT_REPORT_CONFIG.showAdditionalImages).toBe(false)
  })

  it("hydrateReportConfig default-merges a pre-WS-C blob (no showAdditionalImages) to false", () => {
    const stored = JSON.parse('{"groupBy":"gender","excludedShotIds":[],"layout":"production-sheet"}')
    expect(hydrateReportConfig(stored).showAdditionalImages).toBe(false)
  })

  it("hydrateReportConfig preserves a persisted showAdditionalImages:true verbatim", () => {
    const stored = JSON.parse(
      '{"groupBy":"gender","excludedShotIds":[],"layout":"production-sheet","showAdditionalImages":true}',
    )
    expect(hydrateReportConfig(stored).showAdditionalImages).toBe(true)
  })

  it("round-trips showAdditionalImages:true through JSON unchanged", () => {
    const config: ReportConfig = { groupBy: "none", excludedShotIds: [], showAdditionalImages: true }
    expect(JSON.parse(JSON.stringify(config))).toEqual(config)
  })

  it("neutralizeReportConfigForFlag (flag off) forces showAdditionalImages to false — same rollback-safety class as filters/sortBy", () => {
    const config: ReportConfig = { groupBy: "gender", excludedShotIds: [], showAdditionalImages: true }
    expect(neutralizeReportConfigForFlag(config, false).showAdditionalImages).toBe(false)
  })

  it("neutralizeReportConfigForFlag (flag on) leaves showAdditionalImages verbatim", () => {
    const config: ReportConfig = { groupBy: "gender", excludedShotIds: [], showAdditionalImages: true }
    expect(neutralizeReportConfigForFlag(config, true).showAdditionalImages).toBe(true)
  })
})

describe("reportLayoutSupportsAdditionalImages — image-led EXCLUDED v1", () => {
  it("production-sheet and balanced-rows support the row", () => {
    expect(reportLayoutSupportsAdditionalImages("production-sheet")).toBe(true)
    expect(reportLayoutSupportsAdditionalImages("balanced-rows")).toBe(true)
  })
  it("image-led does not (no synced height-estimator term yet)", () => {
    expect(reportLayoutSupportsAdditionalImages("image-led")).toBe(false)
  })
})

describe("resolveShowAdditionalImages — single source for ReportView + ShotReportPage's PDF export", () => {
  it("true only when the raw toggle is on, the layout supports it, AND the config flag is on", () => {
    const on: ReportConfig = { groupBy: "gender", excludedShotIds: [], showAdditionalImages: true }
    expect(resolveShowAdditionalImages(on, "production-sheet", true)).toBe(true)
    expect(resolveShowAdditionalImages(on, "balanced-rows", true)).toBe(true)
  })

  it("false when the raw toggle is off/absent, regardless of layout or flag", () => {
    const off: ReportConfig = { groupBy: "gender", excludedShotIds: [], showAdditionalImages: false }
    const absent: ReportConfig = { groupBy: "gender", excludedShotIds: [] }
    expect(resolveShowAdditionalImages(off, "production-sheet", true)).toBe(false)
    expect(resolveShowAdditionalImages(absent, "production-sheet", true)).toBe(false)
  })

  it("false on image-led even when the toggle is on and the config flag is on (v1 exclusion)", () => {
    const on: ReportConfig = { groupBy: "gender", excludedShotIds: [], showAdditionalImages: true }
    expect(resolveShowAdditionalImages(on, "image-led", true)).toBe(false)
  })

  it("false when featureReportConfig is off, even with the toggle on and a supporting layout — same rollback-safety class as filters/sortBy", () => {
    const on: ReportConfig = { groupBy: "gender", excludedShotIds: [], showAdditionalImages: true }
    expect(resolveShowAdditionalImages(on, "production-sheet", false)).toBe(false)
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

// ---------------------------------------------------------------------------
// Tag chips (2026-08-17) — ReportConfig.showTags. Mechanically mirrors
// showAdditionalImages above with TWO deliberate differences, and BOTH are the
// point of these tests: the default is ON, and there is no per-recipe
// exclusion. A default-ON persisted flag is only safe to roll back because
// neutralizeReportConfigForFlag writes an explicit `false` AND resolveShowTags
// carries an independent `reportConfigEnabled` gate — either alone would leave
// a featureReportConfig rollback rendering chips.
// ---------------------------------------------------------------------------
const ALL_LAYOUTS: readonly ReportLayout[] = ["image-led", "production-sheet", "balanced-rows"]

describe("ReportConfig.showTags (2026-08-17) — default, hydrate, neutralize", () => {
  it("DEFAULT_REPORT_CONFIG carries showTags: true — a brand-new report starts ON (this IS the feature)", () => {
    expect(DEFAULT_REPORT_CONFIG.showTags).toBe(true)
  })

  it("hydrateReportConfig default-merges a pre-tag-chips blob (no showTags) to TRUE", () => {
    const stored = JSON.parse('{"groupBy":"gender","excludedShotIds":[],"layout":"production-sheet"}')
    expect(hydrateReportConfig(stored).showTags).toBe(true)
  })

  it("hydrateReportConfig preserves a persisted showTags:false verbatim (a deliberate Off is never re-defaulted ON)", () => {
    const stored = JSON.parse(
      '{"groupBy":"gender","excludedShotIds":[],"layout":"production-sheet","showTags":false}',
    )
    expect(hydrateReportConfig(stored).showTags).toBe(false)
  })

  it("round-trips showTags:false through JSON unchanged", () => {
    const config: ReportConfig = { groupBy: "none", excludedShotIds: [], showTags: false }
    expect(JSON.parse(JSON.stringify(config))).toEqual(config)
  })

  it("neutralizeReportConfigForFlag (flag off) forces showTags to FALSE — the write that makes a default-ON feature rollback-safe", () => {
    const config: ReportConfig = { groupBy: "gender", excludedShotIds: [], showTags: true }
    expect(neutralizeReportConfigForFlag(config, false).showTags).toBe(false)
  })

  it("neutralizeReportConfigForFlag (flag off) forces showTags to FALSE even when the field is ABSENT", () => {
    // The sharp case a `=== true` guard would miss: an absent showTags resolves
    // ON (resolveShowTags below), so the neutralizer must WRITE false, not just
    // leave the field alone.
    const config: ReportConfig = { groupBy: "gender", excludedShotIds: [] }
    expect(neutralizeReportConfigForFlag(config, false).showTags).toBe(false)
  })

  it("neutralizeReportConfigForFlag (flag on) leaves showTags verbatim", () => {
    const on: ReportConfig = { groupBy: "gender", excludedShotIds: [], showTags: true }
    expect(neutralizeReportConfigForFlag(on, true).showTags).toBe(true)
    const off: ReportConfig = { groupBy: "gender", excludedShotIds: [], showTags: false }
    expect(neutralizeReportConfigForFlag(off, true).showTags).toBe(false)
  })
})

describe("resolveShowTags — single source for ReportView + ShotReportPage's PDF export", () => {
  it("true when the toggle is on and the config flag is on", () => {
    const on: ReportConfig = { groupBy: "gender", excludedShotIds: [], showTags: true }
    expect(resolveShowTags(on, true)).toBe(true)
  })

  it("true when the field is ABSENT and the config flag is on — absent means 'never chosen', and the shipped default is ON", () => {
    const absent: ReportConfig = { groupBy: "gender", excludedShotIds: [] }
    expect(resolveShowTags(absent, true)).toBe(true)
  })

  it("false for an explicit showTags:false, whatever the flag", () => {
    const off: ReportConfig = { groupBy: "gender", excludedShotIds: [], showTags: false }
    expect(resolveShowTags(off, true)).toBe(false)
    expect(resolveShowTags(off, false)).toBe(false)
  })

  it("false when featureReportConfig is off — the independent gate that keeps a rollback byte-identical even for a config the neutralizer never touched", () => {
    const on: ReportConfig = { groupBy: "gender", excludedShotIds: [], showTags: true }
    const absent: ReportConfig = { groupBy: "gender", excludedShotIds: [] }
    expect(resolveShowTags(on, false)).toBe(false)
    expect(resolveShowTags(absent, false)).toBe(false)
    expect(resolveShowTags(DEFAULT_REPORT_CONFIG, false)).toBe(false)
  })

  it("has NO per-recipe exclusion — unlike the extras row, every layout renders the tag row", () => {
    // The falsifiable complement to the DOM tests: if someone later adds a
    // `reportLayoutSupportsTags`-style clamp, this reddens. Compare directly
    // against resolveShowAdditionalImages, which DOES exclude image-led.
    const on: ReportConfig = {
      groupBy: "gender",
      excludedShotIds: [],
      showTags: true,
      showAdditionalImages: true,
    }
    for (const layout of ALL_LAYOUTS) {
      expect(resolveShowTags(on, true)).toBe(true)
      // ...and the sibling resolver still excludes image-led, so this test is
      // asserting a real difference, not a tautology about a constant.
      expect(resolveShowAdditionalImages(on, layout, true)).toBe(layout !== "image-led")
    }
  })

  it("the flag-off neutralizer and the flag-off resolver agree (belt AND suspenders, not belt OR suspenders)", () => {
    const on: ReportConfig = { groupBy: "gender", excludedShotIds: [], showTags: true }
    const neutralized = neutralizeReportConfigForFlag(on, false)
    // Either gate alone would be enough; both are present on purpose, so a
    // future refactor that drops one still can't leak chips past a rollback.
    expect(resolveShowTags(neutralized, false)).toBe(false)
    expect(resolveShowTags(neutralized, true)).toBe(false) // the neutralizer's own write
    expect(resolveShowTags(on, false)).toBe(false) // the resolver's own gate
  })
})
