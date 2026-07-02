// Shared spec-level tokens for the canonical report primitives. StatusChip /
// HoldFlag / HeroMark / UnresolvedBadge all resolve their colors from THIS one
// place, so the DOM and @react-pdf adapters can't drift on the palette.
//
// STATUS_COLOR is module-PRIVATE in reportPdfShared.ts (not exported) — but the
// exported STATUS record carries `.color` per status, so we re-resolve the
// reserved dot palette from it rather than re-hardcoding hexes here.

import { STATUS } from "../reportPdfShared"
import type { ReportShotStatus } from "../reportTypes"

// PDF status dot colors — reserved green/amber/blue/gray, on_hold AMBER, never
// red. Re-resolved from the shared STATUS record so the palette is single-sourced.
export const STATUS_DOT_PT: Record<ReportShotStatus, string> = {
  complete: STATUS.complete.color, // #16A34A
  in_progress: STATUS.in_progress.color, // #2563EB
  todo: STATUS.todo.color, // #A1A1AA
  on_hold: STATUS.on_hold.color, // #D97706 (AMBER)
}

// DOM status dot class names (existing shipped CSS, unchanged) — the DOM side
// re-uses the shipped `.sb-status--*` rules so DOM color stays byte-identical
// (OKLCH) on a real page.
export const STATUS_DOT_CLASS: Record<ReportShotStatus, string> = {
  complete: "sb-status--complete",
  in_progress: "sb-status--progress",
  todo: "sb-status--todo",
  on_hold: "sb-status--hold",
}

// DOM status dot colors as canonical OKLCH tokens — the values the shipped
// `.sb-status--*` classes paint. jsdom does NOT resolve class colors to inline
// `.style` (no stylesheet in the parity mock) and keeps `oklch(...)` verbatim,
// so StatusChip's DOM adapter renders these as an inline `background` for the
// parity test to read (belt-and-suspenders with the class above).
export const STATUS_DOT_OKLCH: Record<ReportShotStatus, string> = {
  complete: "oklch(0.62 0.13 150)",
  in_progress: "oklch(0.62 0.13 240)",
  todo: "oklch(0.72 0.008 55)", // === --sb-ink-disabled
  on_hold: "oklch(0.74 0.14 75)", // AMBER
}

// The ONE sanctioned red (HoldFlag only).
export const HOLD_RED_HEX = "#EB1400" // PDF: === COLOR.accent
export const HOLD_RED_VAR = "var(--sb-red)" // DOM

// Canonical ink (HeroMark tag/dot, UnresolvedBadge border + text).
export const INK_HEX = "#18181B" // PDF: === COLOR.text
export const INK_VAR = "var(--sb-ink)" // DOM
