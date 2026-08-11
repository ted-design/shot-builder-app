import { describe, it, expect } from "vitest"
import { hyphenateToken, resolveAdditionalImageSrcs, tokenHyphenation } from "../reportPdfShared"

// hyphenateToken feeds @react-pdf's hyphenationCallback (see reportPdfShared.ts
// for the full root-cause writeup). The property that matters: rejoining the
// returned parts must reproduce the INPUT BYTE-FOR-BYTE — @react-pdf only uses
// the parts to decide where a real line break MAY fall; it never inserts a
// separator of its own. That's what makes this approach immune to the old
// U+200B bug (a real, non-representable glyph injected into the string).
describe("hyphenateToken", () => {
  it("rejoins to the exact original string for a typical style number (no inserted characters)", () => {
    const token = "W-TP-LS-1066"
    expect(hyphenateToken(token).join("")).toBe(token)
  })

  it("splits at every breakable character, keeping it attached to the FOLLOWING syllable (M1 fix — see reportPdfShared.ts docstring: @react-pdf/textkit draws an unconditional real hyphen at any syllable-boundary wrap, so a break char left at the tail of a syllable would double up with it)", () => {
    expect(hyphenateToken("W-TP-LS-1066")).toEqual(["W", "-TP", "-LS", "-1066"])
  })

  it("splits at each of the / . ? & = _ - @ + : % # , ; break characters", () => {
    expect(hyphenateToken("a/b.c?d&e=f_g@h+i:j%k#l,m;n")).toEqual([
      "a", "/b", ".c", "?d", "&e", "=f", "_g", "@h", "+i", ":j", "%k", "#l", ",m", ";n",
    ])
  })

  it("falls back to a hard chunk break for a run with no breakable character at all", () => {
    const parts = hyphenateToken("12345678901234567890", 14)
    expect(parts.join("")).toBe("12345678901234567890")
    expect(parts.length).toBeGreaterThan(1)
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(14)
  })

  it("a pathologically long token (the #508 overflow scenario) still yields multiple syllables", () => {
    const long = "PATHOLOGICALLY-LONG-STYLE-NUMBER-THAT-EXCEEDS-THE-COLUMN-WIDTH-1234567890"
    const parts = hyphenateToken(long)
    expect(parts.join("")).toBe(long)
    expect(parts.length).toBeGreaterThan(5)
  })

  it("never returns an empty syllable list (the Knuth-Plass engine requires at least one)", () => {
    expect(hyphenateToken("")).toEqual([""])
  })

  it("tokenHyphenation exposes hyphenateToken as a mutable string[] (the @react-pdf HyphenationCallback contract)", () => {
    expect(tokenHyphenation("W-TP-LS-1066")).toEqual(["W", "-TP", "-LS", "-1066"])
  })

  it("never draws two adjacent hyphens across a wrap point (M1): no syllable both ends AND the next syllable starts with a breakable char", () => {
    // The doubling bug required a syllable ending in a breakable char
    // immediately followed by @react-pdf's own drawn hyphen. Head-emission
    // means only the FIRST syllable can lack a leading breakable char; every
    // other syllable starts with one and none end with one, so a wrap can
    // never produce "--".
    const parts = hyphenateToken("W-TP-LS-1066")
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]!
      if (i > 0) expect(BREAKABLE_FOR_TEST.has(p[0]!)).toBe(true)
      expect(BREAKABLE_FOR_TEST.has(p[p.length - 1]!)).toBe(false)
    }
  })
})

// Mirrors reportPdfShared.ts's private BREAKABLE set for the assertion above
// (not exported — small enough to duplicate rather than export test-only surface).
const BREAKABLE_FOR_TEST = new Set([
  "/", ".", "?", "&", "=", "_", "-", "@", "+", ":", "%", "#", ",", ";",
])

// resolveAdditionalImageSrcs (WS-C, 2026-08-11) — the PDF-recipe TWIN of
// components/report/reportShared.ts's function of the same name (the DOM
// recipes' resolver). Byte-identical implementations; this file previously
// tested only hyphenateToken/tokenHyphenation, so the drop-vs-placeholder
// rule below — the behaviour that deliberately differs from the cover
// thumbnail's fixed-slot placeholder — was asserted on the DOM side only
// (reportShared.test.ts) and could drift silently on this twin. Mirrors
// reportShared.test.ts's cases exactly.
describe("resolveAdditionalImageSrcs (PDF copy)", () => {
  it("resolves every candidate present in the map, in order", () => {
    const map = new Map([
      ["a", "src-a"],
      ["b", "src-b"],
    ])
    expect(resolveAdditionalImageSrcs(map, ["a", "b"])).toEqual(["src-a", "src-b"])
  })

  it("drops a candidate with no resolved src instead of rendering an empty slot", () => {
    const map = new Map([["a", "src-a"]])
    expect(resolveAdditionalImageSrcs(map, ["a", "missing", "b"])).toEqual(["src-a"])
  })

  it("returns [] for undefined or empty candidates — no crash", () => {
    expect(resolveAdditionalImageSrcs(new Map(), undefined)).toEqual([])
    expect(resolveAdditionalImageSrcs(new Map(), [])).toEqual([])
  })
})
