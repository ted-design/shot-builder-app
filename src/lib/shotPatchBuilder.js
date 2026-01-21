/**
 * Shot Patch Builder
 *
 * Pure functions for building shot document patches.
 * Extracted for testability and to prevent regressions like
 * bidirectional notes/description sync bugs.
 */

/**
 * Applies HTML sanitization to notes/description fields in a shot patch.
 *
 * INVARIANT: This function must NEVER cross-assign notes↔description.
 * - If patch has only 'notes', result must NOT include 'description'
 * - If patch has only 'description', result must NOT include 'notes'
 *
 * @param {Object} patch - The raw patch object
 * @param {Function} sanitizer - HTML sanitization function (e.g., sanitizeNotesHtml)
 * @returns {Object} - Patch with sanitized notes/description (if present)
 */
export function applyShotTextFieldSanitization(patch, sanitizer) {
  if (!patch || typeof patch !== "object") {
    return patch;
  }

  const result = { ...patch };

  // Handle description independently - ONLY if it exists in patch
  if (Object.prototype.hasOwnProperty.call(patch, "description")) {
    result.description = sanitizer(patch.description || "");
  }

  // Handle notes independently - ONLY if it exists in patch
  if (Object.prototype.hasOwnProperty.call(patch, "notes")) {
    result.notes = sanitizer(patch.notes || "");
  }

  return result;
}
