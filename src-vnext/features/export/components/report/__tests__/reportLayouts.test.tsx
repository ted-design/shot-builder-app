import { describe, it, expect } from "vitest"
import { render } from "@testing-library/react"
import { ProductionSheetReport, extraImagesWeight as psExtraImagesWeight } from "../ProductionSheetReport"
import { BalancedRowsReport, extraImagesWeight as brExtraImagesWeight } from "../BalancedRowsReport"
import type { ReportModel, ReportShot } from "../../../lib/report/reportTypes"

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
            looks: [{ id: "l1", label: "Primary", isAlt: false, image: null, hasReference: false, products: [
              { family: "Crew", style: "W-TP-1399", colour: "Black", size: "S", sizeScope: "single", qty: 1, gender: "W", isHero: true, img: null },
            ] }],
          },
          {
            id: "s2", number: "02", title: "Excluded one", colorway: null, status: "todo",
            gender: "W", notes: null, talent: [], excluded: true, hasImage: false,
            looks: [{ id: "l2", label: "Primary", isAlt: false, image: null, hasReference: false, products: [] }],
          },
        ],
      },
      {
        key: "?", label: "Unresolved", count: 1,
        shots: [
          {
            id: "s3", number: "03", title: "On hold one", colorway: null, status: "on_hold",
            gender: "?", notes: "Pending wardrobe.", talent: [], excluded: false, hasImage: false,
            looks: [{ id: "l3", label: "Primary", isAlt: false, image: null, hasReference: false, products: [
              { family: "Pant", style: null, colour: null, size: null, sizeScope: "pending", qty: 2, gender: "?", isHero: true, img: null },
            ] }],
          },
        ],
      },
    ],
    order: { sortBy: "shot-number", sortDir: "asc" },
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

  it("renders the honest, config-driven order note — never a hardcoded 'shot no.' claim", () => {
    const talentSorted: ReportModel = { ...model(), order: { sortBy: "talent", sortDir: "desc" } }
    const { getAllByText, queryByText } = render(
      <BalancedRowsReport model={talentSorted} imageMap={new Map()} onToggleExclude={noop} />,
    )
    // caption reflects the ACTUAL applied order (model.order), so it can't lie
    expect(getAllByText("Sorted by talent, descending").length).toBeGreaterThan(0)
    expect(queryByText(/sorted by shot/i)).toBeNull()
  })
})

// WS-C additional-images row (2026-08-11): default OFF renders byte-identical
// to pre-WS-C output; ON renders exactly the resolved (deduped) extras.
function modelWithExtras(): ReportModel {
  return {
    project: { name: "P", client: "c", shotCount: 1, dateRange: null },
    groups: [
      {
        key: "all", label: "All shots", count: 1,
        shots: [
          {
            id: "s1", number: "01", title: "Extras Shot", colorway: null, status: "todo",
            gender: "?", notes: null, talent: [], excluded: false, hasImage: false,
            looks: [{ id: "l1", label: "Primary", isAlt: false, image: "cover-cand", hasReference: true, products: [] }],
            additionalImages: ["extra-1", "extra-2"],
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
  ["extra-2", "extra-2-src"],
])

describe("ProductionSheetReport — additional-images row (WS-C)", () => {
  it("showAdditionalImages absent renders no extra row at all — byte-identical to pre-WS-C output", () => {
    const { container } = render(
      <ProductionSheetReport model={modelWithExtras()} imageMap={extrasImageMap} onToggleExclude={noop} />,
    )
    expect(container.querySelector(".sb-ps-extra")).toBeNull()
  })

  it("showAdditionalImages:false renders no extra row, even though the shot has additionalImages", () => {
    const { container } = render(
      <ProductionSheetReport
        model={modelWithExtras()}
        imageMap={extrasImageMap}
        onToggleExclude={noop}
        showAdditionalImages={false}
      />,
    )
    expect(container.querySelector(".sb-ps-extra")).toBeNull()
  })

  it("showAdditionalImages:true renders exactly the shot's resolved additionalImages srcs, never the cover", () => {
    const { container } = render(
      <ProductionSheetReport
        model={modelWithExtras()}
        imageMap={extrasImageMap}
        onToggleExclude={noop}
        showAdditionalImages={true}
      />,
    )
    // The recipe always renders BOTH a fluid (screen) copy and a paged (print
    // preview) copy — scope to the fluid one so the assertion isn't doubled.
    const fluid = container.querySelector(".sb-ps-fluid")!
    const imgs = [...fluid.querySelectorAll(".sb-ps-extra-thumb img")].map((img) => img.getAttribute("src"))
    expect(imgs).toEqual(["extra-1-src", "extra-2-src"])
    expect(imgs).not.toContain("cover-src")
  })

  it("a shot with no additionalImages renders no extra row even when the toggle is on", () => {
    const bare: ReportModel = {
      ...modelWithExtras(),
      groups: [{ ...modelWithExtras().groups[0]!, shots: [{ ...modelWithExtras().groups[0]!.shots[0]!, additionalImages: [] }] }],
    }
    const { container } = render(
      <ProductionSheetReport model={bare} imageMap={extrasImageMap} onToggleExclude={noop} showAdditionalImages={true} />,
    )
    expect(container.querySelector(".sb-ps-extra")).toBeNull()
  })
})

describe("BalancedRowsReport — additional-images row (WS-C)", () => {
  it("showAdditionalImages absent renders no extra row at all — byte-identical to pre-WS-C output", () => {
    const { container } = render(
      <BalancedRowsReport model={modelWithExtras()} imageMap={extrasImageMap} onToggleExclude={noop} />,
    )
    expect(container.querySelector(".sb-br-extra")).toBeNull()
  })

  it("showAdditionalImages:true renders exactly the shot's resolved additionalImages srcs, never the cover", () => {
    const { container } = render(
      <BalancedRowsReport
        model={modelWithExtras()}
        imageMap={extrasImageMap}
        onToggleExclude={noop}
        showAdditionalImages={true}
      />,
    )
    // The recipe always renders BOTH a fluid (screen) copy and a paged (print
    // preview) copy — scope to the fluid one so the assertion isn't doubled.
    const fluid = container.querySelector(".sb-br-fluid")!
    const imgs = [...fluid.querySelectorAll(".sb-br-extra-thumb img")].map((img) => img.getAttribute("src"))
    expect(imgs).toEqual(["extra-1-src", "extra-2-src"])
    expect(imgs).not.toContain("cover-src")
  })
})

// Print-preview pagination weight for the additional-images row — regression
// coverage for the confirmed bug: the row's per-shot weight bump used to be a
// FLAT constant regardless of thumb count (+0.5 production-sheet, +0.4
// balanced-rows), even though one line of thumbs already costs several times
// that in real CSS height (reportStyles.ts). Because `.sb-ps-page` is a fixed
// height `overflow: hidden` sheet, under-charging silently CLIPS the row off
// the bottom of a page with no marker. extraImagesWeight must SCALE with the
// thumb count, not just its presence.
describe("ProductionSheetReport — extraImagesWeight scales with thumb count (print-preview pagination)", () => {
  it("returns 0 for no thumbs", () => {
    expect(psExtraImagesWeight(0)).toBe(0)
  })

  it("one line's worth of thumbs (<= EXTRA_THUMBS_PER_LINE) costs LESS than two lines' worth", () => {
    const oneLine = psExtraImagesWeight(5)
    const twoLines = psExtraImagesWeight(20) // > 15/line -> wraps to a 2nd line
    expect(twoLines).toBeGreaterThan(oneLine)
  })

  it("weight grows monotonically with thumb count — never flat past the old +0.5 constant", () => {
    const w10 = psExtraImagesWeight(10)
    const w30 = psExtraImagesWeight(30)
    const w60 = psExtraImagesWeight(60)
    expect(w30).toBeGreaterThan(w10)
    expect(w60).toBeGreaterThan(w30)
    // The bug this guards: the OLD code charged exactly 0.5 for ANY count > 0.
    // A fixture past a couple of wrapped lines must clear that flat figure by
    // a wide margin, not merely exceed it by a rounding error.
    expect(w60).toBeGreaterThan(0.5 * 3)
  })
})

describe("BalancedRowsReport — extraImagesWeight scales with thumb count (print-preview pagination)", () => {
  it("returns 0 for no thumbs", () => {
    expect(brExtraImagesWeight(0)).toBe(0)
  })

  it("weight grows monotonically with thumb count — never flat past the old +0.4 constant", () => {
    const w6 = brExtraImagesWeight(6)
    const w18 = brExtraImagesWeight(18)
    const w36 = brExtraImagesWeight(36)
    expect(w18).toBeGreaterThan(w6)
    expect(w36).toBeGreaterThan(w18)
    expect(w36).toBeGreaterThan(0.4 * 3)
  })
})

// End-to-end (DOM) regression: MORE additionalImages must be able to push a
// shot onto a LATER print-preview page than FEWER — the true observable
// consequence of the flat-weight bug. Mutate extraImagesWeight back to a flat
// return value and this pair goes from "different page counts" to "same page
// count" (verified manually while fixing — see the PR).
function extrasShot(id: string, count: number): ReportShot {
  return {
    id,
    number: id,
    title: `Shot ${id}`,
    colorway: null,
    status: "todo",
    gender: "?",
    notes: null,
    talent: [],
    excluded: false,
    hasImage: false,
    looks: [{ id: `${id}-l0`, label: "Primary", isAlt: false, image: null, hasReference: false, products: [] }],
    additionalImages: Array.from({ length: count }, (_, i) => `${id}-extra-${i}`),
  }
}

function manyExtrasModel(shotCount: number, imagesPerShot: number): ReportModel {
  const shots = Array.from({ length: shotCount }, (_, i) => extrasShot(`s${i}`, imagesPerShot))
  return {
    project: { name: "Pagination stress", client: "c", shotCount: shots.length, dateRange: null },
    groups: [{ key: "all", label: "All shots", count: shots.length, shots }],
    order: { sortBy: "shot-number", sortDir: "asc" },
  }
}

function extrasImageMapFor(shotCount: number, imagesPerShot: number): Map<string, string> {
  const m = new Map<string, string>()
  for (let s = 0; s < shotCount; s++) {
    for (let i = 0; i < imagesPerShot; i++) m.set(`s${s}-extra-${i}`, `s${s}-extra-${i}-src`)
  }
  return m
}

describe("ProductionSheetReport — print-preview page count grows with additionalImages count", () => {
  it("3 shots x 50 additional-images references paginate onto MORE pages than 3 shots x 2 references", () => {
    const few = manyExtrasModel(3, 2)
    const many = manyExtrasModel(3, 50)
    const { container: fewContainer } = render(
      <ProductionSheetReport model={few} imageMap={extrasImageMapFor(3, 2)} onToggleExclude={noop} showAdditionalImages={true} />,
    )
    const { container: manyContainer } = render(
      <ProductionSheetReport model={many} imageMap={extrasImageMapFor(3, 50)} onToggleExclude={noop} showAdditionalImages={true} />,
    )
    const fewPages = fewContainer.querySelectorAll(".sb-ps-page").length
    const manyPages = manyContainer.querySelectorAll(".sb-ps-page").length
    expect(manyPages).toBeGreaterThan(fewPages)
  })
})

describe("BalancedRowsReport — print-preview page count grows with additionalImages count", () => {
  it("2 shots x 20 additional-images references paginate onto MORE pages than 2 shots x 2 references", () => {
    const few = manyExtrasModel(2, 2)
    const many = manyExtrasModel(2, 20)
    const { container: fewContainer } = render(
      <BalancedRowsReport model={few} imageMap={extrasImageMapFor(2, 2)} onToggleExclude={noop} showAdditionalImages={true} />,
    )
    const { container: manyContainer } = render(
      <BalancedRowsReport model={many} imageMap={extrasImageMapFor(2, 20)} onToggleExclude={noop} showAdditionalImages={true} />,
    )
    const fewPages = fewContainer.querySelectorAll(".sb-br-page").length
    const manyPages = manyContainer.querySelectorAll(".sb-br-page").length
    expect(manyPages).toBeGreaterThan(fewPages)
  })
})
