import { sanitizeHtml } from "./sanitizeHtml";

// Legacy color constants (kept for backward compatibility)
export const allowedNoteColors = ["#1f2937", "#6366f1", "#10b981", "#f43f5e", "#0f172a"];

/**
 * Sanitize notes HTML using the shared sanitization utility.
 * This ensures consistent handling of style attributes (including colors)
 * across the RichTextEditor and preview components.
 */
export const sanitizeNotesHtml = (input) => {
  if (!input) return "";
  if (typeof window === "undefined") return String(input);

  // Use the shared sanitizeHtml which has proper DOMPurify hooks
  // to preserve valid color styles while filtering dangerous content
  return sanitizeHtml(input);
};

export const formatNotesForDisplay = (input) => {
  const source = input ? input.toString() : "";
  const enriched = source.includes("<") ? source : source.replace(/\n/g, "<br />");
  const sanitized = sanitizeNotesHtml(enriched);
  return sanitized || "";
};
