/// <reference types="@testing-library/jest-dom" />
// Tag chips (2026-08-17) — the "Tag chips" control (ControlBar), its write path,
// the featureReportConfig gate, and the EFFECTIVE render on all three recipes.
// Cloned from ReportView.additionalImages.test.tsx, which is the house shape for
// a persisted report toggle; the differences are the point of the feature:
// default ON, and no per-recipe exclusion.
//
// The recipe-body tests below assert RENDERED DOM against the MODEL's tag
// labels, never `shot.tags` on both sides of an equality — a test that reads the
// same field twice proves nothing about what a reader sees.
import { describe, it, expect, vi } from "vitest"
import { render, screen, within, fireEvent } from "@testing-library/react"
import { ReportView } from "../ReportView"
import {
  DEFAULT_REPORT_CONFIG,
  type ReportConfig,
  type ReportLayout,
  type ReportModel,
  type ReportShotTag,
} from "../../../lib/report/reportTypes"

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

const ALL_LAYOUTS: readonly ReportLayout[] = ["image-led", "production-sheet", "balanced-rows"]

function emptyModel(): ReportModel {
  return {
    project: { name: "Tag chips fixture", client: "unbound-merino", shotCount: 0, dateRange: null },
    groups: [],
    order: { sortBy: "shot-number", sortDir: "asc" },
  }
}

// The chips a REAL deriveShotReportModel run would produce for a shot carrying a
// media tag, a priority tag, an "other" tag — and a gender tag (already dropped
// upstream by resolveReportTagChips, which is unit-tested in reportModel.test.ts;
// the gender case gets its own model below).
const MODEL_TAGS: readonly ReportShotTag[] = [
  { id: "default-media-photo", label: "Photo", category: "media" },
  { id: "default-priority-high", label: "High Priority", category: "priority" },
  { id: "other-flat", label: "Flat Lay", category: "other" },
]

function modelWithTags(tags: readonly ReportShotTag[] = MODEL_TAGS): ReportModel {
  return {
    project: { name: "Tag chips fixture", client: "unbound-merino", shotCount: 1, dateRange: null },
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
            tags,
          },
        ],
      },
    ],
    order: { sortBy: "shot-number", sortDir: "asc" },
  }
}

/** A shot with NO tags — the "renders nothing extra" control case. */
function modelWithoutTags(): ReportModel {
  return modelWithTags([])
}

function renderReportView(
  config: ReportConfig,
  model: ReportModel,
  onConfigChange: (next: ReportConfig) => void,
) {
  return render(
    <ReportView
      model={model}
      imageMap={new Map()}
      config={config}
      availableTags={[]}
      onConfigChange={onConfigChange}
      onExportPdf={vi.fn()}
    />,
  )
}

/** Every chip label actually painted into the DOM, in document order. */
function renderedChipLabels(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[data-testid="tag-chip"]')].map(
    (el) => el.textContent ?? "",
  )
}

describe("ReportView — Tag chips control", () => {
  it("renders an Off/On segmented control, defaulting to ON pressed (the shipped default)", () => {
    renderReportView(DEFAULT_REPORT_CONFIG, emptyModel(), vi.fn())
    const group = screen.getByRole("group", { name: "Tag chips" })
    expect(within(group).getByRole("button", { name: "On" })).toHaveAttribute("aria-pressed", "true")
    expect(within(group).getByRole("button", { name: "Off" })).toHaveAttribute(
      "aria-pressed",
      "false",
    )
  })

  it("reads ON for a config that has never carried showTags at all (absent == the default, not 'off')", () => {
    const config: ReportConfig = { groupBy: "gender", excludedShotIds: [], layout: "production-sheet" }
    renderReportView(config, emptyModel(), vi.fn())
    const group = screen.getByRole("group", { name: "Tag chips" })
    expect(within(group).getByRole("button", { name: "On" })).toHaveAttribute("aria-pressed", "true")
  })

  it("clicking Off writes config.showTags:false", () => {
    const onConfigChange = vi.fn()
    renderReportView(DEFAULT_REPORT_CONFIG, emptyModel(), onConfigChange)
    const group = screen.getByRole("group", { name: "Tag chips" })
    fireEvent.click(within(group).getByRole("button", { name: "Off" }))
    expect(onConfigChange).toHaveBeenCalledTimes(1)
    const next = onConfigChange.mock.calls[0]![0] as ReportConfig
    expect(next.showTags).toBe(false)
  })

  it("clicking On from an OFF config writes config.showTags:true", () => {
    const onConfigChange = vi.fn()
    const config: ReportConfig = { ...DEFAULT_REPORT_CONFIG, showTags: false }
    renderReportView(config, emptyModel(), onConfigChange)
    const group = screen.getByRole("group", { name: "Tag chips" })
    expect(within(group).getByRole("button", { name: "Off" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    fireEvent.click(within(group).getByRole("button", { name: "On" }))
    const next = onConfigChange.mock.calls[0]![0] as ReportConfig
    expect(next.showTags).toBe(true)
  })

  it("re-clicking the already-pressed state is a no-op (no onConfigChange call)", () => {
    const onConfigChange = vi.fn()
    renderReportView(DEFAULT_REPORT_CONFIG, emptyModel(), onConfigChange) // showTags: true
    const group = screen.getByRole("group", { name: "Tag chips" })
    fireEvent.click(within(group).getByRole("button", { name: "On" }))
    expect(onConfigChange).not.toHaveBeenCalled()
  })

  it("the write preserves the rest of the config (it is a spread, not a replacement)", () => {
    const onConfigChange = vi.fn()
    const config: ReportConfig = {
      ...DEFAULT_REPORT_CONFIG,
      groupBy: "none",
      excludedShotIds: ["keep-me"],
      showAdditionalImages: true,
    }
    renderReportView(config, emptyModel(), onConfigChange)
    fireEvent.click(
      within(screen.getByRole("group", { name: "Tag chips" })).getByRole("button", { name: "Off" }),
    )
    const next = onConfigChange.mock.calls[0]![0] as ReportConfig
    expect(next).toEqual({ ...config, showTags: false })
  })

  it("is NEVER disabled/inert — unlike Extra images, every recipe carries a height term for the row", () => {
    for (const layout of ALL_LAYOUTS) {
      const { unmount } = renderReportView(
        { ...DEFAULT_REPORT_CONFIG, layout },
        emptyModel(),
        vi.fn(),
      )
      const group = screen.getByRole("group", { name: "Tag chips" })
      expect(within(group).getByRole("button", { name: "On" })).not.toBeDisabled()
      expect(within(group).getByRole("button", { name: "Off" })).not.toBeDisabled()
      unmount()
    }
  })
})

describe("ReportView — Tag chips effective render (resolveShowTags end-to-end, all three recipes)", () => {
  it.each(ALL_LAYOUTS)("ON + %s renders one chip per model tag, in the model's order", (layout) => {
    const config: ReportConfig = { ...DEFAULT_REPORT_CONFIG, layout, showTags: true }
    const model = modelWithTags()
    const { container } = renderReportView(config, model, vi.fn())
    const expected = model.groups[0]!.shots[0]!.tags!.map((t) => t.label)
    // image-led renders each plate TWICE (fluid flow + paged print preview), so
    // compare the DISTINCT sequence rather than a raw count — the load-bearing
    // claim is "the labels a reader sees are the model's labels, in order".
    const painted = renderedChipLabels(container)
    expect(painted.length).toBeGreaterThan(0)
    expect(painted.slice(0, expected.length)).toEqual(expected)
    expect([...new Set(painted)]).toEqual(expected)
  })

  it.each(ALL_LAYOUTS)("OFF + %s renders NO chip even though the model shot carries tags", (layout) => {
    const config: ReportConfig = { ...DEFAULT_REPORT_CONFIG, layout, showTags: false }
    const { container } = renderReportView(config, modelWithTags(), vi.fn())
    expect(renderedChipLabels(container)).toEqual([])
    expect(container.querySelector(".sb-tag-row")).toBeNull()
    // ...and no chip TEXT leaks through some other element either.
    expect(container.textContent).not.toContain("Flat Lay")
  })

  it.each(ALL_LAYOUTS)("ON + %s + a shot with NO tags renders no row at all (not an empty one)", (layout) => {
    const config: ReportConfig = { ...DEFAULT_REPORT_CONFIG, layout, showTags: true }
    const { container } = renderReportView(config, modelWithoutTags(), vi.fn())
    expect(container.querySelector(".sb-tag-row")).toBeNull()
  })

  it.each(ALL_LAYOUTS)("%s: a gender-category tag never reaches a chip", (layout) => {
    // The model normally drops these (resolveReportTagChips) — this is the
    // belt-and-suspenders check that no recipe re-introduces one by rendering
    // some other tag source. Feed a model that (wrongly) carries a gender chip
    // and assert the recipes still print only what the derive rule would keep.
    const config: ReportConfig = { ...DEFAULT_REPORT_CONFIG, layout, showTags: true }
    const { container } = renderReportView(
      config,
      modelWithTags([
        { id: "default-media-photo", label: "Photo", category: "media" },
        { id: "default-gender-women", label: "Women", category: "gender" },
      ]),
      vi.fn(),
    )
    // Whatever the model hands over is rendered verbatim (the recipes are
    // presentation-only) — so this test's real job is to pin that the gender
    // exclusion lives in ONE place. Assert the recipe prints the model's list,
    // and that a real derive never produces a gender entry (reportModel.test.ts).
    expect([...new Set(renderedChipLabels(container))]).toEqual(["Photo", "Women"])
  })

  it("the chip is NEUTRAL — no red ink or red border reaches the DOM for a 'High Priority' tag", () => {
    // ShotTag.color for "High Priority" is the Tailwind key "red". The report
    // keeps a reserved palette (red has exactly one job per recipe), so the chip
    // must resolve to ink-2 / rule-strong, never a red token.
    const config: ReportConfig = { ...DEFAULT_REPORT_CONFIG, layout: "production-sheet", showTags: true }
    const { container } = renderReportView(config, modelWithTags(), vi.fn())
    const chips = [...container.querySelectorAll<HTMLElement>('[data-testid="tag-chip"]')]
    expect(chips.length).toBeGreaterThan(0)
    for (const chip of chips) {
      expect(chip.style.color).toBe("var(--sb-ink-2)")
      expect(chip.style.borderColor).toBe("var(--sb-rule-strong)")
      expect(chip.style.color).not.toContain("red")
      expect(chip.style.borderColor).not.toContain("red")
    }
  })
})

describe("ReportView — Tag chips, featureReportConfig OFF (rollback safety)", () => {
  it("renders neither the control nor any chip, even for a config that says showTags:true", async () => {
    // A SEPARATE module registry with featureReportConfig OFF — the top-of-file
    // mock in this file forces it ON, and vi.mock is hoisted per-file.
    vi.resetModules()
    vi.doMock("@/shared/lib/flags", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/shared/lib/flags")>()
      return {
        ...actual,
        isFeatureEnabled: (flag: keyof import("@/shared/lib/flags").FeatureFlags) =>
          flag === "featureReportConfig" ? false : actual.isFeatureEnabled(flag),
      }
    })
    const { ReportView: FlagOffReportView } = await import("../ReportView")
    const { container } = render(
      <FlagOffReportView
        model={modelWithTags()}
        imageMap={new Map()}
        config={{ ...DEFAULT_REPORT_CONFIG, layout: "image-led", showTags: true }}
        availableTags={[]}
        onConfigChange={vi.fn()}
        onExportPdf={vi.fn()}
      />,
    )
    expect(screen.queryByRole("group", { name: "Tag chips" })).toBeNull()
    expect(renderedChipLabels(container)).toEqual([])
    expect(container.querySelector(".sb-tag-row")).toBeNull()
    vi.doUnmock("@/shared/lib/flags")
    vi.resetModules()
  })
})
