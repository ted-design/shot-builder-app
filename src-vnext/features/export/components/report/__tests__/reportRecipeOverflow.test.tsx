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
import { ShotReportPdfDocument } from "../../../lib/report/reportPdf"
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
  /** The page's decompressed content stream — the source `rects` was parsed
   *  from, kept so a text assertion (extractPdfText below) can reuse the same
   *  page walk instead of re-implementing the xref/page-tree traversal. */
  readonly content: string
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
 *  follows — its decoded data (FlateDecode-inflated, or raw if uncompressed).
 *
 *  The stream's byte length comes from the dict's own `/Length`, NOT from
 *  scanning for the literal "endstream" and stripping a trailing newline —
 *  pdfkit (via @react-pdf) emits exactly `stream\n<DATA>\nendstream`, so a
 *  scan-and-strip approach that (wrongly) tries to also eat a trailing `\r`
 *  removes a genuine byte of Flate data whenever that byte happens to be
 *  0x0D, and inflateSync throws Z_BUF_ERROR ("unexpected end of file") —
 *  reproduced live during this file's own review (see PR #519 finding
 *  pdf-stream-reader-strips-a-real-data-byte). /Length is authoritative:
 *  pdfkit's PDFReference increments `data.Length` by exactly the number of
 *  bytes it pushes into `this.chunks`, and finalize() writes those chunks
 *  verbatim (node_modules/@react-pdf/pdfkit/lib/pdfkit.js `initDeflate`/
 *  `finalize`) — so `dataStart + Length` is always the exact end offset. */
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
  const lengthM = /\/Length\s+(\d+)/.exec(dict)
  if (!lengthM) throw new Error(`object ${objNum} 0 obj: stream dict has no direct /Length`)
  const dataEnd = dataStart + Number(lengthM[1])
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
    return { mediaBox, rects: extractImageRects(content), content }
  })
}

/**
 * Concatenated text-showing operands (Tj / TJ) across every page, in page-tree
 * order, WITH ALL WHITESPACE STRIPPED. @react-pdf's base-14 (non-embedded,
 * WinAnsi) path emits per-glyph HEX strings inside TJ arrays, so hex decoding is
 * the primary route; kerning-adjustment numbers simply don't match the
 * tokenizer and fall out for free. Good enough to prove a specific token was
 * DRAWN (or wasn't) — NOT a general PDF parser. Compare against a de-spaced,
 * uppercase needle, since the chips render `textTransform: "uppercase"`.
 */
function extractPdfText(buf: Buffer): string {
  let out = ""
  for (const page of parsePdfPageImages(buf)) {
    const tokenRe = /<([0-9A-Fa-f]+)>|\(((?:\\.|[^\\()])*)\)/g
    let m: RegExpExecArray | null
    while ((m = tokenRe.exec(page.content)) !== null) {
      if (m[1] !== undefined) {
        const hex = m[1]
        for (let i = 0; i + 1 < hex.length; i += 2) {
          out += String.fromCharCode(Number.parseInt(hex.slice(i, i + 2), 16))
        }
      } else if (m[2] !== undefined) {
        out += m[2]
      }
    }
  }
  return out.replace(/\s+/g, "")
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

/** `findUniformSizeViolations` pools every recipe height into ONE accepted
 *  set — so a cover thumb shrunk into the extras thumb's tolerance band (the
 *  same 0.75-aspect shrink-to-fit defect, just landing in-band instead of
 *  out-of-band) passes it silently: reproduced with only thumbBox's
 *  wrap={false} reverted, a 21-shot/24-note-repeat dense-multi-page render
 *  produces a 49.10pt cover (the 95pt standard shrunk ~48%) that
 *  findUniformSizeViolations accepts because 49.10 sits inside the extras
 *  band's [41.36, 52.64]pt tolerance (see PR #519 finding
 *  uniform-size-band-pools-cover-and-extras). This is a role-aware
 *  COMPLEMENT to it, not a replacement: each band gets its own tolerance
 *  window and each rect is credited to the single band it's nearest to (the
 *  two recipes' standard heights are far enough apart — 95pt/47pt,
 *  150pt/49pt — that their ±12% windows never overlap), so a rect that
 *  wanders from the cover count into the extras count changes both counts
 *  even though every individual height still "matches something". */
interface SizeBand {
  readonly label: string
  readonly heightPt: number
  readonly expectedCount: number
}

function findSizeBandCountMismatches(pages: readonly PdfPageImages[], bands: readonly SizeBand[]): string[] {
  const actual = new Map<string, number>(bands.map((b) => [b.label, 0]))
  let unmatched = 0
  pages.forEach((page) => {
    page.rects.forEach((r) => {
      const h = r.y1 - r.y0
      let best: SizeBand | null = null
      let bestDiff = Infinity
      for (const b of bands) {
        const diff = Math.abs(h - b.heightPt)
        if (diff <= b.heightPt * UNIFORM_SIZE_TOLERANCE_RATIO && diff < bestDiff) {
          best = b
          bestDiff = diff
        }
      }
      if (best) actual.set(best.label, (actual.get(best.label) ?? 0) + 1)
      else unmatched += 1
    })
  })
  const out: string[] = []
  for (const b of bands) {
    const got = actual.get(b.label) ?? 0
    if (got !== b.expectedCount) {
      out.push(`band "${b.label}" (~${b.heightPt}pt): expected ${b.expectedCount} images, got ${got}`)
    }
  }
  if (unmatched > 0) out.push(`${unmatched} image(s) matched no band at all (see findUniformSizeViolations)`)
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

// A realistic tag load for a crew sheet: a media tag, a priority tag, and two
// production tags. Long enough labels that the row is a real, measurable band
// rather than a rounding error.
const BOUNDARY_TAGS = [
  { id: "default-media-photo", label: "Photo", category: "media" },
  { id: "default-priority-high", label: "High Priority", category: "priority" },
  { id: "other-flat", label: "Flat Lay", category: "other" },
  { id: "other-studio", label: "Studio Cyc", category: "other" },
] as const

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
    // Tag chips (2026-08-17). Present on EVERY boundary fixture shot so the
    // showTags-ON cases below actually exercise the new row — a gate whose
    // fixture can't trip the bug proves nothing. The existing extras-ON cases
    // render WITHOUT showTags, so their pinned page-count bounds are unaffected
    // (and the "OFF is byte-identical" case below is what proves that claim).
    tags: BOUNDARY_TAGS,
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
    // Role-aware complement to the line above (see findSizeBandCountMismatches'
    // docstring): a cover shrunk INTO the extras tolerance band still matches
    // "something" in the union check, but shorts the cover count and inflates
    // the extras count. Exact counts here catch that.
    expect(
      findSizeBandCountMismatches(pages, [
        { label: "cover", heightPt: PRODUCTION_SHEET_STANDARD_HEIGHTS[0], expectedCount: shotCount },
        { label: "extras", heightPt: PRODUCTION_SHEET_STANDARD_HEIGHTS[1], expectedCount: shotCount * 4 },
      ]),
    ).toEqual([])
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
    expect(
      findSizeBandCountMismatches(pages, [
        { label: "cover", heightPt: BALANCED_ROWS_STANDARD_HEIGHTS[0], expectedCount: shotCount },
        { label: "extras", heightPt: BALANCED_ROWS_STANDARD_HEIGHTS[1], expectedCount: shotCount * 4 },
      ]),
    ).toEqual([])
  })
})

// Page-count sanity (WS-C-1 spec item 2: "verify this does NOT change page
// counts dramatically... ± a page is fine"). RE-MEASURED (PR #519 review —
// the original comment here, "8 -> 9" / "13 -> 13", did not reproduce; see
// finding page-count-measured-comment-does-not-reproduce) against real
// origin/main vs the current fixed tree for the 20-shot fixture:
// production-sheet 9 -> 9 pages, balanced-rows 14 -> 14 pages — UNCHANGED.
// The Row/Band minPresenceAhead={60} in the original WS-C-1 hotfix (removed
// on review, see reportPdfProductionSheet.tsx's Row / reportPdfBalancedRows.tsx's
// Band) was what had moved these numbers (to 11 / 14 — no change on
// balanced-rows even with it, since its Band already started every boundary
// shot at a page top); thumbBox/imgCol's wrap={false}, which is what actually
// fixes the defect, costs zero pages on this fixture. Bounds stay generous
// enough to still catch a gross regression (e.g. a per-product instead of
// per-shot weight, or the fix reintroducing pagination cost some other way).
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

  it("balanced-rows: 20-shot boundary fixture, showAdditionalImages OFF (the shipped default) — the case the ON-only comment above cannot see", async () => {
    // PR #519 finding min-presence-ahead-inflates-page-count: the removed
    // Row/Band minPresenceAhead={60} inflated THIS specific path (extras off,
    // the default) by up to +77% on balanced-rows — invisible to every test
    // in this suite before this one, since every other boundary/dense fixture
    // renders with showAdditionalImages={true}. Bound is real origin/main (10
    // pages) plus slack, not the inflated (17) figure minPresenceAhead produced.
    const buf = await renderToBuffer(<BalancedRowsPdfDocument model={boundaryModel(20)} imageMap={boundaryImageMap(20)} />)
    const pageCount = parsePdfPageImages(buf).length
    expect(pageCount).toBeGreaterThanOrEqual(7)
    expect(pageCount).toBeLessThanOrEqual(13)
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

function denseMultiPageShot(id: string, num: string, nProducts: number, extras: number, noteRepeat = 10): ReportShot {
  return {
    id,
    number: num,
    title: `Dense Shot ${num}`,
    colorway: "Charcoal / Bone",
    status: "on_hold",
    gender: "W",
    notes: noteRepeat > 0 ? "Deliberately long styling note to add height. ".repeat(noteRepeat) : null,
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
    tags: BOUNDARY_TAGS,
  }
}

function denseMultiPageModel(shotCount: number, nProducts: number, extras: number, noteRepeat = 10): ReportModel {
  const shots = Array.from({ length: shotCount }, (_, i) =>
    denseMultiPageShot(`dm${i}`, String(i + 1).padStart(2, "0"), nProducts, extras, noteRepeat),
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
    // 3 covers + 30 extras (10/shot), nothing dropped — both violation helpers
    // below return [] on a page with zero rects, so without this a future
    // regression that stops images from being placed/resolved at all would
    // leave this test vacuously green (see PR #519 finding
    // dense-fixture-has-no-rect-count-assertion).
    const totalRects = pages.reduce((n, p) => n + p.rects.length, 0)
    expect(totalRects).toBe(33)
    expect(findContainmentViolations(pages)).toEqual([])
    expect(findUniformSizeViolations(pages, PRODUCTION_SHEET_STANDARD_HEIGHTS)).toEqual([])
    expect(
      findSizeBandCountMismatches(pages, [
        { label: "cover", heightPt: PRODUCTION_SHEET_STANDARD_HEIGHTS[0], expectedCount: 3 },
        { label: "extras", heightPt: PRODUCTION_SHEET_STANDARD_HEIGHTS[1], expectedCount: 30 },
      ]),
    ).toEqual([])
  })

  it("balanced-rows: every placed image is fully on-page and standard-sized (no straddle, no shrink)", async () => {
    const buf = await renderToBuffer(
      <BalancedRowsPdfDocument model={model} imageMap={imageMap} showAdditionalImages={true} />,
    )
    const pages = parsePdfPageImages(buf)
    expect(pages.length).toBeGreaterThan(3)
    const totalRects = pages.reduce((n, p) => n + p.rects.length, 0)
    expect(totalRects).toBe(33)
    expect(findContainmentViolations(pages)).toEqual([])
    expect(findUniformSizeViolations(pages, BALANCED_ROWS_STANDARD_HEIGHTS)).toEqual([])
    expect(
      findSizeBandCountMismatches(pages, [
        { label: "cover", heightPt: BALANCED_ROWS_STANDARD_HEIGHTS[0], expectedCount: 3 },
        { label: "extras", heightPt: BALANCED_ROWS_STANDARD_HEIGHTS[1], expectedCount: 30 },
      ]),
    ).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// WS-C-1 review fixup (PR #519 finding extras-thumb-fix-ships-with-zero-coverage)
// — every fixture above uses 4 extras/shot (boundary scan) or 10 (dense),
// never dense enough for extraThumb's own wrap={false} to be the thing that
// prevents a straddle: mutation-verified by reverting ONLY extraThumb's
// wrap={false} (both recipes) and sweeping extras-heavy shapes — 6 shots x 4
// products x 7 extras is the cheapest shape that reddens (balanced-rows,
// containment: "page 2 image #9: rect [278.6,-13.3 .. 315.4,35.7]", i.e. a
// thumb straddling 13.3pt below the page origin — the exact defect class
// WS-C-1 exists to catch, on the extras half of the fix specifically).
// ---------------------------------------------------------------------------
describe("recipe PDF boundary scan (WS-C-1) — extras-heavy shots (extraThumb's own wrap={false} is load-bearing)", () => {
  const EXTRAS_HEAVY_SHOT_COUNT = 6
  const EXTRAS_HEAVY_PRODUCTS = 4
  const EXTRAS_HEAVY_EXTRAS = 7

  function extrasHeavyShot(id: string, num: string): ReportShot {
    return {
      id,
      number: num,
      title: `Extras-Heavy Shot ${num}`,
      colorway: "Charcoal / Bone",
      status: "todo",
      gender: "W",
      notes: "A short styling note.",
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
          products: Array.from({ length: EXTRAS_HEAVY_PRODUCTS }, (_, i) => boundaryProduct(i)),
        },
      ],
      additionalImages: Array.from({ length: EXTRAS_HEAVY_EXTRAS }, (_, i) => `${id}-extra-${i}`),
    }
  }

  const model: ReportModel = {
    project: { name: "Extras-Heavy Fixture", client: "unbound-merino", shotCount: EXTRAS_HEAVY_SHOT_COUNT, dateRange: null },
    groups: [
      {
        key: "W",
        label: "Women",
        count: EXTRAS_HEAVY_SHOT_COUNT,
        shots: Array.from({ length: EXTRAS_HEAVY_SHOT_COUNT }, (_, i) => extrasHeavyShot(`eh${i}`, String(i + 1).padStart(2, "0"))),
      },
    ],
    order: { sortBy: "shot-number", sortDir: "asc" },
  }
  const imageMap = new Map<string, string>()
  for (let i = 0; i < EXTRAS_HEAVY_SHOT_COUNT; i++) {
    imageMap.set(`eh${i}-cover`, PORTRAIT_PNG)
    for (let e = 0; e < EXTRAS_HEAVY_EXTRAS; e++) imageMap.set(`eh${i}-extra-${e}`, PORTRAIT_PNG)
  }

  it("production-sheet: every placed image is fully on-page (extraThumb straddle check)", async () => {
    const buf = await renderToBuffer(
      <ProductionSheetPdfDocument model={model} imageMap={imageMap} showAdditionalImages={true} />,
    )
    const pages = parsePdfPageImages(buf)
    const totalRects = pages.reduce((n, p) => n + p.rects.length, 0)
    expect(totalRects).toBe(EXTRAS_HEAVY_SHOT_COUNT * (1 + EXTRAS_HEAVY_EXTRAS))
    expect(findContainmentViolations(pages)).toEqual([])
  })

  it("balanced-rows: every placed image is fully on-page (extraThumb straddle check)", async () => {
    const buf = await renderToBuffer(
      <BalancedRowsPdfDocument model={model} imageMap={imageMap} showAdditionalImages={true} />,
    )
    const pages = parsePdfPageImages(buf)
    const totalRects = pages.reduce((n, p) => n + p.rects.length, 0)
    expect(totalRects).toBe(EXTRAS_HEAVY_SHOT_COUNT * (1 + EXTRAS_HEAVY_EXTRAS))
    expect(findContainmentViolations(pages)).toEqual([])
  })

  it("balanced-rows: showAdditionalImages OFF — the shipped default with an extras-heavy model still renders cleanly", async () => {
    // PR #519 finding boundary-gate-never-exercises-extras-off: every test
    // above (this file's whole boundary/dense/pooled-band/extras-heavy
    // suite) renders with the toggle ON. This is the complement — same dense
    // model, toggle off, confirming the cover-thumb fix (which applies
    // unconditionally, unlike extraThumb which only renders when the row is
    // invoked at all) doesn't need the toggle to stay clean.
    const buf = await renderToBuffer(<BalancedRowsPdfDocument model={model} imageMap={imageMap} />)
    const pages = parsePdfPageImages(buf)
    expect(findContainmentViolations(pages)).toEqual([])
    expect(findUniformSizeViolations(pages, BALANCED_ROWS_STANDARD_HEIGHTS)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// WS-C-1 review fixup (PR #519 finding uniform-size-band-pools-cover-and-extras
// / uniform-size-gate-union-masks-cover-shrink) — findUniformSizeViolations
// pools every recipe height into ONE accepted set, so a cover thumb shrunk
// INTO the extras thumb's own tolerance band passes it silently: that's the
// exact defect class WS-C-1 exists to catch, missed by the union check alone.
//
// This fixture (production-sheet, 3 shots x 21 products x 10 extras, a
// 24-repeat note) is a MEASURED reproduction, found by sweeping
// denseMultiPageModel across product/note-length combinations with only
// thumbBox's wrap={false} reverted: it lands a shrunk cover at 49.10pt —
// inside the extras band's [41.36, 52.64]pt window — while
// findUniformSizeViolations reports ZERO violations. findSizeBandCountMismatches
// (bucketing by nearest expected height and asserting exact per-band counts)
// is what actually catches it: the cover band comes up one short and the
// extras band comes up one over.
// ---------------------------------------------------------------------------
describe("recipe PDF boundary scan (WS-C-1) — cover shrink landing inside the extras tolerance band", () => {
  const POOLED_BAND_SHOT_COUNT = 3
  const POOLED_BAND_PRODUCTS = 21
  const POOLED_BAND_EXTRAS = 10
  const POOLED_BAND_NOTE_REPEAT = 24
  const model = denseMultiPageModel(POOLED_BAND_SHOT_COUNT, POOLED_BAND_PRODUCTS, POOLED_BAND_EXTRAS, POOLED_BAND_NOTE_REPEAT)
  const imageMap = denseMultiPageImageMap(POOLED_BAND_SHOT_COUNT, POOLED_BAND_EXTRAS)

  it("production-sheet: per-band counts stay exact even though a pooled union check cannot see the shrink", async () => {
    const buf = await renderToBuffer(
      <ProductionSheetPdfDocument model={model} imageMap={imageMap} showAdditionalImages={true} />,
    )
    const pages = parsePdfPageImages(buf)
    expect(findContainmentViolations(pages)).toEqual([])
    expect(
      findSizeBandCountMismatches(pages, [
        { label: "cover", heightPt: PRODUCTION_SHEET_STANDARD_HEIGHTS[0], expectedCount: POOLED_BAND_SHOT_COUNT },
        { label: "extras", heightPt: PRODUCTION_SHEET_STANDARD_HEIGHTS[1], expectedCount: POOLED_BAND_SHOT_COUNT * POOLED_BAND_EXTRAS },
      ]),
    ).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Tag chips (2026-08-17) — the tag row must be as flow-friendly as the rest of
// the shot block, and must not disturb the WS-C-1 image invariants.
//
// Why this belongs in THIS suite and not a mocked one: the parity/DOM tests
// mock @react-pdf, so they cannot see physical page overflow, straddling, or
// shrink-to-fit. The row is text-only (no Image leaves), so its own failure mode
// is the ATOMIC-OVERFLOW one this file was built for: if anyone adds
// wrap={false} to TagChipRow's container, a chip-heavy shot's row becomes an
// unsplittable node taller than a page and @react-pdf emits "can't wrap between
// pages" — silently clipping a crew sheet.
//
// MUTATION-VERIFIED (recorded in the PR): adding wrap={false} to TagChipRow's
// outer View in reportPdfProductionSheet.tsx / reportPdfBalancedRows.tsx reddens
// both "row ALONE" cases below.
//
// Fixture sizing follows this file's own discipline: the stress fixture is
// sized WELL past one page's usable height (2-3x), not marginally past it, so a
// fixture that merely fits can never mask a regression.
// ---------------------------------------------------------------------------

// MEASURED, not guessed (probe run 2026-08-17, real renderToBuffer): a chip
// renders ~57pt wide at 5.5pt Helvetica ("Production Tag NNN" + 6pt padding +
// 3pt gap), so ~11 fit a line of the production-sheet body column and a line
// costs ~13pt — 400 chips is only ~0.6 of a page and pages at 2, which would
// make the "row ALONE flows across pages" cases below nearly unfalsifiable.
// 1200 chips pages at 4 on BOTH recipes (1 page baseline with the toggle off),
// i.e. ~3 pages of tag row — comfortably past threshold rather than marginally
// past it, per this repo's fixture-sizing discipline. The falsifiability check
// immediately below pins that premise so a future change that shrinks the row
// can't quietly turn these cases vacuous.
const TAG_STRESS_COUNT = 1200
const TAG_STRESS_TAGS = Array.from({ length: TAG_STRESS_COUNT }, (_, i) => ({
  id: `stress-tag-${String(i)}`,
  label: `Production Tag ${String(i)}`,
  category: "other",
}))

/** The SAME "Everything Shot" as overflowModel(), plus a realistic tag load —
 *  the shot is already several pages tall from the 50 products alone; this
 *  proves the NEW row doesn't reintroduce a clip when composed with the
 *  existing overflow behavior. */
function overflowModelWithTags(): ReportModel {
  const base = overflowModel()
  const shot: ReportShot = { ...base.groups[0]!.shots[0]!, tags: [...BOUNDARY_TAGS] }
  return { ...base, groups: [{ ...base.groups[0]!, shots: [shot] }] }
}

/** Stress fixture ISOLATING the tag row: a near-empty shot (one product, no
 *  notes, no alt looks, no references) whose ONLY source of height is a huge
 *  tag row. At 400 chips this wraps to several times a single page's usable
 *  height on both recipes. */
function tagStressModel(): ReportModel {
  const shot: ReportShot = {
    id: "s1",
    number: "01",
    title: "Tags-Only Shot",
    colorway: null,
    status: "todo",
    gender: "W",
    notes: null,
    talent: [],
    excluded: false,
    hasImage: false,
    looks: [{ id: "l1", label: "Primary", isAlt: false, image: null, hasReference: false, products: [product(0)] }],
    tags: TAG_STRESS_TAGS,
  }
  return {
    project: { name: "Tag-Row Stress Fixture", client: "unbound-merino", shotCount: 1, dateRange: null },
    groups: [{ key: "W", label: "Women", count: 1, shots: [shot] }],
    order: { sortBy: "shot-number", sortDir: "asc" },
  }
}

describe("recipe PDF overflow — tag-chip row (2026-08-17) must FLOW, never silently clip", () => {
  let warn: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {})
  })
  afterEach(() => {
    warn.mockRestore()
  })

  it("production-sheet: 50-product shot + 4 tags, showTags ON — zero can't-wrap warnings, sane page count", async () => {
    const buf = await renderToBuffer(
      <ProductionSheetPdfDocument model={overflowModelWithTags()} imageMap={new Map()} showTags={true} />,
    )
    expect(buf.length).toBeGreaterThan(0)
    expect(overflowWarnings(warn)).toEqual([])
    const pages = countPdfPages(buf)
    expect(pages).toBeGreaterThanOrEqual(2)
    expect(pages).toBeLessThanOrEqual(5)
  })

  it("balanced-rows: 50-product shot + 4 tags, showTags ON — zero can't-wrap warnings, sane page count", async () => {
    const buf = await renderToBuffer(
      <BalancedRowsPdfDocument model={overflowModelWithTags()} imageMap={new Map()} showTags={true} />,
    )
    expect(buf.length).toBeGreaterThan(0)
    expect(overflowWarnings(warn)).toEqual([])
    const pages = countPdfPages(buf)
    expect(pages).toBeGreaterThanOrEqual(3)
    expect(pages).toBeLessThanOrEqual(6)
  })

  it("production-sheet: tag row ALONE (400 chips, well past one page) still FLOWS — zero can't-wrap warnings", async () => {
    const buf = await renderToBuffer(
      <ProductionSheetPdfDocument model={tagStressModel()} imageMap={new Map()} showTags={true} />,
    )
    expect(buf.length).toBeGreaterThan(0)
    expect(overflowWarnings(warn)).toEqual([])
    expect(countPdfPages(buf)).toBeGreaterThan(1) // genuinely spans multiple pages
  })

  it("balanced-rows: tag row ALONE (400 chips, well past one page) still FLOWS — zero can't-wrap warnings", async () => {
    const buf = await renderToBuffer(
      <BalancedRowsPdfDocument model={tagStressModel()} imageMap={new Map()} showTags={true} />,
    )
    expect(buf.length).toBeGreaterThan(0)
    expect(overflowWarnings(warn)).toEqual([])
    expect(countPdfPages(buf)).toBeGreaterThan(1)
  })

  it("the 400-chip fixture actually TRIPS the threshold — showTags ON pages it well past the OFF baseline", async () => {
    // The falsifiability check for the two "row ALONE" cases above: if the tag
    // row were tiny (or never rendered), those cases would pass on a
    // single-page render and prove nothing. Same shape as this file's
    // "16-24 products still fit one page, so wrap={false} never fires" note.
    const on = await renderToBuffer(
      <ProductionSheetPdfDocument model={tagStressModel()} imageMap={new Map()} showTags={true} />,
    )
    const off = await renderToBuffer(
      <ProductionSheetPdfDocument model={tagStressModel()} imageMap={new Map()} />,
    )
    expect(countPdfPages(off)).toBe(1)
    expect(countPdfPages(on)).toBeGreaterThanOrEqual(3)
    expect(countPdfPages(on)).toBeGreaterThan(countPdfPages(off) * 2)
  })

  it("showTags OFF (rollback) renders the IDENTICAL page count whether or not the model carries tags — TagChipRow is never invoked", async () => {
    const withoutField = await renderToBuffer(
      <ProductionSheetPdfDocument model={overflowModel()} imageMap={new Map()} />,
    )
    const withFieldButOff = await renderToBuffer(
      <ProductionSheetPdfDocument model={overflowModelWithTags()} imageMap={new Map()} />,
    )
    expect(countPdfPages(withFieldButOff)).toBe(countPdfPages(withoutField))
    expect(overflowWarnings(warn)).toEqual([])
    // Sharper than page count, which can't tell "never invoked" from "invoked
    // and returned null": the chip LABELS must not appear in the rendered text
    // at all. (BOUNDARY_TAGS' labels are absent from every other field of
    // overflowModel()'s shot.)
    const text = withFieldButOff.toString("latin1")
    expect(text).not.toContain("Flat Lay")
  })
})

// ---------------------------------------------------------------------------
// Tag chips x WS-C-1 image invariants. The tag row adds NO images, so every
// placed-image invariant this file already enforces must hold UNCHANGED with
// the row on — but the row changes where page breaks fall, which is exactly the
// condition that produced the original straddle/shrink defects. Re-running the
// containment + per-band count scan with tags ON is the cheap way to confirm the
// new row didn't reopen that class.
// ---------------------------------------------------------------------------
describe.each(BOUNDARY_SHOT_COUNTS)(
  "recipe PDF boundary scan — %i shots, extras ON *and* tags ON",
  (shotCount) => {
    const model = boundaryModel(shotCount)
    const imageMap = boundaryImageMap(shotCount)

    it("production-sheet: every placed image is still fully on-page and standard-sized", async () => {
      const buf = await renderToBuffer(
        <ProductionSheetPdfDocument
          model={model}
          imageMap={imageMap}
          showAdditionalImages={true}
          showTags={true}
        />,
      )
      const pages = parsePdfPageImages(buf)
      expect(pages.length).toBeGreaterThan(1)
      const totalRects = pages.reduce((n, p) => n + p.rects.length, 0)
      expect(totalRects).toBe(shotCount * 5) // 1 cover + 4 extras per shot, nothing dropped
      expect(findContainmentViolations(pages)).toEqual([])
      expect(findUniformSizeViolations(pages, PRODUCTION_SHEET_STANDARD_HEIGHTS)).toEqual([])
      expect(
        findSizeBandCountMismatches(pages, [
          { label: "cover", heightPt: PRODUCTION_SHEET_STANDARD_HEIGHTS[0], expectedCount: shotCount },
          { label: "extras", heightPt: PRODUCTION_SHEET_STANDARD_HEIGHTS[1], expectedCount: shotCount * 4 },
        ]),
      ).toEqual([])
    })

    it("balanced-rows: every placed image is still fully on-page and standard-sized", async () => {
      const buf = await renderToBuffer(
        <BalancedRowsPdfDocument
          model={model}
          imageMap={imageMap}
          showAdditionalImages={true}
          showTags={true}
        />,
      )
      const pages = parsePdfPageImages(buf)
      expect(pages.length).toBeGreaterThan(1)
      const totalRects = pages.reduce((n, p) => n + p.rects.length, 0)
      expect(totalRects).toBe(shotCount * 5)
      expect(findContainmentViolations(pages)).toEqual([])
      expect(findUniformSizeViolations(pages, BALANCED_ROWS_STANDARD_HEIGHTS)).toEqual([])
      expect(
        findSizeBandCountMismatches(pages, [
          { label: "cover", heightPt: BALANCED_ROWS_STANDARD_HEIGHTS[0], expectedCount: shotCount },
          { label: "extras", heightPt: BALANCED_ROWS_STANDARD_HEIGHTS[1], expectedCount: shotCount * 4 },
        ]),
      ).toEqual([])
    })
  },
)

// ---------------------------------------------------------------------------
// image-led (2026-08-17). This recipe is NOT covered by any other case in this
// file — WS-C excluded it from the extras row precisely because its estimator
// had no term for a second image row. The tag row DOES have one
// (reportPdfHeights.estimateTagRowHeight), so image-led is in scope, and the
// invariant that matters here is the one unique to it: the ESTIMATOR and the
// RENDERER must agree. packShotSheets decides the page count up front from the
// estimate; if the rendered tag row is taller than the estimate charged, the
// plate's tail clips with no warning at all (Column/plate are wrap={false}).
// ---------------------------------------------------------------------------
describe("image-led PDF — tag row renders, paginates from the SAME estimate, and never warns", () => {
  let warn: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {})
  })
  afterEach(() => {
    warn.mockRestore()
  })

  function imageLedTaggedModel(tagCount: number): ReportModel {
    const shots: ReportShot[] = Array.from({ length: 6 }, (_, i) => ({
      id: `il${i}`,
      number: String(i + 1).padStart(2, "0"),
      title: `Image-led Shot ${String(i + 1)}`,
      colorway: "Charcoal / Bone",
      status: "todo",
      gender: "W",
      notes: "Styling note to add a little height.",
      talent: [{ id: `il${i}-t1`, name: "Alexandra Whitfield", img: null }],
      excluded: false,
      hasImage: false,
      looks: [
        {
          id: `il${i}-l1`,
          label: "Primary",
          isAlt: false,
          image: null,
          hasReference: false,
          products: Array.from({ length: 3 }, (_, p) => boundaryProduct(p)),
        },
      ],
      tags: Array.from({ length: tagCount }, (_, t) => ({
        id: `il${i}-tag-${t}`,
        label: `Tagtoken${String(t)}`,
        category: "other",
      })),
    }))
    return {
      project: { name: "Image-led Tag Fixture", client: "unbound-merino", shotCount: shots.length, dateRange: null },
      groups: [{ key: "W", label: "Women", count: shots.length, shots }],
      order: { sortBy: "shot-number", sortDir: "asc" },
    }
  }

  it("renders the chip labels with showTags ON and none of them with it OFF", async () => {
    const model = imageLedTaggedModel(4)
    const on = await renderToBuffer(<ShotReportPdfDocument model={model} imageMap={new Map()} showTags={true} />)
    const off = await renderToBuffer(<ShotReportPdfDocument model={model} imageMap={new Map()} />)
    // The rendered CONTENT is compressed, so compare extracted text, not bytes.
    expect(extractPdfText(on)).toContain("TAGTOKEN0")
    expect(extractPdfText(off)).not.toContain("TAGTOKEN0")
    expect(overflowWarnings(warn)).toEqual([])
  })

  it("OFF paginates identically whether or not the model carries tags (the estimator term is conditional)", async () => {
    const tagged = await renderToBuffer(<ShotReportPdfDocument model={imageLedTaggedModel(24)} imageMap={new Map()} />)
    const untagged = await renderToBuffer(<ShotReportPdfDocument model={imageLedTaggedModel(0)} imageMap={new Map()} />)
    expect(countPdfPages(tagged)).toBe(countPdfPages(untagged))
  })

  it("a chip-heavy plate costs REAL pages with the toggle on — the estimator is wired into packShotSheets", async () => {
    const model = imageLedTaggedModel(60)
    const on = await renderToBuffer(<ShotReportPdfDocument model={model} imageMap={new Map()} showTags={true} />)
    const off = await renderToBuffer(<ShotReportPdfDocument model={model} imageMap={new Map()} />)
    expect(countPdfPages(on)).toBeGreaterThan(countPdfPages(off))
    expect(overflowWarnings(warn)).toEqual([])
  })
})
