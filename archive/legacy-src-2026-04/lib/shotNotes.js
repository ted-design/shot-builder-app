import { stripHtml } from "./stripHtml";

export const getShotNotesPreview = (shot) => {
  if (!shot || typeof shot !== "object") return "";
  // Prefer shot.notes, fall back to shot.description for backward compatibility
  // (planner export historically used description for the notes column)
  const raw =
    typeof shot.notes === "string" && shot.notes.trim()
      ? shot.notes
      : typeof shot.description === "string"
      ? shot.description
      : "";
  if (!raw) return "";
  return stripHtml(raw)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};
