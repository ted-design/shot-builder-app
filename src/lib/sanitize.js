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
  ALLOWED_ATTR: {
    'span': ['class', 'style', 'data-*'],
    'p': ['class', 'style'],
    'div': ['class', 'style'],
    'h1': ['class', 'style'],
    'h2': ['class', 'style'],
    'h3': ['class', 'style'],
    'h4': ['class', 'style'],
    'h5': ['class', 'style'],
    'h6': ['class', 'style'],
    'strong': ['class', 'style'],
    'em': ['class', 'style'],
    'b': ['class', 'style'],
    'i': ['class', 'style'],
    'u': ['class', 'style'],
    's': ['class', 'style'],
    'code': ['class', 'style'],
    'pre': ['class', 'style'],
    'blockquote': ['class', 'style'],
    'li': ['class', 'style'],
    'ul': ['class', 'style'],
    'ol': ['class', 'style'],
    'a': ['href', 'target', 'rel', 'class', 'style'],
    'img': ['src', 'alt', 'width', 'height', 'class'],
    'td': ['colspan', 'rowspan', 'class', 'style'],
    'th': ['colspan', 'rowspan', 'class', 'style'],
  },
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
