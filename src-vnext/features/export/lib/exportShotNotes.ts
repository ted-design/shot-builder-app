import { textPreview } from "@/shared/lib/textPreview"
import type { Shot } from "@/shared/types"

/** textPreview truncates to a card-preview length by default; exports want the
 *  full note, so we pass an effectively-unbounded max. */
const NO_TRUNCATE = Number.MAX_SAFE_INTEGER

/**
 * Resolve the producer-facing notes text for export surfaces.
 *
 * The app writes producer notes to `notesAddendum`; `shot.notes` is a legacy
 * HTML field that is never written anymore (see `NotesSection`). Every other
 * read surface — shot cards (`getShotNotesPreview`) and the public share page —
 * prioritizes `notesAddendum`; the export was the lone outlier reading the dead
 * `notes` field, so shots that visibly had notes exported blank.
 *
 * This mirrors `getShotNotesPreview` (notesAddendum first, legacy notes
 * fallback) but without the preview-length truncation, and always strips HTML
 * so legacy markup never leaks into a table cell or PDF. Returns `""` when there
 * are no notes.
 */
export function resolveExportShotNotes(
  shot: Pick<Shot, "notes" | "notesAddendum">,
): string {
  const addendum = textPreview(shot.notesAddendum, NO_TRUNCATE)
  if (addendum) return addendum
  return textPreview(shot.notes, NO_TRUNCATE)
}
