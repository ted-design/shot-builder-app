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

/** Rough page count from the raw PDF bytes: counts `/Type /Page` object dicts
 *  (the `(?!s)` guard excludes `/Type /Pages`, the page-TREE node). Not a
 *  general PDF parser — good enough to sanity-check "not zero, not runaway"
 *  against a real @react-pdf render, same spirit as reportRecipeStyleTokenSpacing.test.tsx's
 *  content-stream text extractor. */
function countPdfPages(buf: Buffer): number {
  const raw = buf.toString("latin1")
  const matches = raw.match(/\/Type\s*\/Page(?!s)/g)
  return matches ? matches.length : 0
}

/** Rough count of embedded IMAGE XObjects from the raw PDF bytes (`/Subtype
 *  /Image` object dicts). A page-count comparison can't distinguish
 *  "AdditionalImagesRow never invoked" from "invoked and returned null" from
 *  "invoked, rendered, but the extra content didn't cross a page boundary" —
 *  all three produce identical page counts. This CAN distinguish the first
 *  two from the third: overflowModel()'s fixture carries zero images anywhere
 *  (every look/product/talent `image`/`img` is null), so a real @react-pdf
 *  render of it embeds zero Image XObjects — any non-zero count means
 *  SOMETHING drew an image that shouldn't have. */
function countPdfImageXObjects(buf: Buffer): number {
  const raw = buf.toString("latin1")
  const matches = raw.match(/\/Subtype\s*\/Image/g)
  return matches ? matches.length : 0
}

// 1x1 transparent PNG — a real, valid image payload (not a garbage base64
// string), matching the shape resolveReportImages/resolvePdfImageSrc actually
// hand the renderer (a "data:" URL, resolved once and cached). @react-pdf/image
// reads a data: URL directly (no fetch), so this works under @vitest-environment node.
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="

// WS-C (2026-08-11): the SAME "Everything Shot" as overflowModel() above, plus
// 10 additional-images references — the realistic shape the spec asks for
// ("50-product look PLUS 10 references with showAdditionalImages on"). The
// shot is already several pages tall from the 50 products alone; this proves
// the NEW row doesn't reintroduce a clip when composed with the existing
// overflow behavior.
const EXTRA_IMAGE_IDS = Array.from({ length: 10 }, (_, i) => `extra-${String(i)}`)
const EXTRA_IMAGE_MAP = new Map(EXTRA_IMAGE_IDS.map((id) => [id, TINY_PNG] as const))

function overflowModelWithAdditionalImages(): ReportModel {
  const base = overflowModel()
  const shot: ReportShot = { ...base.groups[0]!.shots[0]!, additionalImages: EXTRA_IMAGE_IDS }
  return { ...base, groups: [{ ...base.groups[0]!, shots: [shot] }] }
}

// Stress fixture ISOLATING the additional-images row: a near-empty shot (one
// product, no notes, no alt looks) whose ONLY source of height is a large
// additionalImages row. At 400 thumbs this wraps to roughly 2.5–7x a single
// page's usable height on BOTH recipes (production-sheet: ~14/line, 40x48pt
// boxes; balanced-rows: ~6/line, 70x50pt boxes — see the derivation in the PR
// description). Proves the row itself FLOWS across pages under real code
// (zero warnings) — sized well past threshold so a fixture that merely fits
// can't mask a regression (testing-discipline: "size 2-3x past threshold").
const STRESS_IMAGE_COUNT = 400
const STRESS_IMAGE_IDS = Array.from({ length: STRESS_IMAGE_COUNT }, (_, i) => `stress-${String(i)}`)
const STRESS_IMAGE_MAP = new Map(STRESS_IMAGE_IDS.map((id) => [id, TINY_PNG] as const))

function additionalImagesStressModel(): ReportModel {
  const shot: ReportShot = {
    id: "s1",
    number: "01",
    title: "Extras-Only Shot",
    colorway: null,
    status: "todo",
    gender: "W",
    notes: null,
    talent: [],
    excluded: false,
    hasImage: false,
    looks: [{ id: "l1", label: "Primary", isAlt: false, image: null, hasReference: false, products: [product(0)] }],
    additionalImages: STRESS_IMAGE_IDS,
  }
  return {
    project: { name: "Additional-Images Stress Fixture", client: "unbound-merino", shotCount: 1, dateRange: null },
    groups: [{ key: "W", label: "Women", count: 1, shots: [shot] }],
    order: { sortBy: "shot-number", sortDir: "asc" },
  }
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

// ---------------------------------------------------------------------------
// WS-C (2026-08-11) — the additional-images row must be as flow-friendly as
// the rest of the shot block. No new wrap={false} anywhere in AdditionalImagesRow
// or its container (both PDF recipes) — mutation-verified below (manual,
// documented in the PR description): temporarily re-adding wrap={false} to the
// row's outer View in reportPdfProductionSheet.tsx / reportPdfBalancedRows.tsx
// reddens BOTH "stress" cases here (the row alone then exceeds a page's usable
// height), reverted after confirming.
// ---------------------------------------------------------------------------
describe("recipe PDF overflow — additional-images row (WS-C) must FLOW, never silently clip", () => {
  let warn: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {})
  })
  afterEach(() => {
    warn.mockRestore()
  })

  it("production-sheet: 50-product shot + 10 references, showAdditionalImages ON — zero can't-wrap warnings, sane page count", async () => {
    const buf = await renderToBuffer(
      <ProductionSheetPdfDocument
        model={overflowModelWithAdditionalImages()}
        imageMap={EXTRA_IMAGE_MAP}
        showAdditionalImages={true}
      />,
    )
    expect(buf.length).toBeGreaterThan(0)
    expect(overflowWarnings(warn)).toEqual([])
    const pages = countPdfPages(buf)
    // MEASURED against the real @react-pdf render (not the "temporary stderr
    // probe, since removed" the PR description cited — this bound IS the
    // reproducible measurement, committed): 3 pages, matching the PR's own
    // claimed "production-sheet 3pp" figure. A loose (0, 20) bound can't fail
    // for almost any mutation of the additional-images row (wrong thumb size,
    // row rendered twice, row dropped, toggle ignored); this tight a window
    // around the measured value can. Small tolerance (2-5) for incidental
    // spacing/font changes elsewhere in the recipe that aren't this row's concern.
    expect(pages).toBeGreaterThanOrEqual(2)
    expect(pages).toBeLessThanOrEqual(5)
  })

  it("balanced-rows: 50-product shot + 10 references, showAdditionalImages ON — zero can't-wrap warnings, sane page count", async () => {
    const buf = await renderToBuffer(
      <BalancedRowsPdfDocument
        model={overflowModelWithAdditionalImages()}
        imageMap={EXTRA_IMAGE_MAP}
        showAdditionalImages={true}
      />,
    )
    expect(buf.length).toBeGreaterThan(0)
    expect(overflowWarnings(warn)).toEqual([])
    const pages = countPdfPages(buf)
    // MEASURED: 4 pages, matching the PR's own claimed "balanced-rows 4pp"
    // figure — see the production-sheet case above for why a tight, pinned
    // window (not the prior (0, 20) bound) is the falsifiable version of this check.
    expect(pages).toBeGreaterThanOrEqual(3)
    expect(pages).toBeLessThanOrEqual(6)
  })

  it("production-sheet: additional-images row ALONE (400 thumbs, well past one page) still FLOWS — zero can't-wrap warnings", async () => {
    const buf = await renderToBuffer(
      <ProductionSheetPdfDocument
        model={additionalImagesStressModel()}
        imageMap={STRESS_IMAGE_MAP}
        showAdditionalImages={true}
      />,
    )
    expect(buf.length).toBeGreaterThan(0)
    expect(overflowWarnings(warn)).toEqual([])
    expect(countPdfPages(buf)).toBeGreaterThan(1) // genuinely spans multiple pages
  })

  it("balanced-rows: additional-images row ALONE (400 thumbs, well past one page) still FLOWS — zero can't-wrap warnings", async () => {
    const buf = await renderToBuffer(
      <BalancedRowsPdfDocument
        model={additionalImagesStressModel()}
        imageMap={STRESS_IMAGE_MAP}
        showAdditionalImages={true}
      />,
    )
    expect(buf.length).toBeGreaterThan(0)
    expect(overflowWarnings(warn)).toEqual([])
    expect(countPdfPages(buf)).toBeGreaterThan(1)
  })

  it("showAdditionalImages OFF (default) renders the IDENTICAL page count whether or not the model carries additionalImages — AdditionalImagesRow is never invoked, not merely invoked-and-empty", async () => {
    const withoutField = await renderToBuffer(<ProductionSheetPdfDocument model={overflowModel()} imageMap={new Map()} />)
    const withFieldButOff = await renderToBuffer(
      <ProductionSheetPdfDocument model={overflowModelWithAdditionalImages()} imageMap={EXTRA_IMAGE_MAP} />,
    )
    expect(countPdfPages(withFieldButOff)).toBe(countPdfPages(withoutField))
    expect(overflowWarnings(warn)).toEqual([])
    // Page count alone can't tell "never invoked" apart from "invoked and
    // returned null" apart from "invoked, rendered, but the extra content
    // didn't cross a page boundary" — all three produce identical page
    // counts on this dense (already multi-page) fixture. This is the
    // sharper, falsifiable version: overflowModel()'s shot carries ZERO
    // images anywhere (every look/product/talent image candidate is null —
    // see the fixture above), so a real render of it embeds zero Image
    // XObjects. If AdditionalImagesRow rendered despite the toggle being
    // off, its thumbs (drawn from EXTRA_IMAGE_MAP's real TINY_PNG payloads)
    // would show up here even on a page count that happened not to move.
    expect(countPdfImageXObjects(withoutField)).toBe(0)
    expect(countPdfImageXObjects(withFieldButOff)).toBe(0)
  })
})
