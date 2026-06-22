import { describe, it, expect } from "vitest"
import { render } from "@testing-library/react"
import { ProductionSheetReport } from "../ProductionSheetReport"
import { BalancedRowsReport } from "../BalancedRowsReport"
import type { ReportModel } from "../../../lib/report/reportTypes"

// Smoke + behavior tests for the two R3 layout variants: they render without
// throwing, use the canonical status labels (statusMappings.ts), and count only
// printable (non-excluded) shots in the masthead.
function model(): ReportModel {
  return {
    project: { name: "Q2-26 No. 3", client: "unbound-merino", shotCount: 3, dateRange: "Jun 2–6, 2026" },
    groups: [
      {
        key: "W", label: "Women", count: 2,
        shots: [
          {
            id: "s1", number: "01", title: "Trail Crew", colorway: "Black", status: "complete",
            gender: "W", notes: null, talent: [{ id: "t1", name: "Model A", img: null }],
            excluded: false, hasImage: false,
            looks: [{ id: "l1", label: "Primary", isAlt: false, image: null, products: [
              { family: "Crew", style: "W-TP-1399", colour: "Black", size: "S", sizeScope: "single", qty: 1, gender: "W", isHero: true, img: null },
            ] }],
          },
          {
            id: "s2", number: "02", title: "Excluded one", colorway: null, status: "todo",
            gender: "W", notes: null, talent: [], excluded: true, hasImage: false,
            looks: [{ id: "l2", label: "Primary", isAlt: false, image: null, products: [] }],
          },
        ],
      },
      {
        key: "?", label: "Unresolved", count: 1,
        shots: [
          {
            id: "s3", number: "03", title: "On hold one", colorway: null, status: "on_hold",
            gender: "?", notes: "Pending wardrobe.", talent: [], excluded: false, hasImage: false,
            looks: [{ id: "l3", label: "Primary", isAlt: false, image: null, products: [
              { family: "Pant", style: null, colour: null, size: null, sizeScope: "pending", qty: 2, gender: "?", isHero: true, img: null },
            ] }],
          },
        ],
      },
    ],
  }
}

const noop = () => {}

describe("ProductionSheetReport (comp-b)", () => {
  it("renders, uses canonical labels, counts printable shots", () => {
    const { container, getAllByText } = render(
      <ProductionSheetReport model={model()} imageMap={new Map()} onToggleExclude={noop} />,
    )
    // canonical status label (was "On hold" pre-fix)
    expect(getAllByText("On Hold").length).toBeGreaterThan(0)
    // on-hold flag spine
    expect(getAllByText("Hold").length).toBeGreaterThan(0)
    // masthead "Shots" = 2 printable (excludes s2), not 3
    expect(container.querySelector(".sb-ps-meta-num")?.textContent).toBe("2")
    expect(getAllByText("Trail Crew").length).toBeGreaterThan(0)
  })
})

describe("BalancedRowsReport (comp-c)", () => {
  it("renders, shows the hero marker, counts printable shots", () => {
    const { container, getAllByText } = render(
      <BalancedRowsReport model={model()} imageMap={new Map()} onToggleExclude={noop} />,
    )
    expect(getAllByText("HERO").length).toBeGreaterThan(0)
    // first fact value ("Shots") = 2 printable
    expect(container.querySelector(".sb-br-fact-v")?.textContent).toBe("2")
    expect(getAllByText("Trail Crew").length).toBeGreaterThan(0)
  })
})
