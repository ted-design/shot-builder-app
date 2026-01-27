export const stripHtml = (value) => {
  if (typeof value !== "string" || !value) return "";
  const withBreaks = value
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<li>/gi, "• ");
  // Remove well-formed tags
  const withoutTags = withBreaks.replace(/<[^>]*>/g, " ");
  // Also remove malformed HTML fragments like "ul>", "li>", "p>" (missing leading <)
  const withoutMalformed = withoutTags.replace(/\b(ul|ol|li|p|div|span|br|strong|em|b|i|u|s|a|h[1-6])>/gi, " ");
  return withoutMalformed
    .replace(/&nbsp;/gi, " ")
    .replace(/\r+/g, "")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[\t ]+/g, " ")
    .trim();
};

