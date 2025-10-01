import { normaliseShotStatus } from "./shotStatus";
import { DEFAULT_PROJECT_ID } from "./paths";

export const SHOT_SORT_OPTIONS = [
  { value: "alpha", label: "Title A→Z" },
  { value: "alpha_desc", label: "Title Z→A" },
  { value: "byTalent", label: "By Talent" },
  { value: "byDate", label: "By Date" },
];

const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

export const timestampToMillis = (value) => {
  if (!value) return Number.POSITIVE_INFINITY;
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
  }
  if (value && typeof value.toMillis === "function") return value.toMillis();
  if (value && typeof value.seconds === "number") {
    const nanos = typeof value.nanoseconds === "number" ? value.nanoseconds : 0;
    return value.seconds * 1000 + Math.floor(nanos / 1e6);
  }
  return Number.POSITIVE_INFINITY;
};

export const shotName = (shot) =>
  (shot?.name || shot?.title || "").trim();

export const shotPrimaryTalentName = (shot) => {
  if (!shot) return "zzzz";
  if (Array.isArray(shot.talent) && shot.talent.length) {
    const entry = shot.talent[0];
    if (entry?.name) return entry.name;
  }
  if (Array.isArray(shot.talentIds) && shot.talentIds.length) {
    const entry = shot.talentIds[0];
    if (typeof entry === "string") return entry;
    if (entry && typeof entry === "object" && entry.name) return entry.name;
  }
  return "zzzz";
};

const compareByName = (a, b) => collator.compare(shotName(a), shotName(b));

const compareByTalent = (a, b) => {
  const talentA = shotPrimaryTalentName(a);
  const talentB = shotPrimaryTalentName(b);
  const delta = collator.compare(talentA, talentB);
  if (delta !== 0) return delta;
  return compareByName(a, b);
};

const compareByDate = (a, b) => {
  const millisA = timestampToMillis(a?.date);
  const millisB = timestampToMillis(b?.date);
  if (millisA !== millisB) return millisA - millisB;
  return compareByName(a, b);
};

const sortComparators = {
  alpha: compareByName,
  alpha_desc: (a, b) => compareByName(b, a),
  byTalent: compareByTalent,
  byDate: compareByDate,
  date_asc: compareByDate,
  date_desc: (a, b) => compareByDate(b, a),
};

export const sortShotsForView = (shots, { sortBy = "alpha" } = {}) => {
  const comparator = sortComparators[sortBy] || sortComparators.alpha;
  return [...(Array.isArray(shots) ? shots : [])].sort((a, b) => {
    const result = comparator(a, b);
    if (result !== 0) return result;
    const createdA = timestampToMillis(a?.createdAt);
    const createdB = timestampToMillis(b?.createdAt);
    if (createdA !== createdB) return createdA - createdB;
    return collator.compare(a?.id || "", b?.id || "");
  });
};

export const normaliseShot = (shot, { fallbackProjectId = DEFAULT_PROJECT_ID } = {}) => {
  if (!shot || typeof shot !== "object") return null;
  const notes = typeof shot.notes === "string" ? shot.notes : shot.description || "";
  return {
    ...shot,
    projectId: shot.projectId || fallbackProjectId,
    status: normaliseShotStatus(shot.status),
    notes,
  };
};

export const normaliseShotList = (shots, options = {}) =>
  (Array.isArray(shots) ? shots : [])
    .map((shot) => normaliseShot(shot, options))
    .filter(Boolean);

export const applyViewToggles = (shot, toggles = {}) => {
  const {
    showProducts = true,
    showTalent = true,
    showLocation = true,
    showNotes = true,
  } = toggles;
  return {
    ...shot,
    showProducts,
    showTalent,
    showLocation,
    showNotes,
  };
};
