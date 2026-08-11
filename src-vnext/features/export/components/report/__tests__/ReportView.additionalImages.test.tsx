/// <reference types="@testing-library/jest-dom" />
// WS-C (2026-08-11) — the "Extra images" control (ControlBar), its write path,
// the featureReportConfig gate, and the image-led inert/hidden behavior. The
// recipe-body tests below prove the control's effective value actually
// reaches ProductionSheetReport/BalancedRowsReport (via resolveShowAdditionalImages),
// not just that the control's own state toggles.
import { describe, it, expect, vi } from "vitest"
import { render, screen, within, fireEvent } from "@testing-library/react"
import { ReportView } from "../ReportView"
import { DEFAULT_REPORT_CONFIG, type ReportConfig, type ReportModel } from "../../../lib/report/reportTypes"

// Both gates forced ON so the control renders and production-sheet is the
// resolved layout (DEFAULT_REPORT_CONFIG.layout) unless a test overrides it.
vi.mock("@/shared/lib/flags", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/lib/flags")>()
  return {
    ...actual,
    isFeatureEnabled: (flag: keyof import("@/shared/lib/flags").FeatureFlags) => {
      if (flag === "featureReportConfig") return true
      if (flag === "featureShotReportRecipes") return true
      return actual.isFeatureEnabled(flag)
    },
  }
})

function emptyModel(): ReportModel {
  return {
    project: { name: "Extra images fixture", client: "unbound-merino", shotCount: 0, dateRange: null },
    groups: [],
    order: { sortBy: "shot-number", sortDir: "asc" },
  }
}

function modelWithExtras(): ReportModel {
  return {
    project: { name: "Extra images fixture", client: "unbound-merino", shotCount: 1, dateRange: null },
    groups: [
      {
        key: "all", label: "All shots", count: 1,
        shots: [
          {
            id: "s1", number: "01", title: "Extras Shot", colorway: null, status: "todo",
            gender: "?", notes: null, talent: [], excluded: false, hasImage: false,
            looks: [{ id: "l1", label: "Primary", isAlt: false, image: "cover-cand", hasReference: true, products: [] }],
            additionalImages: ["extra-1"],
          },
        ],
      },
    ],
    order: { sortBy: "shot-number", sortDir: "asc" },
  }
}

const extrasImageMap = new Map([
  ["cover-cand", "cover-src"],
  ["extra-1", "extra-1-src"],
])

function renderReportView(config: ReportConfig, model: ReportModel, onConfigChange: (next: ReportConfig) => void) {
  return render(
    <ReportView
      model={model}
      imageMap={extrasImageMap}
      config={config}
      availableTags={[]}
      onConfigChange={onConfigChange}
      onExportPdf={vi.fn()}
    />,
  )
}

describe("ReportView — Extra images control (WS-C)", () => {
  it("renders an Off/On segmented control next to Looks, defaulting to Off pressed", () => {
    renderReportView(DEFAULT_REPORT_CONFIG, emptyModel(), vi.fn())
    const group = screen.getByRole("group", { name: "Extra images" })
    expect(within(group).getByRole("button", { name: "Off" })).toHaveAttribute("aria-pressed", "true")
    expect(within(group).getByRole("button", { name: "On" })).toHaveAttribute("aria-pressed", "false")
  })

  it("clicking On writes config.showAdditionalImages:true", () => {
    const onConfigChange = vi.fn()
    renderReportView(DEFAULT_REPORT_CONFIG, emptyModel(), onConfigChange)
    const group = screen.getByRole("group", { name: "Extra images" })
    fireEvent.click(within(group).getByRole("button", { name: "On" }))
    expect(onConfigChange).toHaveBeenCalledTimes(1)
    const next = onConfigChange.mock.calls[0]![0] as ReportConfig
    expect(next.showAdditionalImages).toBe(true)
  })

  it("clicking Off from an ON config writes config.showAdditionalImages:false", () => {
    const onConfigChange = vi.fn()
    const config: ReportConfig = { ...DEFAULT_REPORT_CONFIG, showAdditionalImages: true }
    renderReportView(config, emptyModel(), onConfigChange)
    const group = screen.getByRole("group", { name: "Extra images" })
    expect(within(group).getByRole("button", { name: "On" })).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(within(group).getByRole("button", { name: "Off" }))
    const next = onConfigChange.mock.calls[0]![0] as ReportConfig
    expect(next.showAdditionalImages).toBe(false)
  })

  it("re-clicking the already-pressed state is a no-op (no onConfigChange call)", () => {
    const onConfigChange = vi.fn()
    renderReportView(DEFAULT_REPORT_CONFIG, emptyModel(), onConfigChange) // showAdditionalImages: false
    const group = screen.getByRole("group", { name: "Extra images" })
    fireEvent.click(within(group).getByRole("button", { name: "Off" }))
    expect(onConfigChange).not.toHaveBeenCalled()
  })

  it("buttons are disabled/inert on the image-led recipe, with an explanatory title", () => {
    const config: ReportConfig = { ...DEFAULT_REPORT_CONFIG, layout: "image-led" }
    renderReportView(config, emptyModel(), vi.fn())
    const group = screen.getByRole("group", { name: "Extra images" })
    const onBtn = within(group).getByRole("button", { name: "On" })
    expect(onBtn).toBeDisabled()
    expect(onBtn).toHaveAttribute("title", expect.stringMatching(/image-led/i))
  })

  it("buttons stay enabled on production-sheet and balanced-rows", () => {
    const ps: ReportConfig = { ...DEFAULT_REPORT_CONFIG, layout: "production-sheet" }
    const { unmount } = renderReportView(ps, emptyModel(), vi.fn())
    expect(within(screen.getByRole("group", { name: "Extra images" })).getByRole("button", { name: "On" })).not.toBeDisabled()
    unmount()

    const br: ReportConfig = { ...DEFAULT_REPORT_CONFIG, layout: "balanced-rows" }
    renderReportView(br, emptyModel(), vi.fn())
    expect(within(screen.getByRole("group", { name: "Extra images" })).getByRole("button", { name: "On" })).not.toBeDisabled()
  })
})

describe("ReportView — Extra images effective render (resolveShowAdditionalImages end-to-end)", () => {
  it("ON + production-sheet renders the extra-images row on screen", () => {
    const config: ReportConfig = { ...DEFAULT_REPORT_CONFIG, layout: "production-sheet", showAdditionalImages: true }
    const { container } = renderReportView(config, modelWithExtras(), vi.fn())
    expect(container.querySelector(".sb-ps-extra")).not.toBeNull()
  })

  it("OFF renders no extra-images row even though the model shot carries additionalImages", () => {
    const config: ReportConfig = { ...DEFAULT_REPORT_CONFIG, layout: "production-sheet", showAdditionalImages: false }
    const { container } = renderReportView(config, modelWithExtras(), vi.fn())
    expect(container.querySelector(".sb-ps-extra")).toBeNull()
  })

  it("ON + image-led renders NO extra-images row — the v1 exclusion holds even with the raw toggle on", () => {
    const config: ReportConfig = { ...DEFAULT_REPORT_CONFIG, layout: "image-led", showAdditionalImages: true }
    const { container } = renderReportView(config, modelWithExtras(), vi.fn())
    expect(container.querySelector(".sb-ps-extra")).toBeNull()
    expect(container.querySelector(".sb-br-extra")).toBeNull()
  })
})
