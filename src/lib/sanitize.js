import DOMPurify from "dompurify";

// Legacy color constants (kept for backward compatibility)
export const allowedNoteColors = ["#1f2937", "#6366f1", "#10b981", "#f43f5e", "#0f172a"];

// DOMPurify configuration for rich text notes
// This matches the configuration in RichTextEditor.jsx to ensure consistency
const DOMPURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'span', 'div', 'strong', 'em', 'b', 'i', 'u', 's', 'code', 'pre',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'blockquote',
    'a', 'img',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'hr',
    'sub', 'sup'
  ],
  ALLOWED_ATTR: [
    'class',
    'style',
    'href',
    'target',
    'rel',
    'src',
    'alt',
    'width',
    'height',
    'colspan',
    'rowspan',
  ],
  ALLOW_DATA_ATTR: true,
  KEEP_CONTENT: true,
};

export const sanitizeNotesHtml = (input) => {
  if (!input) return "";
  if (typeof window === "undefined") return String(input);

  // Use DOMPurify for consistent, secure sanitization
  return DOMPurify.sanitize(input, DOMPURIFY_CONFIG);
};

export const formatNotesForDisplay = (input) => {
  const source = input ? input.toString() : "";
  const enriched = source.includes("<") ? source : source.replace(/\n/g, "<br />");
  const sanitized = sanitizeNotesHtml(enriched);
  return sanitized || "";
};
