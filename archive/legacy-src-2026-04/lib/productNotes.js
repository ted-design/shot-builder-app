/**
 * Product Notes Display Helper
 *
 * Handles the product notes field which may be:
 * - An array of structured note objects: [{id, text, createdAt}, ...]
 * - A legacy string (for backward compatibility)
 * - null/undefined
 *
 * Notes may contain HTML markup from rich text editors. This helper strips
 * HTML and returns plain text suitable for non-editor display surfaces.
 *
 * IMPORTANT: This helper is the SINGLE source of truth for rendering product
 * notes as plain text. All non-editor surfaces MUST use this helper.
 *
 * EDITOR-ONLY HTML RULE: Outside of rich text editors, product notes MUST be
 * rendered through this helper. Never render family.notes directly in JSX.
 */

import { stripHtml } from "./stripHtml";

/**
 * Extract display text from product notes, stripping HTML.
 *
 * @param {Array|string|null|undefined} notes - The notes field from a product family
 * @returns {string} - Plain text representation for display (HTML stripped)
 */
export function getProductNotesText(notes) {
  // Handle null/undefined
  if (!notes) return "";

  let result = "";

  // Handle legacy string format - strip HTML
  if (typeof notes === "string") {
    result = stripHtml(notes);
  }
  // Handle structured array format
  else if (Array.isArray(notes)) {
    // Filter to entries with text, strip HTML from each, and join
    const textParts = notes
      .filter((entry) => entry && typeof entry.text === "string" && entry.text.trim())
      .map((entry) => stripHtml(entry.text))
      .filter((text) => text.length > 0);

    result = textParts.join("\n\n");
  }
  // Unexpected shape - log warning in dev only, return empty
  else {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[productNotes] Unexpected notes shape:",
        typeof notes,
        notes
      );
    }
    return "";
  }

  // Dev-only guardrail: warn if HTML tags leaked through stripHtml
  if (process.env.NODE_ENV === "development" && result.includes("<")) {
    console.warn(
      "[productNotes] HTML may have leaked through projection. " +
        "Check stripHtml implementation. Preview:",
      result.slice(0, 100)
    );
  }

  return result;
}
