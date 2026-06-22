// Shared @react-pdf tokens for the report layouts (image-led / production-sheet
// / balanced-rows). One palette + font map + status set + page geometry so the
// three PDF layouts can't drift. @react-pdf ships only Helvetica/Courier/Times
// built-ins, so the editorial serif maps to Helvetica (matches the rest of the
// export PDFs); the type intentionally differs from screen.

import { getPageDimensionsPt } from "../pageDimensions"
import { mapFontFamilyToPdf } from "../pdf/fontMapping"
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
export const STATUS: Record<
  ReportShot["status"],
  { readonly color: string; readonly label: string }
> = {
  complete: { color: "#16A34A", label: "Shot" },
  in_progress: { color: "#2563EB", label: "In progress" },
  todo: { color: COLOR.textDisabled, label: "To do" },
  on_hold: { color: "#D97706", label: "On hold" },
}

export function has(v: string | null | undefined): v is string {
  return v != null && v.trim() !== ""
}

/** The shot's primary image candidate (looks[0] — the canonical primary, as image-led uses). */
export function primaryLookImage(shot: ReportShot): string | null {
  return shot.looks[0]?.image ?? null
}
