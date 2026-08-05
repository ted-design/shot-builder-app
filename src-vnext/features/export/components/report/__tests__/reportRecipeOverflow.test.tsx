// @vitest-environment node
//
// REAL @react-pdf render regression gate for the two shot-report recipes.
// The parity/DOM tests mock @react-pdf, so they CANNOT see physical page
// overflow. This suite renders the actual recipe Documents to a PDF buffer and
// fails if @react-pdf reports the atomic-overflow condition that used to SILENTLY
// CLIP content off a crew pull sheet: "Node of type VIEW can't wrap between pages
// and it's bigger than available page height".
//
// Before the fix each shot was an atomic wrap={false} Row/Band with no height cap,
// so a shot denser than one US-Letter-landscape page dropped its tail with no
// marker. The fix makes the shot splittable (product rows flow; only a single
// ProductRow stays atomic). Re-add wrap={false} to the Row/Band and BOTH cases
// below go red — the property is falsifiable, not decorative.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderToBuffer } from "@react-pdf/renderer"
import { ProductionSheetPdfDocument } from "../../../lib/report/reportPdfProductionSheet"
import { BalancedRowsPdfDocument } from "../../../lib/report/reportPdfBalancedRows"
import type { ReportModel, ReportProduct, ReportShot } from "../../../lib/report/reportTypes"

// @react-pdf emits the overflow condition via console.warn; match either phrasing.
const OVERFLOW = /can't wrap between pages|bigger than available page height/i

function product(i: number): ReportProduct {
  return {
    family: `Heavyweight Brushed Fleece Full-Zip Hoodie ${i}`,
    style: `IMG-9${1000 + i}`,
    colour: "Vintage Sun-Faded Indigo Wash Heather",
    size: "XL",
    sizeScope: "single",
    qty: 2,
    gender: "W",
    isHero: i === 0,
    img: null,
  }
}

// One shot several times taller than a single US-Letter-landscape page (~530pt
// usable): 50 products in the primary look + 2 alt looks + a long note. Sized to
// exceed one page BY A WIDE MARGIN — a marginal fixture that merely fits masks the
// bug (verified: 16–24 products still fit one page, so wrap={false} never fires).
// Realistic shots never reach this; the guard proves the flow-vs-clip behavior.
function overflowModel(): ReportModel {
  const shot: ReportShot = {
    id: "s1",
    number: "01",
    title: "Everything Shot",
    colorway: "Charcoal / Bone",
    status: "on_hold",
    gender: "W",
    notes: "Deliberately long styling note to add height. ".repeat(10),
    talent: [{ id: "t1", name: "Alexandra Whitfield", img: null }],
    excluded: false,
    hasImage: false,
    looks: [
      { id: "l1", label: "Primary", isAlt: false, image: null, hasReference: false, products: Array.from({ length: 50 }, (_, i) => product(i)) },
      { id: "l2", label: "Alt 1", isAlt: true, image: null, hasReference: false, products: Array.from({ length: 6 }, (_, i) => product(100 + i)) },
      { id: "l3", label: "Alt 2", isAlt: true, image: null, hasReference: false, products: Array.from({ length: 6 }, (_, i) => product(200 + i)) },
    ],
  }
  return {
    project: { name: "Overflow Fixture", client: "unbound-merino", shotCount: 1, dateRange: null },
    groups: [{ key: "W", label: "Women", count: 1, shots: [shot] }],
    order: { sortBy: "shot-number", sortDir: "asc" },
  }
}

function overflowWarnings(warn: ReturnType<typeof vi.spyOn>): string[] {
  return warn.mock.calls
    .map((call) => call.map((a) => String(a)).join(" "))
    .filter((line) => OVERFLOW.test(line))
}

describe("recipe PDF overflow — a page-busting shot must FLOW, never silently clip", () => {
  let warn: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {})
  })
  afterEach(() => {
    warn.mockRestore()
  })

  it("production-sheet renders the dense shot with NO can't-wrap warning", async () => {
    const buf = await renderToBuffer(<ProductionSheetPdfDocument model={overflowModel()} imageMap={new Map()} />)
    expect(buf.length).toBeGreaterThan(0)
    expect(overflowWarnings(warn)).toEqual([])
  })

  it("balanced-rows renders the dense shot with NO can't-wrap warning", async () => {
    const buf = await renderToBuffer(<BalancedRowsPdfDocument model={overflowModel()} imageMap={new Map()} />)
    expect(buf.length).toBeGreaterThan(0)
    expect(overflowWarnings(warn)).toEqual([])
  })
})
