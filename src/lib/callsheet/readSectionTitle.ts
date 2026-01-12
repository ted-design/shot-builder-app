import type { CallSheetSection } from "../../types/callsheet";

/**
 * Reads the display title for a call sheet section.
 * Returns config.title if it's a non-empty string, otherwise returns the fallback.
 */
export function readSectionTitle(
  section: CallSheetSection | null | undefined,
  fallback: string
): string {
  const raw = (section?.config as Record<string, unknown> | undefined)?.title;
  const title = typeof raw === "string" ? raw.trim() : "";
  return title || fallback;
}
