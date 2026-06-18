import { textPreview } from "@/shared/lib/textPreview"
import type { Shot } from "@/shared/types"

const NO_TRUNCATE = Number.MAX_SAFE_INTEGER // exports want the full note, not a card preview

// Producer notes for export surfaces: notesAddendum first, legacy `notes` fallback,
// HTML-stripped, untruncated. The app stopped writing `notes` (see NotesSection);
// mirrors getShotNotesPreview so exports match the cards + share page. "" when empty.
export function resolveExportShotNotes(
  shot: Pick<Shot, "notes" | "notesAddendum">,
): string {
  const addendum = textPreview(shot.notesAddendum, NO_TRUNCATE)
  if (addendum) return addendum
  return textPreview(shot.notes, NO_TRUNCATE)
}
