import { describe, it, expect } from "vitest"
import { hyphenateToken, tokenHyphenation } from "../reportPdfShared"

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

  it("splits at every breakable character, keeping it attached to the preceding syllable", () => {
    expect(hyphenateToken("W-TP-LS-1066")).toEqual(["W-", "TP-", "LS-", "1066"])
  })

  it("splits at each of the / . ? & = _ - @ + : % # , ; break characters", () => {
    expect(hyphenateToken("a/b.c?d&e=f_g@h+i:j%k#l,m;n")).toEqual([
      "a/", "b.", "c?", "d&", "e=", "f_", "g@", "h+", "i:", "j%", "k#", "l,", "m;", "n",
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
    expect(tokenHyphenation("W-TP-LS-1066")).toEqual(["W-", "TP-", "LS-", "1066"])
  })
})
