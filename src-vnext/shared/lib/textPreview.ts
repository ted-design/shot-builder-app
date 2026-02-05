/**
 * Converts an HTML string to a plain-text preview suitable for card summaries.
 * Strips tags, decodes common entities, collapses whitespace, and truncates.
 */
export function textPreview(html: string | undefined | null, maxLength = 120): string {
  if (!html) return ""

  const stripped = html
    .replace(/<[^>]*>/g, " ")        // strip HTML tags
    .replace(/&amp;/g, "&")          // decode common entities
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")            // collapse whitespace
    .trim()

  if (stripped.length <= maxLength) return stripped
  return stripped.slice(0, maxLength).trimEnd() + "\u2026"
}
