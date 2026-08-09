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

// Canonical labels (statusMappings.ts) — used by the production-sheet + balanced-rows PDFs.
export const STATUS: Record<
  ReportShot["status"],
  { readonly color: string; readonly label: string }
> = {
  complete: { color: STATUS_COLOR.complete, label: getShotStatusLabel("complete") },
  in_progress: { color: STATUS_COLOR.in_progress, label: getShotStatusLabel("in_progress") },
  todo: { color: STATUS_COLOR.todo, label: getShotStatusLabel("todo") },
  on_hold: { color: STATUS_COLOR.on_hold, label: getShotStatusLabel("on_hold") },
}

// Original image-led PDF labels — keeps the shipped report byte-identical.
export const STATUS_LEGACY: Record<
  ReportShot["status"],
  { readonly color: string; readonly label: string }
> = {
  complete: { color: STATUS_COLOR.complete, label: "Shot" },
  in_progress: { color: STATUS_COLOR.in_progress, label: "In progress" },
  todo: { color: STATUS_COLOR.todo, label: "To do" },
  on_hold: { color: STATUS_COLOR.on_hold, label: "On hold" },
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
 * real line break (with a drawn hyphen, same as dictionary hyphenation).
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
  let run = 0
  for (const ch of word) {
    current += ch
    run += 1
    if (BREAKABLE.has(ch) || run >= chunk) {
      parts.push(current)
      current = ""
      run = 0
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

/** The shot's primary image candidate (looks[0] — the canonical primary, as image-led uses). */
export function primaryLookImage(shot: ReportShot): string | null {
  return shot.looks[0]?.image ?? null
}
