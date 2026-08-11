// Shared @react-pdf tokens for the report layouts (image-led / production-sheet
// / balanced-rows). One palette + font map + status set + page geometry so the
// three PDF layouts can't drift. @react-pdf ships only Helvetica/Courier/Times
// built-ins, so the editorial serif maps to Helvetica (matches the rest of the
// export PDFs); the type intentionally differs from screen.

import type { HyphenationCallback } from "@react-pdf/types"
import { getPageDimensionsPt } from "../pageDimensions"
import { mapFontFamilyToPdf } from "../pdf/fontMapping"
import { getShotStatusLabel } from "@/shared/lib/statusMappings"
import type { ReportShot } from "./reportTypes"

export const COLOR = {
  surface: "#FFFFFF",
  surfaceSubtle: "#F4F4F5",
  text: "#18181B",
  textSecondary: "#52525B",
  textSubtle: "#5B5B60",
  textDisabled: "#A1A1AA", // placeholder only
  accent: "#EB1400", // Immediate Red — the ONE decisive job per layout
  accentInk: "#B3261E", // muted red-ink (≈ DOM --sb-red-ink) for non-decisive marks (unresolved badge)
  rule: "#E4E4E7",
  ruleStrong: "#D4D4D8",
} as const

export const FONT = {
  display: mapFontFamilyToPdf(undefined, true), // Helvetica-Bold
  displayRegular: mapFontFamilyToPdf(undefined), // Helvetica
  body: mapFontFamilyToPdf(undefined), // Helvetica
  bodyItalic: mapFontFamilyToPdf(undefined, false, true), // Helvetica-Oblique
  ui: mapFontFamilyToPdf(undefined), // Helvetica
  uiBold: mapFontFamilyToPdf(undefined, true), // Helvetica-Bold
} as const

export const PAGE = getPageDimensionsPt("letter", "landscape") // 792 x 612 pt

// Status dot colors — green/amber/blue/gray reserved set (no red here; red is
// each layout's one job).
const STATUS_COLOR: Record<ReportShot["status"], string> = {
  complete: "#16A34A",
  in_progress: "#2563EB",
  todo: COLOR.textDisabled,
  on_hold: "#D97706",
}

// Canonical labels (statusMappings.ts) — used by all three PDF layouts
// (image-led, production-sheet, balanced-rows). No per-layout label exception.
export const STATUS: Record<
  ReportShot["status"],
  { readonly color: string; readonly label: string }
> = {
  complete: { color: STATUS_COLOR.complete, label: getShotStatusLabel("complete") },
  in_progress: { color: STATUS_COLOR.in_progress, label: getShotStatusLabel("in_progress") },
  todo: { color: STATUS_COLOR.todo, label: getShotStatusLabel("todo") },
  on_hold: { color: STATUS_COLOR.on_hold, label: getShotStatusLabel("on_hold") },
}

export function has(v: string | null | undefined): v is string {
  return v != null && v.trim() !== ""
}

const BREAKABLE = new Set(["/", ".", "?", "&", "=", "_", "-", "@", "+", ":", "%", "#", ",", ";"])

/**
 * Split a long token (SKU/URL) into hyphenation "syllables" at natural break
 * characters (/ . ? & = _ - @ + : % # , ;), plus a hard chunk fallback for a
 * run with no breakable character at all (e.g. a bare numeric ID). Feeds
 * @react-pdf's hyphenationCallback (see tokenHyphenation below) — NOT string
 * injection. @react-pdf rejoins these parts byte-for-byte when a line doesn't
 * need to break, so a typical token (up to ~16 chars) always renders as one
 * contiguous run; only a token that's actually too wide for its column gets a
 * real line break.
 *
 * IMPORTANT — @react-pdf/textkit draws a REAL "-" (U+002D) glyph at every
 * wrap it takes at a syllable boundary. This is unconditional: `breakLines`
 * (textkit's line-break executor) calls `insertGlyph(line.length, HYPHEN,
 * line)` for any break whose preceding syllable isn't followed by a literal
 * space, with no way to opt a specific break out of it. So the break
 * character MUST be the first character of the FOLLOWING syllable, never the
 * last character of the preceding one — otherwise the natural break char
 * (already present in the token) collides with textkit's own drawn hyphen and
 * doubles: syllables ending "...W-", "TP-", ... would render
 * "W--TP--LS--1066" wherever a wrap actually lands. Emitting the break char
 * at the head of the next part instead — "W", "-TP", "-LS", "-1066" — means a
 * wrap after "W" draws its hyphen there ("W-") and the following line starts
 * clean with the token's own "-TP..."; no double hyphen ON THE SAME LINE, and
 * no spurious "-" gets inserted next to a "@" or "." in a talent email/URL
 * either. Verified two ways (see reportPdfShared.test.ts + the render suite
 * reportRecipeStyleTokenSpacing.test.tsx): a unit-level check that no
 * syllable both ends AND the next syllable starts with a breakable char
 * (so a same-line "--" is structurally impossible), and a real
 * renderToBuffer + content-stream text extraction confirming a token that
 * FITS on one line (no wrap at all) round-trips byte-for-byte with no "--".
 * A token forced to wrap across MULTIPLE physical lines is not checked this
 * way — the flattened extractor concatenates separate lines' text runs with
 * no line-boundary awareness, so it reports a same-string "--" at every wrap
 * regardless of whether this fix is applied (that's an extractor blind spot,
 * not a rendering defect — the unit-level check above is what actually
 * proves the same-line property for that case).
 *
 * Previously this injected a literal U+200B between every breakable character.
 * That broke on real data: @react-pdf's non-embedded base-14 Helvetica path
 * (WinAnsiEncoding, no ToUnicode/embedded glyphs) can't encode U+200B, so it
 * silently truncated the codepoint to its low byte (0x200B & 0xFF = 0x0B) and
 * rendered the WinAnsi glyph living at 0x0B — which carries the SAME advance
 * width as a real space (~278/1000 em; measured via a real renderToBuffer PDF
 * inspected with PyMuPDF: 1.807pt at 6.5pt Helvetica, matching the space
 * glyph exactly). Every breakable character printed a visible gap, e.g.
 * "W-TP-LS-1066" rendered as "W- TP- LS- 1066". hyphenationCallback never
 * inserts a glyph into the unbroken case, so it can't reproduce that bug.
 */
export function hyphenateToken(word: string, chunk = 14): readonly string[] {
  const parts: string[] = []
  let current = ""
  for (const ch of word) {
    // A breakable char starts the NEXT syllable (not ends this one) — see the
    // doubled-hyphen note above. Guard current.length>0 so a token that opens
    // with a breakable char (rare; e.g. a leading "-") doesn't emit a
    // leading empty syllable.
    if (BREAKABLE.has(ch) && current.length > 0) {
      parts.push(current)
      current = ch
      continue
    }
    current += ch
    if (current.length >= chunk) {
      parts.push(current)
      current = ""
    }
  }
  if (current) parts.push(current)
  // linebreak's Knuth–Plass engine requires at least one syllable.
  return parts.length > 0 ? parts : [word]
}

/** @react-pdf hyphenationCallback for a Text element that renders a raw
 *  SKU/URL/token (style numbers, talent contact values). Pass as the
 *  `hyphenationCallback` prop on that Text — do NOT pre-process the string. */
export const tokenHyphenation: HyphenationCallback = (word) => [...hyphenateToken(word)]

/** The shot's primary image candidate (looks[0] — the canonical primary, as image-led uses).
 *  Already hero-first (see reportModel.ts's resolveLooks) — no changes needed here. */
export function primaryLookImage(shot: ReportShot): string | null {
  return shot.looks[0]?.image ?? null
}

/** Resolve a shot's additional-images candidates (WS-C) to usable srcs via the
 *  image sidecar. A candidate with no resolved src (a failed per-image fetch)
 *  is simply dropped — there's no fixed slot to fill for an optional extra. */
export function resolveAdditionalImageSrcs(
  imageMap: ReadonlyMap<string, string>,
  candidates: readonly string[] | undefined,
): readonly string[] {
  if (!candidates || candidates.length === 0) return []
  const out: string[] = []
  for (const c of candidates) {
    const src = imageMap.get(c)
    if (src) out.push(src)
  }
  return out
}
