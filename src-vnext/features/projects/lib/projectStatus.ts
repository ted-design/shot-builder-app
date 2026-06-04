/**
 * Shared project-status presentation maps + helpers.
 *
 * Extracted (Phase 2) from the inline duplicates that previously lived in both
 * `ProjectCard.tsx` and `ProjectHomePage.tsx`. Pure / no React — keep it that
 * way so it can be unit-tested without a DOM.
 */

/** StatusBadge color token keyed by `Project.status`. */
export const STATUS_COLORS: Record<string, string> = {
  active: "green",
  completed: "blue",
  archived: "gray",
}

/** Human-readable label keyed by `Project.status`. */
export const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  completed: "Completed",
  archived: "Archived",
}

/** Fallback color for an unknown status. */
const DEFAULT_STATUS_COLOR = "gray"

/** Resolve a StatusBadge color for a status, falling back to gray. */
export function getStatusColor(status: string): string {
  return STATUS_COLORS[status] ?? DEFAULT_STATUS_COLOR
}

/** Resolve a label for a status, falling back to the raw status string. */
export function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status
}

/**
 * Derive the display host from a brief URL (mirrors ProjectCard's briefHost
 * logic): strip a leading `www.` and return `""` for empty / unparseable input.
 */
export function getBriefHost(url: string | null | undefined): string {
  const trimmed = url?.trim() ?? ""
  if (!trimmed) return ""
  try {
    return new URL(trimmed).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}
