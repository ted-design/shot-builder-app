/// <reference types="@testing-library/jest-dom" />
// Regression coverage for: the "Extra images" control used to render
// disabled with a title telling the user to "switch to On-set sheet or
// All-rounder" even when featureShotReportRecipes was OFF — a state where
// the Recipe picker (the only way to make that switch) is ALSO hidden, so
// the guidance pointed at a control the user could never reach. Separate
// file from ReportView.additionalImages.test.tsx because it needs a
// DIFFERENT flag combination (featureReportConfig ON, featureShotReportRecipes
// OFF) than that file's shared top-of-file mock.
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { ReportView } from "../ReportView"
import { DEFAULT_REPORT_CONFIG, type ReportModel } from "../../../lib/report/reportTypes"

vi.mock("@/shared/lib/flags", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/lib/flags")>()
  return {
    ...actual,
    isFeatureEnabled: (flag: keyof import("@/shared/lib/flags").FeatureFlags) => {
      if (flag === "featureReportConfig") return true
      if (flag === "featureShotReportRecipes") return false
      return actual.isFeatureEnabled(flag)
    },
  }
})

function emptyModel(): ReportModel {
  return {
    project: { name: "Extra images control fixture", client: "unbound-merino", shotCount: 0, dateRange: null },
    groups: [],
    order: { sortBy: "shot-number", sortDir: "asc" },
  }
}

describe("ReportView — Extra images control, recipes flag OFF (dead-end guard)", () => {
  it("is hidden entirely (not merely disabled) — it can never become available with no Recipe picker to switch on", () => {
    render(
      <ReportView
        model={emptyModel()}
        imageMap={new Map()}
        config={DEFAULT_REPORT_CONFIG}
        availableTags={[]}
        onConfigChange={vi.fn()}
        onExportPdf={vi.fn()}
      />,
    )
    // recipesEnabled:false forces layout to "image-led" permanently
    // (resolveReportLayout), so additionalImagesAvailable can never become
    // true and the Recipe picker (showLayout) is also hidden — no path to
    // ever make the control meaningful. It must not render at all.
    expect(screen.queryByRole("group", { name: "Extra images" })).toBeNull()
    expect(screen.queryByRole("group", { name: "Recipe" })).toBeNull()
  })
})
