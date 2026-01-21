export const stripHtml = (value) => {
  if (typeof value !== "string" || !value) return "";
  const withBreaks = value
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<li>/gi, "• ");
  const withoutTags = withBreaks.replace(/<[^>]*>/g, " ");
  return withoutTags
    .replace(/&nbsp;/gi, " ")
    .replace(/\r+/g, "")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[\t ]+/g, " ")
    .trim();
};

