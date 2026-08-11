/// <reference types="@testing-library/jest-dom" />
// Coverage for the Filters control's WRITE path (setFieldFilter / setFilterOperator /
// toggleFilterValue) and the tag-option id mapping — previously exercised by NO test:
// the only test that rendered ReportView at all (reportRecipeFlagOffCallSites.test.tsx)
// always passed `availableTags={[]}` and never clicked anything under `showFilters`.
// That left the tag-id defect (report-tag-filter-values-are-canonicalized-tag-ids) and
// the include/exclude default-operator rules completely unfalsifiable.
import { describe, it, expect, vi } from "vitest"
import { render, screen, within, fireEvent } from "@testing-library/react"
import { ReportView, type ReportTagOption } from "../ReportView"
import { DEFAULT_REPORT_CONFIG, type ReportConfig, type ReportModel } from "../../../lib/report/reportTypes"

// featureReportConfig gates showFilters/showSort — forced ON so the Filters
// control actually renders. featureShotReportRecipes is deliberately left at
// its real (OFF) test default: resolveReportLayout then clamps the layout to
// "image-led" regardless of DEFAULT_REPORT_CONFIG.layout ("production-sheet"),
// the same known-safe empty-model render path reportRecipeFlagOffCallSites.test.tsx
// already exercises — these tests are about the Filters control, not the recipe body.
vi.mock("@/shared/lib/flags", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/lib/flags")>()
  return {
    ...actual,
    isFeatureEnabled: (flag: keyof import("@/shared/lib/flags").FeatureFlags) =>
      flag === "featureReportConfig" ? true : actual.isFeatureEnabled(flag),
  }
})

function emptyModel(): ReportModel {
  return {
    project: { name: "Filters fixture", client: "unbound-merino", shotCount: 0, dateRange: null },
    groups: [],
    order: { sortBy: "shot-number", sortDir: "asc" },
  }
}

function renderReportView(
  config: ReportConfig,
  availableTags: readonly ReportTagOption[],
  onConfigChange: (next: ReportConfig) => void,
) {
  return render(
    <ReportView
      model={emptyModel()}
      imageMap={new Map()}
      config={config}
      availableTags={availableTags}
      onConfigChange={onConfigChange}
      onExportPdf={vi.fn()}
    />,
  )
}

// Canonical shot-status vocabulary (statusMappings.ts, via REPORT_STATUS_LABEL):
// complete -> "Shot", todo -> "Draft", in_progress -> "In Progress", on_hold -> "On Hold".

describe("ReportView Filters control — Tags options are sourced from computeUsedTagOptions, not computeAvailableTags", () => {
  it("offers exactly the ids passed in `availableTags` — a custom (non-default) tag renders as its OWN option", () => {
    // 'Hero' is not a DEFAULT_TAGS label — this is exactly the id a real
    // shot.tags[].id would carry, and exactly what filterEngine matches on.
    const tags: ReportTagOption[] = [{ id: "cust-1", label: "Hero" }]
    renderReportView(DEFAULT_REPORT_CONFIG, tags, vi.fn())
    expect(screen.getByRole("button", { name: "Hero" })).toBeInTheDocument()
  })

  it("a project with NO tags in use offers ZERO tag options — never the 8 unused DEFAULT_TAGS", () => {
    renderReportView(DEFAULT_REPORT_CONFIG, [], vi.fn())
    const tagsValues = screen.getByRole("group", { name: "Tags" })
    expect(within(tagsValues).getByText("None yet")).toBeInTheDocument()
    expect(within(tagsValues).queryAllByRole("button")).toHaveLength(0)
  })

  it("two DIFFERENT ids sharing a label both render as separate, independently selectable options", () => {
    // computeAvailableTags would collapse these to ONE option (label-keyed);
    // computeUsedTagOptions (id-keyed) must keep both, matching the shot
    // list's own tag filter — otherwise one of the two shots carrying
    // "Hero" can never be matched by the report's filter at all.
    const tags: ReportTagOption[] = [
      { id: "cust-1", label: "Hero" },
      { id: "cust-2", label: "Hero" },
    ]
    renderReportView(DEFAULT_REPORT_CONFIG, tags, vi.fn())
    const buttons = screen.getAllByRole("button", { name: "Hero" })
    expect(buttons).toHaveLength(2)
  })
})

describe("ReportView Filters control — write path", () => {
  it("toggling a Status value writes filters + clears hiddenStatuses, defaulting to Exclude on first touch", () => {
    const onConfigChange = vi.fn()
    renderReportView(DEFAULT_REPORT_CONFIG, [], onConfigChange)
    const statusValues = screen.getByRole("group", { name: "Status" })
    fireEvent.click(within(statusValues).getByRole("button", { name: "Shot" }))
    expect(onConfigChange).toHaveBeenCalledTimes(1)
    const next = onConfigChange.mock.calls[0]![0] as ReportConfig
    expect(next.filters).toEqual([{ id: "status", field: "status", operator: "notIn", value: ["complete"] }])
    expect(next.hiddenStatuses).toEqual([])
  })

  it("toggling a Tag value defaults to Include on first touch (the opposite default from Status)", () => {
    const onConfigChange = vi.fn()
    const tags: ReportTagOption[] = [{ id: "default-media-photo", label: "Photo" }]
    renderReportView(DEFAULT_REPORT_CONFIG, tags, onConfigChange)
    fireEvent.click(screen.getByRole("button", { name: "Photo" }))
    const next = onConfigChange.mock.calls[0]![0] as ReportConfig
    expect(next.filters).toEqual([{ id: "tag", field: "tag", operator: "in", value: ["default-media-photo"] }])
  })

  it("a second value toggle for the same field ADDS to the existing selection, not replaces it", () => {
    const onConfigChange = vi.fn()
    const config: ReportConfig = {
      ...DEFAULT_REPORT_CONFIG,
      filters: [{ id: "status", field: "status", operator: "notIn", value: ["complete"] }],
    }
    renderReportView(config, [], onConfigChange)
    const statusValues = screen.getByRole("group", { name: "Status" })
    fireEvent.click(within(statusValues).getByRole("button", { name: "Draft" }))
    const next = onConfigChange.mock.calls[0]![0] as ReportConfig
    expect(next.filters).toEqual([
      { id: "status", field: "status", operator: "notIn", value: ["complete", "todo"] },
    ])
  })

  it("re-clicking an already-selected value REMOVES it", () => {
    const onConfigChange = vi.fn()
    const config: ReportConfig = {
      ...DEFAULT_REPORT_CONFIG,
      filters: [{ id: "status", field: "status", operator: "notIn", value: ["complete", "todo"] }],
    }
    renderReportView(config, [], onConfigChange)
    const statusValues = screen.getByRole("group", { name: "Status" })
    fireEvent.click(within(statusValues).getByRole("button", { name: "Shot" }))
    const next = onConfigChange.mock.calls[0]![0] as ReportConfig
    expect(next.filters).toEqual([{ id: "status", field: "status", operator: "notIn", value: ["todo"] }])
  })

  it("switching the Status mode to Include changes the operator on the EXISTING selection", () => {
    const onConfigChange = vi.fn()
    const config: ReportConfig = {
      ...DEFAULT_REPORT_CONFIG,
      filters: [{ id: "status", field: "status", operator: "notIn", value: ["complete"] }],
    }
    renderReportView(config, [], onConfigChange)
    const statusMode = screen.getByRole("group", { name: "Status mode" })
    fireEvent.click(within(statusMode).getByRole("button", { name: "Include" }))
    const next = onConfigChange.mock.calls[0]![0] as ReportConfig
    expect(next.filters).toEqual([{ id: "status", field: "status", operator: "in", value: ["complete"] }])
  })
})
