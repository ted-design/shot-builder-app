import { minutesToTimeString, parseTimeToMinutes } from "./timeUtils";

const MIN_DURATION_MINUTES = 1;

function clampMinDuration(value, minDurationMinutes) {
  const min = typeof minDurationMinutes === "number" && minDurationMinutes > 0 ? minDurationMinutes : MIN_DURATION_MINUTES;
  if (typeof value !== "number" || Number.isNaN(value)) return min;
  return Math.max(min, Math.round(value));
}

function getStartMinutes(entry) {
  return parseTimeToMinutes(entry?.startTime || "00:00");
}

function getDurationMinutes(entry) {
  const raw = entry?.duration;
  if (typeof raw !== "number" || Number.isNaN(raw)) return 0;
  return Math.max(0, Math.round(raw));
}

export function sortTrackEntriesGapless(entries) {
  return [...entries].sort((a, b) => {
    const am = getStartMinutes(a);
    const bm = getStartMinutes(b);
    if (am !== bm) return am - bm;
    return (a.order ?? 0) - (b.order ?? 0);
  });
}

function isSingleTrackAppliedBanner(entry, trackId) {
  if (!entry || entry.type !== "custom") return false;
  if (!Array.isArray(entry.appliesToTrackIds) || entry.appliesToTrackIds.length !== 1) return false;
  return entry.appliesToTrackIds[0] === trackId;
}

export function getEntriesAffectingTrack(allEntries, trackId) {
  if (!Array.isArray(allEntries) || !trackId) return [];
  return allEntries.filter((entry) => entry.trackId === trackId || isSingleTrackAppliedBanner(entry, trackId));
}

export function getTrackAnchorStartMinutes(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  let minMinutes = null;
  for (const entry of entries) {
    const minutes = getStartMinutes(entry);
    if (minMinutes == null || minutes < minMinutes) minMinutes = minutes;
  }
  return minMinutes;
}

export function buildGaplessTrackSchedule(trackEntries, orderedIds, options = {}) {
  if (!Array.isArray(trackEntries) || trackEntries.length === 0) return [];
  const byId = new Map(trackEntries.map((entry) => [entry.id, entry]));
  const defaultOrder = sortTrackEntriesGapless(trackEntries).map((entry) => entry.id);
  const resolvedOrder = Array.isArray(orderedIds) && orderedIds.length > 0 ? orderedIds : defaultOrder;

  const anchorStartMinutes =
    typeof options.anchorStartMinutes === "number" ? options.anchorStartMinutes : getTrackAnchorStartMinutes(trackEntries);
  if (anchorStartMinutes == null) return [];

  let cursor = anchorStartMinutes;
  const computed = [];
  resolvedOrder.forEach((entryId, index) => {
    const entry = byId.get(entryId);
    if (!entry) return;
    const duration = getDurationMinutes(entry);
    computed.push({
      id: entry.id,
      startMinutes: cursor,
      startTime: minutesToTimeString(cursor),
      duration,
      order: index,
    });
    cursor += duration;
  });

  return computed;
}

export function buildGaplessReorderUpdates(allEntries, trackId, orderedIds, options = {}) {
  const trackEntries = Array.isArray(allEntries)
    ? allEntries.filter((entry) => entry.trackId === trackId)
    : [];
  const computed = buildGaplessTrackSchedule(trackEntries, orderedIds, options);
  const originalById = new Map(trackEntries.map((entry) => [entry.id, entry]));

  return computed
    .map((next) => {
      const original = originalById.get(next.id);
      if (!original) return null;
      const updates = {};
      if (original.startTime !== next.startTime) updates.startTime = next.startTime;
      if ((original.order ?? 0) !== next.order) updates.order = next.order;
      if (Object.keys(updates).length === 0) return null;
      return { entryId: next.id, ...updates };
    })
    .filter(Boolean);
}

export function buildGaplessDurationChangeUpdates(allEntries, entryId, newDuration, options = {}) {
  if (!Array.isArray(allEntries) || !entryId) return [];
  const target = allEntries.find((entry) => entry.id === entryId);
  if (!target) return [];
  const trackId = target.trackId;
  const minDurationMinutes = options.minDurationMinutes;

  const trackEntries = sortTrackEntriesGapless(getEntriesAffectingTrack(allEntries, trackId));
  const index = trackEntries.findIndex((entry) => entry.id === entryId);
  if (index === -1) return [];

  const updates = [];
  const duration = clampMinDuration(newDuration, minDurationMinutes);
  if (target.duration !== duration) {
    updates.push({ entryId, duration });
  }

  let cursor = getStartMinutes(target);
  cursor += duration;

  for (let i = index + 1; i < trackEntries.length; i += 1) {
    const entry = trackEntries[i];
    const nextStart = minutesToTimeString(cursor);
    if (entry.startTime !== nextStart) {
      updates.push({ entryId: entry.id, startTime: nextStart });
    }
    cursor += getDurationMinutes(entry);
  }

  return updates;
}

export function buildGaplessTimeChangeUpdates(allEntries, entryId, newStartTime, options = {}) {
  if (!Array.isArray(allEntries) || !entryId) return [];
  const target = allEntries.find((entry) => entry.id === entryId);
  if (!target) return [];
  const trackId = target.trackId;
  const minDurationMinutes = options.minDurationMinutes;

  const trackEntries = sortTrackEntriesGapless(getEntriesAffectingTrack(allEntries, trackId));
  const index = trackEntries.findIndex((entry) => entry.id === entryId);
  if (index === -1) return [];

  const desiredStartMinutes = parseTimeToMinutes(newStartTime);
  const updates = [];

  if (index === 0) {
    const currentStartMinutes = getStartMinutes(trackEntries[0]);
    const delta = desiredStartMinutes - currentStartMinutes;
    if (delta === 0) return [];

    trackEntries.forEach((entry) => {
      const startMinutes = getStartMinutes(entry) + delta;
      const startTime = minutesToTimeString(startMinutes);
      if (entry.startTime !== startTime) {
        updates.push({ entryId: entry.id, startTime });
      }
    });
    return updates;
  }

  const previous = trackEntries[index - 1];
  const previousStartMinutes = getStartMinutes(previous);
  const clampedPrevDuration = clampMinDuration(desiredStartMinutes - previousStartMinutes, minDurationMinutes);
  const resolvedStartMinutes = previousStartMinutes + clampedPrevDuration;

  if (previous.duration !== clampedPrevDuration) {
    updates.push({ entryId: previous.id, duration: clampedPrevDuration });
  }

  const resolvedStartTime = minutesToTimeString(resolvedStartMinutes);
  if (target.startTime !== resolvedStartTime) {
    updates.push({ entryId, startTime: resolvedStartTime });
  }

  let cursor = resolvedStartMinutes + getDurationMinutes(target);
  for (let i = index + 1; i < trackEntries.length; i += 1) {
    const entry = trackEntries[i];
    const startTime = minutesToTimeString(cursor);
    if (entry.startTime !== startTime) {
      updates.push({ entryId: entry.id, startTime });
    }
    cursor += getDurationMinutes(entry);
  }

  return updates;
}

export function buildGaplessNormalizeStartTimeUpdates(allEntries, trackId, options = {}) {
  const minDurationMinutes = options.minDurationMinutes;
  const trackEntries = sortTrackEntriesGapless(getEntriesAffectingTrack(allEntries, trackId));
  if (trackEntries.length === 0) return [];

  const anchorStartMinutes = getTrackAnchorStartMinutes(trackEntries);
  if (anchorStartMinutes == null) return [];

  let cursor = anchorStartMinutes;
  const updates = [];

  trackEntries.forEach((entry) => {
    const expectedStartTime = minutesToTimeString(cursor);
    if (entry.startTime !== expectedStartTime) {
      updates.push({ entryId: entry.id, startTime: expectedStartTime });
    }
    const duration = clampMinDuration(getDurationMinutes(entry), minDurationMinutes);
    cursor += duration;
  });

  return updates;
}
