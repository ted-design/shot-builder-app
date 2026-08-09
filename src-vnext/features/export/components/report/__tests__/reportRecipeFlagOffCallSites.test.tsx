/// <reference types="@testing-library/jest-dom" />
// H2 — the clamp that keeps `featureShotReportRecipes` OFF byte-identical to
// the pre-recipes report was only proven at the `resolveReportLayout` helper
// (reportTypes.test.ts). Nothing exercised the two real CALL SITES that
// actually decide what a user sees/persists. Mutation check: reverting either
// call site to a raw `config.layout ?? "image-led"` (i.e. NOT routing through
// resolveReportLayout with the live flag) must redden its test here, because
// production-sheet becoming DEFAULT_REPORT_CONFIG.layout (2026-08-09) means a
// bypassed clamp would render/persist "production-sheet" instead.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render } from "@testing-library/react"
import { ReportView } from "../ReportView"
import { DEFAULT_REPORT_CONFIG, type ReportConfig, type ReportModel } from "../../../lib/report/reportTypes"

// Only featureShotReportRecipes is pinned; everything else falls through to
// the real flag module so unrelated flags keep their normal behavior.
vi.mock("@/shared/lib/flags", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/lib/flags")>()
  return {
    ...actual,
    isFeatureEnabled: (flag: keyof import("@/shared/lib/flags").FeatureFlags) =>
      flag === "featureShotReportRecipes" ? false : actual.isFeatureEnabled(flag),
  }
})

function emptyModel(): ReportModel {
  return {
    project: { name: "Flag-off clamp fixture", client: "unbound-merino", shotCount: 0, dateRange: null },
    groups: [],
    order: { sortBy: "shot-number", sortDir: "asc" },
  }
}

describe("ReportView screen render — featureShotReportRecipes OFF clamps to image-led (H2a)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders data-layout=image-led even when the persisted config carries production-sheet", () => {
    const config: ReportConfig = { ...DEFAULT_REPORT_CONFIG, layout: "production-sheet" }
    const { container } = render(
      <ReportView
        model={emptyModel()}
        imageMap={new Map()}
        config={config}
        onConfigChange={vi.fn()}
        onExportPdf={vi.fn()}
      />,
    )
    expect(container.querySelector(".sb-report-root")?.getAttribute("data-layout")).toBe(
      "image-led",
    )
  })

  it("renders data-layout=image-led when config.layout is absent (brand-new-report shape)", () => {
    const config: ReportConfig = { ...DEFAULT_REPORT_CONFIG, layout: undefined }
    const { container } = render(
      <ReportView
        model={emptyModel()}
        imageMap={new Map()}
        config={config}
        onConfigChange={vi.fn()}
        onExportPdf={vi.fn()}
      />,
    )
    expect(container.querySelector(".sb-report-root")?.getAttribute("data-layout")).toBe(
      "image-led",
    )
  })
})
