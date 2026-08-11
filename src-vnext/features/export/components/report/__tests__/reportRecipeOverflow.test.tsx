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
import { inflateSync } from "node:zlib"
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

// ---------------------------------------------------------------------------
// WS-C-1 (2026-08-11) boundary+size scan — sibling to countPdfImageXObjects
// above, but where that one only counts image XObjects, this one locates
// EVERY placed image's device-space rect on every page and checks two
// invariants a page-count or a can't-wrap-warning check cannot see:
//   (a) CONTAINMENT — every rect lies fully inside its page's MediaBox. This
//       is what catches the observed "thumb rendered partially at a page's
//       bottom edge, then duplicated in full at the top of the next page"
//       defect: a straddling rect's y0 goes NEGATIVE (below the page origin).
//   (b) UNIFORM SIZE — every rect's height matches one of the recipe's known
//       standard thumb heights (cover / extras), within a tolerance. This is
//       the ONLY invariant that catches "weird resizing of shots towards the
//       bottom" (@react-pdf shrinking an image to whatever page space is
//       left, same 0.75 aspect preserved throughout — an aspect-only check
//       cannot see this; only an absolute-size check can).
//
// The parser walks a page's content stream tracking the CTM through q/Q/cm
// (PDF's own graphics-state stack + matrix-concatenation operators) and
// records the unit-square-transformed bounding box at every `/Name Do` image
// placement. NOT a general PDF parser — it assumes a classic (non
// cross-reference-stream) xref, which is what @react-pdf emits, and that
// every `Do` in these two recipes draws an Image XObject (neither recipe
// uses Form XObjects or patterns).
// ---------------------------------------------------------------------------

interface PdfRect {
  readonly x0: number
  readonly y0: number
  readonly x1: number
  readonly y1: number
}
interface PdfPageImages {
  readonly mediaBox: { readonly width: number; readonly height: number }
  readonly rects: readonly PdfRect[]
}
interface Mat {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}
const IDENTITY_MAT: Mat = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

/** Standard 2D affine composition: the matrix such that a point transformed
 *  by `m1` and then by `m2` equals the point transformed by the result
 *  (row-vector convention, matching the PDF spec's `cm` semantics: the new
 *  CTM is the just-parsed matrix applied first, then the prior CTM). */
function composeMat(m1: Mat, m2: Mat): Mat {
  return {
    a: m1.a * m2.a + m1.b * m2.c,
    b: m1.a * m2.b + m1.b * m2.d,
    c: m1.c * m2.a + m1.d * m2.c,
    d: m1.c * m2.b + m1.d * m2.d,
    e: m1.e * m2.a + m1.f * m2.c + m2.e,
    f: m1.e * m2.b + m1.f * m2.d + m2.f,
  }
}
function applyMat(m: Mat, x: number, y: number): readonly [number, number] {
  return [x * m.a + y * m.c + m.e, x * m.b + y * m.d + m.f]
}

/** Walk a decompressed content stream, tracking the CTM stack, and return the
 *  device-space bounding rect (unit square [0,1]x[0,1] transformed by the CTM
 *  active at that moment) for every `Do` image-placement operator. */
function extractImageRects(content: string): PdfRect[] {
  const rects: PdfRect[] = []
  let ctm: Mat = IDENTITY_MAT
  const stack: Mat[] = []
  // Numbers, /Names, and bare operator words. Digits inside hex-string (<..>)
  // or literal-string ((..)) text operands can spuriously match the number
  // alternative, but every real PDF operator (a bare word) resets the pending
  // operand buffer below, so stray digits from a Tj/TJ text run can never
  // survive to contaminate a LATER cm/Do — the same reasoning
  // reportRecipeStyleTokenSpacing.test.tsx's extractor relies on.
  const tokenRe = /-?\d*\.?\d+(?:[eE][-+]?\d+)?|\/[A-Za-z0-9#._-]+|[A-Za-z]+\*?/g
  let nums: number[] = []
  let m: RegExpExecArray | null
  while ((m = tokenRe.exec(content)) !== null) {
    const tok = m[0]
    if (/^[-\d.]/.test(tok)) {
      const n = parseFloat(tok)
      if (!Number.isNaN(n)) nums.push(n)
      continue
    }
    if (tok === "cm") {
      if (nums.length >= 6) {
        const [a, b, c, d, e, f] = nums.slice(-6) as [number, number, number, number, number, number]
        ctm = composeMat({ a, b, c, d, e, f }, ctm)
      }
      nums = []
    } else if (tok === "q") {
      stack.push(ctm)
      nums = []
    } else if (tok === "Q") {
      const prev = stack.pop()
      if (prev) ctm = prev
      nums = []
    } else if (tok === "Do") {
      const corners = [applyMat(ctm, 0, 0), applyMat(ctm, 1, 0), applyMat(ctm, 0, 1), applyMat(ctm, 1, 1)]
      const xs = corners.map((c) => c[0])
      const ys = corners.map((c) => c[1])
      rects.push({ x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) })
      nums = []
    } else {
      nums = [] // any other operator (re, m, l, W, n, f, S, gs, cs, scn, BT, ET, Tf, Tj, TJ, ...)
    }
  }
  return rects
}

function readBalancedDict(raw: string, start: number): { dict: string; end: number } {
  let depth = 0
  let i = start
  while (i < raw.length) {
    if (raw[i] === "<" && raw[i + 1] === "<") {
      depth++
      i += 2
      continue
    }
    if (raw[i] === ">" && raw[i + 1] === ">") {
      depth--
      i += 2
      if (depth === 0) return { dict: raw.slice(start, i), end: i }
      continue
    }
    i++
  }
  throw new Error(`unbalanced dict starting at offset ${start}`)
}

/** Locate `N 0 obj`, read its (possibly nested) dict, and — if a `stream`
 *  follows — its decoded data (FlateDecode-inflated, or raw if uncompressed). */
function getPdfObject(raw: string, buf: Buffer, objNum: number): { dict: string; data: Buffer | null } {
  const re = new RegExp(`(?:^|[^0-9])${objNum}\\s+0\\s+obj`)
  const m = re.exec(raw)
  if (!m) throw new Error(`object ${objNum} 0 obj not found`)
  const objStart = m.index + m[0].length
  const dictStart = raw.indexOf("<<", objStart)
  const { dict, end } = readBalancedDict(raw, dictStart)
  const afterDict = raw.slice(end, end + 20)
  const streamRel = afterDict.indexOf("stream")
  if (streamRel === -1) return { dict, data: null }
  let dataStart = end + streamRel + "stream".length
  if (raw[dataStart] === "\r") dataStart += 1
  if (raw[dataStart] === "\n") dataStart += 1
  const endstreamAt = raw.indexOf("endstream", dataStart)
  if (endstreamAt === -1) throw new Error(`endstream not found for object ${objNum}`)
  let dataEnd = endstreamAt
  if (raw[dataEnd - 1] === "\n") dataEnd -= 1
  if (raw[dataEnd - 1] === "\r") dataEnd -= 1
  const rawData = buf.subarray(dataStart, dataEnd)
  const data = dict.includes("/FlateDecode") ? inflateSync(rawData) : rawData
  return { dict, data }
}

function parseRefList(dict: string, key: string): number[] {
  const arrM = new RegExp(`/${key}\\s*\\[([^\\]]*)\\]`).exec(dict)
  if (arrM) {
    const nums: number[] = []
    const re = /(\d+)\s+0\s+R/g
    let m: RegExpExecArray | null
    while ((m = re.exec(arrM[1]!)) !== null) nums.push(Number(m[1]))
    return nums
  }
  const singleM = new RegExp(`/${key}\\s+(\\d+)\\s+0\\s+R`).exec(dict)
  return singleM ? [Number(singleM[1])] : []
}

function parseMediaBox(dict: string): { width: number; height: number } | null {
  const m = /\/MediaBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]/.exec(dict)
  if (!m) return null
  return { width: Number(m[3]) - Number(m[1]), height: Number(m[4]) - Number(m[2]) }
}

/** Parse a real @react-pdf-rendered PDF into, per page (true page-tree order
 *  via Catalog -> Pages -> Kids, not object-declaration order), its MediaBox
 *  and every placed image's device-space bounding rect. */
function parsePdfPageImages(buf: Buffer): PdfPageImages[] {
  const raw = buf.toString("latin1")
  const catalogM = /\/Type\s*\/Catalog[^]*?\/Pages\s+(\d+)\s+0\s+R/.exec(raw)
  if (!catalogM) throw new Error("no /Catalog with /Pages found")
  const pageNums: number[] = []
  const pageMediaBox = new Map<number, { width: number; height: number } | null>()
  function walk(objNum: number, inherited: { width: number; height: number } | null) {
    const { dict } = getPdfObject(raw, buf, objNum)
    const mb = parseMediaBox(dict) ?? inherited
    if (/\/Type\s*\/Pages\b/.test(dict)) {
      for (const kid of parseRefList(dict, "Kids")) walk(kid, mb)
      return
    }
    pageNums.push(objNum)
    pageMediaBox.set(objNum, mb)
  }
  walk(Number(catalogM[1]), null)

  return pageNums.map((pn) => {
    const { dict } = getPdfObject(raw, buf, pn)
    const mediaBox = pageMediaBox.get(pn) ?? { width: PAGE_W, height: PAGE_H }
    let content = ""
    for (const cn of parseRefList(dict, "Contents")) {
      const { data } = getPdfObject(raw, buf, cn)
      if (data) content += data.toString("latin1")
    }
    return { mediaBox, rects: extractImageRects(content) }
  })
}

// Landscape-letter fallback for a page dict with no MediaBox of its own (never
// hit in practice — every page @react-pdf emits carries an explicit MediaBox
// — but a typed fallback beats a silent `undefined` if that ever changes).
const PAGE_W = 792
const PAGE_H = 612

const CONTAINMENT_TOLERANCE_PT = 1.5 // rounding-error slack, not a real allowance to straddle

function findContainmentViolations(pages: readonly PdfPageImages[]): string[] {
  const out: string[] = []
  pages.forEach((page, pi) => {
    page.rects.forEach((r, ri) => {
      const outOfBounds =
        r.x0 < -CONTAINMENT_TOLERANCE_PT ||
        r.y0 < -CONTAINMENT_TOLERANCE_PT ||
        r.x1 > page.mediaBox.width + CONTAINMENT_TOLERANCE_PT ||
        r.y1 > page.mediaBox.height + CONTAINMENT_TOLERANCE_PT
      if (outOfBounds) {
        out.push(
          `page ${pi + 1} image #${ri}: rect [${r.x0.toFixed(1)},${r.y0.toFixed(1)} .. ${r.x1.toFixed(1)},${r.y1.toFixed(1)}] ` +
            `outside MediaBox 0,0 .. ${page.mediaBox.width},${page.mediaBox.height}`,
        )
      }
    })
  })
  return out
}

/** height match tolerance — generous enough to absorb border/rounding noise
 *  on a genuinely full-size thumb, tight enough that a shrunk variant (the
 *  reported defect: 55.6/44.6/37.2/24/20.8/9.3pt against a 95pt standard)
 *  always fails it. */
const UNIFORM_SIZE_TOLERANCE_RATIO = 0.12

function findUniformSizeViolations(pages: readonly PdfPageImages[], expectedHeightsPt: readonly number[]): string[] {
  const out: string[] = []
  pages.forEach((page, pi) => {
    page.rects.forEach((r, ri) => {
      const h = r.y1 - r.y0
      const ok = expectedHeightsPt.some((eh) => Math.abs(h - eh) <= eh * UNIFORM_SIZE_TOLERANCE_RATIO)
      if (!ok) {
        out.push(
          `page ${pi + 1} image #${ri}: height ${h.toFixed(2)}pt matches none of [${expectedHeightsPt.join(", ")}]pt ` +
            `within ${(UNIFORM_SIZE_TOLERANCE_RATIO * 100).toFixed(0)}%`,
        )
      }
    })
  })
  return out
}

// 1x1 transparent PNG — a real, valid image payload (not a garbage base64
// string), matching the shape resolveReportImages/resolvePdfImageSrc actually
// hand the renderer (a "data:" URL, resolved once and cached). @react-pdf/image
// reads a data: URL directly (no fetch), so this works under @vitest-environment node.
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="

// 3x4 px solid PNG, 0.75 aspect (portrait) — WS-C-1's boundary-scan fixtures
// (below) need this INSTEAD of the square TINY_PNG above. object-fit:contain
// against a square source is width-constrained (renders as a square), which
// can never reproduce the real prod defect's reported aspect (0.75, e.g.
// 55.6x74.1pt) — only a source narrower-than-the-box's-own-aspect is
// height-constrained, matching how real (portrait) garment photography
// renders and giving predictable "standard" heights (~95pt cover / ~47pt
// extras on production-sheet — matching the spec's own measured figures
// exactly) that a shrink-to-fit variant will visibly miss.
const PORTRAIT_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAMAAAAECAIAAADETxJQAAAAF0lEQVR4nGOssDnBwMDAwMDAxAAD2FgAOOABhB+FoD8AAAAASUVORK5CYII="

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

// ---------------------------------------------------------------------------
// WS-C-1 (2026-08-11) — page-boundary image straddling/shrinking hotfix.
//
// Found in a REAL prod PDF verification post-#518 (17-page production-sheet
// export, 66 shots, Extra images ON): (1) an additional-images thumb rendered
// PARTIALLY at a page's bottom edge, then duplicated in full at the top of
// the next page; (2) a cover thumb sliver at a page bottom (the next shot's
// Row started with almost no room left); (3) SIX images rendered
// proportionally SHRUNKEN to fit leftover page space (55.6x74.1 down to a
// 9.3x12.5 postage stamp), same 0.75 aspect throughout — @react-pdf shrinks a
// splittable image container to whatever page space remains instead of
// moving it. The fix: wrap={false} on each cover thumb (thumbBox / imgCol)
// and each extras thumb (extraThumb) so a box that doesn't fit moves WHOLE to
// the next page/line instead of straddling or shrinking, plus
// minPresenceAhead on the Row/Band start (~60pt) and the extras label
// (~30pt) so neither a shot nor its "Additional references" heading begins
// with only a sliver of room left. The extraRow/Row/Band CONTAINERS are
// deliberately left splittable (wrap:true, the default) — #508's
// flow-across-many-pages behavior for an oversized shot is unaffected; only
// the small fixed-size image leaves became atomic.
//
// The two invariants below (containment, uniform size) are what actually
// catch this — a can't-wrap-warning check (the describe block above) cannot:
// a straddled or shrunk image renders with NO warning at all, which is
// exactly how this shipped unnoticed through #518's existing test suite.
// ---------------------------------------------------------------------------

// Standard thumb heights, MEASURED against a real @react-pdf render of a
// single uncrowded shot (no page-boundary interaction) with PORTRAIT_PNG —
// production-sheet matches the spec's own reported figures (~95 / ~47)
// exactly; balanced-rows figures aren't stated in the spec so these are the
// direct measurement (imgCol has no border and its full BAND_H=150 renders
// height-constrained; extraThumb's ~0.5pt border insets 50 -> ~49).
const PRODUCTION_SHEET_STANDARD_HEIGHTS = [95, 47] as const
const BALANCED_ROWS_STANDARD_HEIGHTS = [150, 49] as const

function boundaryProduct(i: number): ReportProduct {
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

/** A shot with a real cover image AND a handful of additional-images
 *  references — dense enough (6 products, a note) that many of these in one
 *  model reliably crosses page boundaries at the fixture sizes below, without
 *  any single shot being a pathological outlier. */
function boundaryShot(id: string, num: string): ReportShot {
  return {
    id,
    number: num,
    title: `Boundary Shot ${num}`,
    colorway: "Charcoal / Bone",
    status: "todo",
    gender: "W",
    notes: "Styling note to add a little height. ",
    talent: [{ id: `${id}-t1`, name: "Alexandra Whitfield", img: null }],
    excluded: false,
    hasImage: true,
    looks: [
      {
        id: `${id}-l1`,
        label: "Primary",
        isAlt: false,
        image: `${id}-cover`,
        hasReference: true,
        products: Array.from({ length: 6 }, (_, i) => boundaryProduct(i)),
      },
    ],
    additionalImages: Array.from({ length: 4 }, (_, i) => `${id}-extra-${i}`),
  }
}

function boundaryModel(shotCount: number): ReportModel {
  const shots = Array.from({ length: shotCount }, (_, i) => boundaryShot(`bs${i}`, String(i + 1).padStart(2, "0")))
  return {
    project: { name: "Boundary Scan Fixture", client: "unbound-merino", shotCount, dateRange: null },
    groups: [{ key: "W", label: "Women", count: shotCount, shots }],
    order: { sortBy: "shot-number", sortDir: "asc" },
  }
}

function boundaryImageMap(shotCount: number): Map<string, string> {
  const m = new Map<string, string>()
  for (let i = 0; i < shotCount; i++) {
    m.set(`bs${i}-cover`, PORTRAIT_PNG)
    for (let e = 0; e < 4; e++) m.set(`bs${i}-extra-${e}`, PORTRAIT_PNG)
  }
  return m
}

// 12/16/20/26 shots — sized to actually hit page boundaries repeatedly (not
// just once): at ~2 shots/page on production-sheet and ~1.5/page on
// balanced-rows, each fixture spans 6-16 pages, so a straddle/shrink at ANY
// one boundary is not a coincidence of fixture size.
const BOUNDARY_SHOT_COUNTS = [12, 16, 20, 26] as const

describe.each(BOUNDARY_SHOT_COUNTS)("recipe PDF boundary scan (WS-C-1) — %i shots, extras ON", (shotCount) => {
  const model = boundaryModel(shotCount)
  const imageMap = boundaryImageMap(shotCount)

  it("production-sheet: every placed image is fully on-page and standard-sized (no straddle, no shrink)", async () => {
    const buf = await renderToBuffer(
      <ProductionSheetPdfDocument model={model} imageMap={imageMap} showAdditionalImages={true} />,
    )
    const pages = parsePdfPageImages(buf)
    expect(pages.length).toBeGreaterThan(1) // must actually cross page boundaries to prove anything
    const totalRects = pages.reduce((n, p) => n + p.rects.length, 0)
    expect(totalRects).toBe(shotCount * 5) // 1 cover + 4 extras per shot, nothing dropped
    expect(findContainmentViolations(pages)).toEqual([])
    expect(findUniformSizeViolations(pages, PRODUCTION_SHEET_STANDARD_HEIGHTS)).toEqual([])
  })

  it("balanced-rows: every placed image is fully on-page and standard-sized (no straddle, no shrink)", async () => {
    const buf = await renderToBuffer(
      <BalancedRowsPdfDocument model={model} imageMap={imageMap} showAdditionalImages={true} />,
    )
    const pages = parsePdfPageImages(buf)
    expect(pages.length).toBeGreaterThan(1)
    const totalRects = pages.reduce((n, p) => n + p.rects.length, 0)
    expect(totalRects).toBe(shotCount * 5)
    expect(findContainmentViolations(pages)).toEqual([])
    expect(findUniformSizeViolations(pages, BALANCED_ROWS_STANDARD_HEIGHTS)).toEqual([])
  })
})

// Page-count sanity (WS-C-1 spec item 2: "verify this does NOT change page
// counts dramatically... ± a page is fine"). MEASURED against the real
// pre-fix and post-fix renders of the 20-shot fixture: production-sheet
// 8 -> 9 pages, balanced-rows 13 -> 13 pages — well inside a generous bound
// that still catches a gross regression (e.g. minPresenceAhead sized in the
// wrong units, or applied per-product instead of per-shot).
describe("recipe PDF boundary scan (WS-C-1) — page count stays sane", () => {
  it("production-sheet: 20-shot boundary fixture paginates within a generous, non-degenerate bound", async () => {
    const buf = await renderToBuffer(
      <ProductionSheetPdfDocument model={boundaryModel(20)} imageMap={boundaryImageMap(20)} showAdditionalImages={true} />,
    )
    const pageCount = parsePdfPageImages(buf).length
    expect(pageCount).toBeGreaterThanOrEqual(6)
    expect(pageCount).toBeLessThanOrEqual(12)
  })

  it("balanced-rows: 20-shot boundary fixture paginates within a generous, non-degenerate bound", async () => {
    const buf = await renderToBuffer(
      <BalancedRowsPdfDocument model={boundaryModel(20)} imageMap={boundaryImageMap(20)} showAdditionalImages={true} />,
    )
    const pageCount = parsePdfPageImages(buf).length
    expect(pageCount).toBeGreaterThanOrEqual(10)
    expect(pageCount).toBeLessThanOrEqual(18)
  })
})

// ---------------------------------------------------------------------------
// WS-C-1 — dense MULTI-PAGE shots (each shot alone spans several physical
// pages, via a 50-product look — reusing overflowModel()'s `product()`
// shape). MUTATION-VERIFIED to be the sharper reproduction of the cover-thumb
// shrink specifically: the 12-26 shot "boundary scan" fixtures above (one
// page-ish per shot) caught balanced-rows' imgCol shrink but NOT
// production-sheet's thumbBox shrink — reverting thumbBox's wrap={false}
// alone left every rect standard-sized on those fixtures (checked directly).
// A shot dense enough to cross SEVERAL internal page boundaries by itself
// gives the cover thumb many more chances to land exactly where a break
// falls, and DOES catch it: reverting thumbBox alone measured a 55pt cover
// (vs the 95pt standard) here — see the mutation-evidence note below.
// ---------------------------------------------------------------------------

function denseMultiPageShot(id: string, num: string, nProducts: number, extras: number): ReportShot {
  return {
    id,
    number: num,
    title: `Dense Shot ${num}`,
    colorway: "Charcoal / Bone",
    status: "on_hold",
    gender: "W",
    notes: "Deliberately long styling note to add height. ".repeat(10),
    talent: [{ id: `${id}-t1`, name: "Alexandra Whitfield", img: null }],
    excluded: false,
    hasImage: true,
    looks: [
      {
        id: `${id}-l1`,
        label: "Primary",
        isAlt: false,
        image: `${id}-cover`,
        hasReference: true,
        products: Array.from({ length: nProducts }, (_, i) => boundaryProduct(i)),
      },
    ],
    additionalImages: Array.from({ length: extras }, (_, i) => `${id}-extra-${i}`),
  }
}

function denseMultiPageModel(shotCount: number, nProducts: number, extras: number): ReportModel {
  const shots = Array.from({ length: shotCount }, (_, i) =>
    denseMultiPageShot(`dm${i}`, String(i + 1).padStart(2, "0"), nProducts, extras),
  )
  return {
    project: { name: "Dense Multi-Page Fixture", client: "unbound-merino", shotCount, dateRange: null },
    groups: [{ key: "W", label: "Women", count: shotCount, shots }],
    order: { sortBy: "shot-number", sortDir: "asc" },
  }
}

function denseMultiPageImageMap(shotCount: number, extras: number): Map<string, string> {
  const m = new Map<string, string>()
  for (let i = 0; i < shotCount; i++) {
    m.set(`dm${i}-cover`, PORTRAIT_PNG)
    for (let e = 0; e < extras; e++) m.set(`dm${i}-extra-${e}`, PORTRAIT_PNG)
  }
  return m
}

describe("recipe PDF boundary scan (WS-C-1) — dense multi-page shots (each shot several pages tall)", () => {
  const model = denseMultiPageModel(3, 50, 10)
  const imageMap = denseMultiPageImageMap(3, 10)

  it("production-sheet: every placed image is fully on-page and standard-sized (no straddle, no shrink)", async () => {
    const buf = await renderToBuffer(
      <ProductionSheetPdfDocument model={model} imageMap={imageMap} showAdditionalImages={true} />,
    )
    const pages = parsePdfPageImages(buf)
    expect(pages.length).toBeGreaterThan(3) // 3 shots, each already several pages tall alone
    expect(findContainmentViolations(pages)).toEqual([])
    expect(findUniformSizeViolations(pages, PRODUCTION_SHEET_STANDARD_HEIGHTS)).toEqual([])
  })

  it("balanced-rows: every placed image is fully on-page and standard-sized (no straddle, no shrink)", async () => {
    const buf = await renderToBuffer(
      <BalancedRowsPdfDocument model={model} imageMap={imageMap} showAdditionalImages={true} />,
    )
    const pages = parsePdfPageImages(buf)
    expect(pages.length).toBeGreaterThan(3)
    expect(findContainmentViolations(pages)).toEqual([])
    expect(findUniformSizeViolations(pages, BALANCED_ROWS_STANDARD_HEIGHTS)).toEqual([])
  })
})
