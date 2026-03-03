import type { ScheduleEntry } from "@/shared/types"

// ─── Types ────────────────────────────────────────────────────────────

export interface BlockColorVars {
  /** CSS custom property value for the left border color. */
  readonly borderColorVar: string
  /** CSS custom property value for the background tint. */
  readonly bgColorVar: string
}

// ─── Entry color key ──────────────────────────────────────────────────
//
// Maps to `--color-entry-{key}-border` and `--color-entry-{key}-bg`
// defined in tokens.css (both light + dark variants).

type EntryColorKey = "setup" | "shooting" | "hmu" | "meal" | "travel" | "banner" | "shot"

function toVars(key: EntryColorKey): BlockColorVars {
  return {
    borderColorVar: `var(--color-entry-${key}-border)`,
    bgColorVar:     `var(--color-entry-${key}-bg)`,
  }
}

// ─── Banner label classifier ───────────────────────────────────────────

function classifyBannerLabel(title: string): EntryColorKey {
  const lower = title.toLowerCase().trim()

  if (lower.includes("setup") || lower.includes("set up") || lower.includes("prep")) {
    return "setup"
  }
  if (lower.includes("shoot") || lower.includes("camera") || lower.includes("rolling")) {
    return "shooting"
  }
  if (lower.includes("hmu") || lower.includes("hair") || lower.includes("makeup") || lower.includes("styling")) {
    return "hmu"
  }
  if (
    lower.includes("lunch") ||
    lower.includes("meal") ||
    lower.includes("break") ||
    lower.includes("dinner") ||
    lower.includes("breakfast") ||
    lower.includes("catering")
  ) {
    return "meal"
  }
  if (lower.includes("travel") || lower.includes("move") || lower.includes("transit") || lower.includes("transport")) {
    return "travel"
  }

  return "banner"
}

// ─── Public API ───────────────────────────────────────────────────────

/**
 * Returns CSS variable references for left-border color and background tint
 * based on entry type and (for banners) the banner label/title.
 *
 * The variables are defined in tokens.css with both light and dark variants,
 * so dark mode is automatically handled.
 */
export function getBlockColors(entry: ScheduleEntry): BlockColorVars {
  if (entry.type !== "banner") {
    return toVars("shot")
  }
  return toVars(classifyBannerLabel(entry.title))
}
