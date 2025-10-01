import { sortShotsForView, shotPrimaryTalentName, timestampToMillis } from "./shotsSelectors";

const UNSCHEDULED_KEY = "__unscheduled__";
const UNASSIGNED_TALENT = "__planner_talent_unassigned__";

const formatDateKey = (value) => {
  if (!value) return UNSCHEDULED_KEY;
  if (typeof value === "string") return value.slice(0, 10) || UNSCHEDULED_KEY;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (value && typeof value.toDate === "function") {
    return value.toDate().toISOString().slice(0, 10);
  }
  if (value && typeof value.seconds === "number") {
    const date = new Date(value.seconds * 1000);
    return Number.isNaN(date.getTime()) ? UNSCHEDULED_KEY : date.toISOString().slice(0, 10);
  }
  return UNSCHEDULED_KEY;
};

const formatDateLabel = (value) => {
  const key = formatDateKey(value);
  if (key === UNSCHEDULED_KEY) return "Unscheduled";
  return key;
};

export const selectPlannerGroups = (
  shots,
  {
    groupBy = "date",
    sortBy = "alpha",
  } = {}
) => {
  const list = Array.isArray(shots) ? shots : [];
  if (!list.length) return [];

  if (groupBy === "talent") {
    const buckets = new Map();
    list.forEach((shot) => {
      const primary = shotPrimaryTalentName(shot);
      const key = primary === "zzzz" ? UNASSIGNED_TALENT : primary;
      if (!buckets.has(key)) {
        buckets.set(key, { id: key, name: key === UNASSIGNED_TALENT ? "Unassigned" : primary, shots: [] });
      }
      buckets.get(key).shots.push(shot);
    });

    const groups = Array.from(buckets.values()).map((group) => ({
      ...group,
      shots: sortShotsForView(group.shots, { sortBy }),
    }));

    groups.sort((a, b) => {
      if (a.id === UNASSIGNED_TALENT) return 1;
      if (b.id === UNASSIGNED_TALENT) return -1;
      return a.name.localeCompare(b.name);
    });

    return groups;
  }

  // Default to grouping by date.
  const buckets = new Map();
  list.forEach((shot) => {
    const millis = timestampToMillis(shot?.date);
    const key = formatDateKey(shot?.date);
    const label = formatDateLabel(shot?.date);
    if (!buckets.has(key)) {
      buckets.set(key, {
        id: key,
        name: label,
        order: key === UNSCHEDULED_KEY ? Number.POSITIVE_INFINITY : millis,
        shots: [],
      });
    }
    buckets.get(key).shots.push(shot);
  });

  const groups = Array.from(buckets.values()).map((group) => ({
    ...group,
    shots: sortShotsForView(group.shots, { sortBy }),
  }));

  groups.sort((a, b) => {
    if (a.order === b.order) return a.name.localeCompare(b.name);
    return a.order - b.order;
  });

  return groups;
};
