import { stripHtml } from "./stripHtml";

export const getShotNotesPreview = (shot) => {
  if (!shot || typeof shot !== "object") return "";
  const raw = typeof shot.notes === "string" ? shot.notes : "";
  if (!raw) return "";
  return stripHtml(raw)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};
