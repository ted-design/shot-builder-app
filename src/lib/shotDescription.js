import { stripHtml } from "./stripHtml";

export const isCorruptShotDescription = (description, notesPreview = "") => {
  if (typeof description !== "string") return false;
  const raw = description.trim();
  if (!raw) return false;

  const lower = raw.toLowerCase();
  // Treat HTML-ish fragments as corrupted legacy description data.
  if (lower.includes("<") || lower.includes("</") || lower.includes("ul>") || lower.includes("li>") || lower.includes("p>")) {
    return true;
  }

  // Optional: if the description is effectively identical to the notes preview,
  // treat it as corrupted (likely legacy sync bleed).
  const notes = typeof notesPreview === "string" ? notesPreview.trim() : "";
  if (notes) {
    const normalizedDescription = stripHtml(raw).trim();
    if (normalizedDescription && normalizedDescription === notes) {
      return true;
    }
  }

  return false;
};

export const resolveShotShortDescriptionSource = (shot) => {
  if (!shot || typeof shot !== "object") return "";
  return typeof shot.description === "string" ? shot.description : "";
};

export const resolveShotShortDescriptionText = (shot) => {
  const raw = resolveShotShortDescriptionSource(shot);
  return stripHtml(raw).slice(0, 200);
};

export const resolveShotDraftShortDescriptionSource = (draft) => {
  if (!draft || typeof draft !== "object") return "";
  return typeof draft.description === "string" ? draft.description : "";
};

export const resolveShotDraftShortDescriptionText = (draft) => {
  const raw = resolveShotDraftShortDescriptionSource(draft);
  return stripHtml(raw).slice(0, 200);
};

export const resolveShotTypeText = (shot) => {
  if (!shot || typeof shot !== "object") return "";
  return stripHtml(typeof shot.type === "string" ? shot.type : "").slice(0, 200);
};

/**
 * Pattern A: Conservative overwrite guard for hero auto-fill.
 *
 * Determines whether shot.description should be auto-filled when changing hero.
 * Only returns true if:
 * 1. currentDescription is empty, OR
 * 2. currentDescription exactly matches prevDerived (previous hero's colorway)
 *
 * This preserves any user-typed description, even if it happens to match
 * another product's colorway in the look.
 *
 * @param {string} currentDescription - Current shot.description value
 * @param {string} prevDerived - Previous hero's colorway (auto-derived value)
 * @returns {boolean} Whether to auto-fill the description
 */
export const shouldAutoFillDescriptionOnHeroChange = (currentDescription, prevDerived) => {
  const current = (typeof currentDescription === "string" ? currentDescription : "").trim();
  const prev = (typeof prevDerived === "string" ? prevDerived : "").trim().toLowerCase();

  // Empty description → always auto-fill
  if (!current) return true;

  // Description matches previous auto-derived value → safe to update
  if (prev && current.toLowerCase() === prev) return true;

  // User has customized → preserve
  return false;
};
