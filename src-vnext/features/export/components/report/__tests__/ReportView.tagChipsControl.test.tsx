/// <reference types="@testing-library/jest-dom" />
// Tag chips (2026-08-17), the flag combination its sibling file cannot express:
// featureReportConfig ON, featureShotReportRecipes OFF. Separate file because
// vi.mock is hoisted per-file, so a different flag pair needs a different file —
// same reason ReportView.additionalImagesControl.test.tsx exists.
//
// This is the DIFFERENCE between the two toggles, asserted rather than assumed.
// With recipes off, resolveReportLayout pins the layout to "image-led"
// permanently and the Recipe picker is hidden. For "Extra images" that is a dead
// end (image-led has no extras row), so that control hides itself entirely. For
// Tag chips it is NOT a dead end: image-led renders the row and carries its own
// height term (reportPdfHeights' estimateTagRowHeight), so the control must stay
// visible AND the chips must actually print.
import { describe, it, expect, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { ReportView } from "../ReportView"
import {
  DEFAULT_REPORT_CONFIG,
  type ReportConfig,
  type ReportModel,
} from "../../../lib/report/reportTypes"

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

function taggedModel(): ReportModel {
  return {
    project: { name: "Tag chips control fixture", client: "unbound-merino", shotCount: 1, dateRange: null },
    groups: [
      {
        key: "all",
        label: "All shots",
        count: 1,
        shots: [
          {
            id: "s1",
            number: "01",
            title: "Tagged Shot",
            colorway: null,
            status: "todo",
            gender: "W",
            notes: null,
            talent: [],
            excluded: false,
            hasImage: false,
            looks: [
              { id: "l1", label: "Primary", isAlt: false, image: null, hasReference: false, products: [] },
            ],
            tags: [
              { id: "default-media-photo", label: "Photo", category: "media" },
              { id: "other-flat", label: "Flat Lay", category: "other" },
            ],
          },
        ],
      },
    ],
    order: { sortBy: "shot-number", sortDir: "asc" },
  }
}

function renderWith(config: ReportConfig) {
  return render(
    <ReportView
      model={taggedModel()}
      imageMap={new Map()}
      config={config}
      availableTags={[]}
      onConfigChange={vi.fn()}
      onExportPdf={vi.fn()}
    />,
  )
}

describe("ReportView — Tag chips control, recipes flag OFF (NOT a dead end, unlike Extra images)", () => {
  it("stays visible and live, while the Extra images control hides itself and the Recipe picker is gone", () => {
    const { container } = renderWith({ ...DEFAULT_REPORT_CONFIG, layout: "production-sheet" })
    // Baseline: the flag really is off — layout is clamped and both the Recipe
    // picker and the extras control are absent. Without these two assertions the
    // Tag-chips claim below would be untethered from the flag state.
    expect(container.querySelector(".sb-report-root")?.getAttribute("data-layout")).toBe("image-led")
    expect(screen.queryByRole("group", { name: "Recipe" })).toBeNull()
    expect(screen.queryByRole("group", { name: "Extra images" })).toBeNull()

    const group = screen.getByRole("group", { name: "Tag chips" })
    expect(within(group).getByRole("button", { name: "On" })).not.toBeDisabled()
    expect(within(group).getByRole("button", { name: "On" })).toHaveAttribute("aria-pressed", "true")
  })

  it("image-led actually PRINTS the chips with recipes off — the case that makes the control worth showing", () => {
    const { container } = renderWith({ ...DEFAULT_REPORT_CONFIG, layout: "production-sheet" })
    expect(container.querySelector(".sb-report-root")?.getAttribute("data-layout")).toBe("image-led")
    const labels = [
      ...new Set(
        [...container.querySelectorAll('[data-testid="tag-chip"]')].map((el) => el.textContent ?? ""),
      ),
    ]
    expect(labels).toEqual(["Photo", "Flat Lay"])
  })

  it("Off still hides them on image-led", () => {
    const { container } = renderWith({ ...DEFAULT_REPORT_CONFIG, showTags: false })
    expect(container.querySelectorAll('[data-testid="tag-chip"]')).toHaveLength(0)
    expect(container.querySelector(".sb-tag-row")).toBeNull()
  })
})
