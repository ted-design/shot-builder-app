// @vitest-environment node
//
// REAL @react-pdf render regression gate for the style-number spacing bug
// (2026-08-09). breakLongToken used to inject a literal U+200B between every
// breakable character (/ . ? & = _ - @ + : % # , ;) so @react-pdf could wrap a
// long SKU/URL. On real data every style number came out with stray VISIBLE
// spaces — "W- TP- BU- 1045" — because @react-pdf's non-embedded base-14
// Helvetica/WinAnsi path can't encode U+200B: it silently truncates the
// codepoint to its low byte (0x200B & 0xFF = 0x0B) and draws the WinAnsi glyph
// at 0x0B, which carries the SAME advance width as a real space (verified by
// rendering a real PDF and reading glyph bboxes with PyMuPDF: each inserted
// glyph measured 1.807pt at 6.5pt Helvetica — exactly the space-glyph width).
//
// The fix (reportPdfShared.ts: hyphenateToken / tokenHyphenation) drives
// @react-pdf's `hyphenationCallback` prop instead of pre-processing the
// string. @react-pdf rejoins the callback's parts byte-for-byte when a line
// doesn't need to break, so no glyph is ever inserted for a token that fits.
//
// This test extracts the ACTUAL text-showing operators from the rendered PDF's
// content stream (not the React tree/props — a prop-level test can't see a
// font-encoding bug like this one) and asserts the style number appears as one
// contiguous run. Comment out the `hyphenationCallback` prop + restore
// `breakLongToken(p.style)` in reportPdfProductionSheet.tsx to mutation-check:
// the assertion goes red.
import { describe, it, expect, vi, afterEach } from "vitest"
import { inflateSync } from "node:zlib"
import { renderToBuffer } from "@react-pdf/renderer"
import { ProductionSheetPdfDocument } from "../../../lib/report/reportPdfProductionSheet"
import { BalancedRowsPdfDocument } from "../../../lib/report/reportPdfBalancedRows"
import { TalentPdfDocument } from "../../../lib/report/reportPdfTalent"
import type { ReportModel, ReportShot } from "../../../lib/report/reportTypes"
import { DEFAULT_HEADSHOT_CROP } from "../../../lib/report/talentTypes"
import type { TalentModel } from "../../../lib/report/talentTypes"

/**
 * Minimal PDF text-showing extractor for a base-14 (non-embedded, WinAnsi)
 * @react-pdf render: inflates every FlateDecode stream and runs a tiny
 * token-at-a-time state machine over Tj/TJ operators, concatenating their
 * string operands IN STREAM ORDER (kerning-adjustment numbers inside a TJ
 * array are simply not matched by the tokenizer, so they fall out for free).
 * @react-pdf emits per-glyph HEX strings ("<41>") inside TJ arrays for
 * justified/kerned text — not parenthesized literals — so hex decoding is
 * the primary path; literal-string decoding is kept for any Tj usage.
 * Good enough to prove two adjacent syllables of one style number were
 * drawn with no stray glyph between them — NOT a general PDF parser.
 */
function extractPdfText(buf: Buffer): string {
  const raw = buf.toString("latin1")
  let out = ""
  let searchFrom = 0
  for (;;) {
    const streamAt = raw.indexOf("stream", searchFrom)
    if (streamAt === -1) break
    // Only decode FlateDecode content streams — skip anything else (there are
    // none in these fixtures; imageMap is empty, so no image XObjects).
    const dictStart = raw.lastIndexOf("<<", streamAt)
    const dict = raw.slice(dictStart, streamAt)
    const endAt = raw.indexOf("endstream", streamAt)
    if (endAt === -1) break
    if (dict.includes("/FlateDecode")) {
      // Skip "stream" + EOL (\r\n or \n) to the first data byte.
      let dataStart = streamAt + "stream".length
      if (raw[dataStart] === "\r") dataStart += 1
      if (raw[dataStart] === "\n") dataStart += 1
      let dataEnd = endAt
      if (raw[dataEnd - 1] === "\n") dataEnd -= 1
      if (raw[dataEnd - 1] === "\r") dataEnd -= 1
      const compressed = buf.subarray(dataStart, dataEnd)
      try {
        const content = inflateSync(compressed).toString("latin1")
        out += extractShowTextOps(content)
      } catch {
        /* not a real FlateDecode stream (e.g. a false-positive dict match) — skip */
      }
    }
    searchFrom = endAt + "endstream".length
  }
  return out
}

/** Unescape a PDF literal-string body: \( \) \\ and octal \ddd (ASCII-only fixtures). */
function unescapePdfString(body: string): string {
  return body.replace(/\\([()\\]|[0-7]{1,3})/g, (_m, esc: string) => {
    if (esc === "(" || esc === ")" || esc === "\\") return esc
    return String.fromCharCode(parseInt(esc, 8))
  })
}

/** Decode a PDF hex-string body ("41 52" style bytes, no separators) via WinAnsi≈ASCII. */
function decodeHexString(hex: string): string {
  let s = ""
  for (let i = 0; i < hex.length; i += 2) {
    s += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16))
  }
  return s
}

/**
 * Pull the string operands of every Tj / TJ operator, in stream order. A
 * single flat token regex (no nested repeated groups) avoids catastrophic
 * backtracking; numbers/whitespace inside a TJ array simply don't match any
 * alternative, so `exec` skips past them for free.
 */
function extractShowTextOps(content: string): string {
  let out = ""
  const tokenRe = /<([0-9A-Fa-f]+)>|\(((?:\\.|[^\\()])*)\)|\[|\]|\bTJ\b|\bTj\b/g
  let inArray = false
  let arrayBuf = ""
  let pendingSingle: string | null = null
  let m: RegExpExecArray | null
  while ((m = tokenRe.exec(content)) !== null) {
    const tok = m[0]
    if (m[1] !== undefined) {
      const s = decodeHexString(m[1])
      if (inArray) arrayBuf += s
      else pendingSingle = s
    } else if (m[2] !== undefined) {
      const s = unescapePdfString(m[2])
      if (inArray) arrayBuf += s
      else pendingSingle = s
    } else if (tok === "[") {
      inArray = true
      arrayBuf = ""
    } else if (tok === "]") {
      inArray = false
    } else if (tok === "TJ") {
      out += arrayBuf
      arrayBuf = ""
    } else if (tok === "Tj") {
      if (pendingSingle !== null) out += pendingSingle
      pendingSingle = null
    }
  }
  return out
}

function shotWithStyle(style: string): ReportShot {
  return {
    id: "s1",
    number: "01",
    title: "Style Token Shot",
    colorway: null,
    status: "complete",
    gender: "W",
    notes: null,
    talent: [],
    excluded: false,
    hasImage: false,
    looks: [
      {
        id: "l1",
        label: "Primary",
        isAlt: false,
        image: null,
        hasReference: false,
        products: [
          { family: "Crew", style, colour: "Black", size: "M", sizeScope: "single", qty: 1, gender: "W", isHero: true, img: null },
        ],
      },
    ],
  }
}

function modelWithStyle(style: string): ReportModel {
  return {
    project: { name: "Style Token Fixture", client: "unbound-merino", shotCount: 1, dateRange: null },
    groups: [{ key: "W", label: "Women", count: 1, shots: [shotWithStyle(style)] }],
    order: { sortBy: "shot-number", sortDir: "asc" },
  }
}

const STYLE = "W-TP-LS-1066"

describe("recipe PDF style-number spacing — a typical style # must render as ONE unbroken token", () => {
  // console.warn is spied per-test (not module-level) so each `it` restores its
  // own spy — but the restore must run AFTER the assertions read warn.mock.calls,
  // never before (mockRestore clears recorded calls, same as mockReset). Mirrors
  // reportRecipeOverflow.test.tsx's beforeEach/afterEach shape.
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("production-sheet: extracted PDF text contains the style number contiguously, no inserted space", async () => {
    const buf = await renderToBuffer(
      <ProductionSheetPdfDocument model={modelWithStyle(STYLE)} imageMap={new Map()} />,
    )
    const text = extractPdfText(buf)
    // toContain requires an EXACT contiguous substring match. The pre-fix
    // breakLongToken broke this: it drew "W-" then a stray glyph then "TP-"
    // etc as separate runs, so the joined content-stream text read
    // "W-\x0bTP-\x0bLS-\x0b1066" — this assertion goes red on that code
    // (mutation-verified: reverting to breakLongToken(p.style) fails here).
    expect(text).toContain(STYLE)
  })

  it("balanced-rows: extracted PDF text contains the style number contiguously, no inserted space", async () => {
    const buf = await renderToBuffer(
      <BalancedRowsPdfDocument model={modelWithStyle(STYLE)} imageMap={new Map()} />,
    )
    const text = extractPdfText(buf)
    expect(text).toContain(STYLE)
  })

  it("a pathologically long style number (the #508 overflow scenario) still renders with no can't-wrap warning", async () => {
    const long = "PATHOLOGICALLY-LONG-STYLE-NUMBER-THAT-EXCEEDS-THE-COLUMN-WIDTH-1234567890"
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const buf = await renderToBuffer(
      <ProductionSheetPdfDocument model={modelWithStyle(long)} imageMap={new Map()} />,
    )
    expect(buf.length).toBeGreaterThan(0)
    // Read warn.mock.calls BEFORE any restore — vi.restoreAllMocks() in
    // afterEach clears recorded calls (mockRestore ≡ mockReset + restore), so
    // reading them here (not after an inline mockRestore()) is what makes this
    // assertion falsifiable at all.
    const overflowWarning = warn.mock.calls
      .map((call) => call.map((a) => String(a)).join(" "))
      .some((line) => /can't wrap between pages|bigger than available page height/i.test(line))
    expect(overflowWarning).toBe(false)
    // Every character of the long token must still reach the page (flowed
    // across wrapped lines within its column), not silently dropped.
    const text = extractPdfText(buf)
    for (const chunk of long.split("-")) {
      expect(text).toContain(chunk)
    }
  })
})

// ---------------------------------------------------------------------------
// M2 — long-token coverage for the other two hyphenationCallback call sites
// (BalancedRowsPdfDocument's style column, TalentPdfDocument's contact-value
// email). The style-number cases above only exercised production-sheet's long
// token; the M1 doubled-hyphen fix lives in the SHARED hyphenateToken, so a
// wrap anywhere it's wired must never draw "--" or an unencodable U+000B.
// Mutation check: reverting hyphenateToken's head-emission to the old
// tail-emission (break char stays at the END of the preceding syllable)
// reddens both — a wrap lands on a syllable already ending in "-", drawing a
// second "-" right after it.
// ---------------------------------------------------------------------------

function talentModelWithEmail(email: string): TalentModel {
  return {
    project: { name: "Talent Contact Fixture", client: "unbound-merino", dateRange: null, talentCount: 1 },
    groups: [
      {
        key: "W",
        label: "Women",
        count: 1,
        items: [
          {
            id: "t1",
            name: "Contact Value Talent",
            gender: "W",
            genderLabel: "Women",
            agency: "Long Agency Co.",
            email,
            phone: null,
            web: null,
            headshot: null,
            measurements: [],
            excluded: false,
            appears: [],
            crop: DEFAULT_HEADSHOT_CROP,
          },
        ],
      },
    ],
    layout: "detail",
  }
}

describe("recipe PDF style-number spacing — M2 coverage for the other two hyphenationCallback call sites", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("balanced-rows: a pathologically long style number still renders with no can't-wrap warning, no reintroduced U+000B, and every chunk reaches the page", async () => {
    // NOTE on what this can and can't prove: this token is intentionally long
    // enough to wrap across SEVERAL physical lines in the style column. Once
    // a wrap happens, @react-pdf/textkit draws its own "-" glyph as a
    // SEPARATE text-showing op that closes that physical line, and the next
    // line opens with the following syllable's own leading "-" — two
    // genuinely different glyphs on two different lines, correct output. Our
    // extractor only concatenates Tj/TJ operators in STREAM order with no
    // line-boundary awareness (see its docstring: "NOT a general PDF
    // parser"), so it flattens those two lines together and reports a
    // same-string "--" for EVERY multi-line-wrapped token regardless of
    // whether the fix is applied or reverted (verified empirically against
    // both the fixed and pre-fix production-sheet renders — 5 "--" hits
    // either way) — a `not.toContain("--")` assertion here would be a false
    // positive on the extractor, not a real check. The unit-level "never
    // draws two adjacent hyphens across a wrap point" test in
    // reportPdfShared.test.ts covers the SAME-LINE doubling property
    // directly, is genuinely falsifiable by reverting M1's head-emission,
    // and doesn't share this blind spot. What real-render coverage on the
    // wide/pathological case for THIS layout can still prove — and is worth
    // proving, since balanced-rows wasn't exercised by the #508 overflow
    // suite: no page-overflow warning, no reintroduced U+000B, no content lost.
    const long = "PATHOLOGICALLY-LONG-STYLE-NUMBER-THAT-EXCEEDS-THE-COLUMN-WIDTH-1234567890"
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const buf = await renderToBuffer(
      <BalancedRowsPdfDocument model={modelWithStyle(long)} imageMap={new Map()} />,
    )
    expect(buf.length).toBeGreaterThan(0)
    const overflowWarning = warn.mock.calls
      .map((call) => call.map((a) => String(a)).join(" "))
      .some((line) => /can't wrap between pages|bigger than available page height/i.test(line))
    expect(overflowWarning).toBe(false)
    const text = extractPdfText(buf)
    // The OLD U+200B-injection bug's signature glyph (truncated to 0x0B) is a
    // real character inserted INTO the string, independent of line wrapping —
    // this check has no cross-line blind spot and would catch a regression
    // to the pre-fix breakLongToken path.
    expect(text).not.toContain("\u000B")
    for (const chunk of long.split("-")) {
      expect(text).toContain(chunk)
    }
  })

  it("balanced-rows: a realistic long style number that still fits on one line round-trips byte-identical (no drawn hyphen at all)", async () => {
    // Longer than the file's existing STYLE fixture ("W-TP-LS-1066", 12
    // chars) but still under the style column's empirically-measured
    // single-line budget (~20 chars of Helvetica-Bold at this column width —
    // verified: a run of 20 "A"s still fits, 22 wraps), so unlike the
    // pathological case above, a flattened-text "--" check here IS valid: no
    // wrap means no drawn glyph, so the extracted text must equal the input
    // exactly.
    const long = "W-TP-LS-BLACK-1066"
    const buf = await renderToBuffer(
      <BalancedRowsPdfDocument model={modelWithStyle(long)} imageMap={new Map()} />,
    )
    const text = extractPdfText(buf)
    expect(text).toContain(long)
    expect(text).not.toContain("--")
    expect(text).not.toContain("\u000B")
  })

  it("talent: a long agency email in a contact value renders with no '--' and no U+000B", async () => {
    const long = "alexandra.whitfield-representation@a-very-long-talent-agency-domain-name.example.com"
    const buf = await renderToBuffer(
      <TalentPdfDocument model={talentModelWithEmail(long)} imageMap={new Map()} />,
    )
    expect(buf.length).toBeGreaterThan(0)
    const text = extractPdfText(buf)
    expect(text).not.toContain("--")
    expect(text).not.toContain("\u000B")
    // A short email (well under the column width) must still round-trip
    // contiguously — the byte-identity guarantee for a fitting token.
    const shortBuf = await renderToBuffer(
      <TalentPdfDocument model={talentModelWithEmail("a@b.com")} imageMap={new Map()} />,
    )
    const shortText = extractPdfText(shortBuf)
    expect(shortText).toContain("a@b.com")
  })
})
