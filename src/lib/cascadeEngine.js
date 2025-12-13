// src/lib/cascadeEngine.js
// Auto-cascade algorithm for schedule time adjustments
// When an entry is moved or resized, subsequent entries in the same track are adjusted.

import {
  parseTimeToMinutes,
  minutesToTimeString,
  calculateEndTime,
} from "./timeUtils";

/**
 * Sort entries by start time, then by order for tie-breaking.
 *
 * @param {Array} entries - Array of schedule entries
 * @returns {Array} Sorted entries
 */
export function sortEntriesByTime(entries) {
  return [...entries].sort((a, b) => {
    const timeA = parseTimeToMinutes(a.startTime);
    const timeB = parseTimeToMinutes(b.startTime);
    if (timeA !== timeB) return timeA - timeB;
    return (a.order ?? 0) - (b.order ?? 0);
  });
}

/**
 * Group entries by track ID.
 *
 * @param {Array} entries - Array of schedule entries
 * @returns {Map<string, Array>} Map of trackId -> entries
 */
export function groupEntriesByTrack(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const trackId = entry.trackId;
    if (!groups.has(trackId)) {
      groups.set(trackId, []);
    }
    groups.get(trackId).push(entry);
  }
  // Sort each track's entries by time
  for (const [trackId, trackEntries] of groups) {
    groups.set(trackId, sortEntriesByTime(trackEntries));
  }
  return groups;
}

/**
 * Calculate cascading time adjustments for entries in a single track.
 * When an entry's end time overlaps the next entry's start time, push
 * subsequent entries forward to prevent overlap.
 *
 * @param {Array} entries - Sorted entries for a single track
 * @param {object} options - Cascade options
 * @param {number} options.gapMinutes - Minimum gap between entries (default: 0)
 * @returns {Array<{ id: string, startTime: string, changed: boolean }>}
 */
export function cascadeTrackEntries(entries, options = {}) {
  const { gapMinutes = 0 } = options;
  const results = [];

  if (entries.length === 0) return results;

  // First entry keeps its time
  let prevEndMinutes = parseTimeToMinutes(entries[0].startTime) + entries[0].duration;
  results.push({
    id: entries[0].id,
    startTime: entries[0].startTime,
    changed: false,
  });

  for (let i = 1; i < entries.length; i++) {
    const entry = entries[i];
    const currentStartMinutes = parseTimeToMinutes(entry.startTime);
    const minStartMinutes = prevEndMinutes + gapMinutes;

    if (currentStartMinutes < minStartMinutes) {
      // Need to push this entry forward
      const newStartTime = minutesToTimeString(minStartMinutes);
      results.push({
        id: entry.id,
        startTime: newStartTime,
        changed: true,
      });
      prevEndMinutes = minStartMinutes + entry.duration;
    } else {
      // Entry is fine, no adjustment needed
      results.push({
        id: entry.id,
        startTime: entry.startTime,
        changed: false,
      });
      prevEndMinutes = currentStartMinutes + entry.duration;
    }
  }

  return results;
}

/**
 * Calculate cascade adjustments for all entries across all tracks.
 *
 * @param {Array} entries - All schedule entries
 * @param {object} options - Cascade options
 * @param {number} options.gapMinutes - Minimum gap between entries (default: 0)
 * @returns {Array<{ id: string, startTime: string, changed: boolean }>}
 */
export function cascadeAllEntries(entries, options = {}) {
  const trackGroups = groupEntriesByTrack(entries);
  const allResults = [];

  for (const [, trackEntries] of trackGroups) {
    const trackResults = cascadeTrackEntries(trackEntries, options);
    allResults.push(...trackResults);
  }

  return allResults;
}

/**
 * Apply a time change to an entry and cascade subsequent entries in the same track.
 *
 * @param {Array} entries - All schedule entries
 * @param {string} entryId - ID of the entry being moved
 * @param {string} newStartTime - New start time for the entry (HH:MM)
 * @param {object} options - Cascade options
 * @param {boolean} options.cascadeEnabled - Whether to cascade subsequent entries
 * @param {number} options.gapMinutes - Minimum gap between entries
 * @returns {Array<{ id: string, startTime: string, changed: boolean }>}
 */
export function applyTimeChange(entries, entryId, newStartTime, options = {}) {
  const { cascadeEnabled = true, gapMinutes = 0 } = options;

  // Find the entry being moved
  const entryIndex = entries.findIndex((e) => e.id === entryId);
  if (entryIndex === -1) {
    return [];
  }

  const movedEntry = entries[entryIndex];
  const trackId = movedEntry.trackId;
  const originalStartTime = movedEntry.startTime;

  // Check if the time actually changed
  const timeChanged = newStartTime !== originalStartTime;

  // Create a working copy with the updated time
  const updatedEntries = entries.map((e) =>
    e.id === entryId ? { ...e, startTime: newStartTime } : e
  );

  if (!cascadeEnabled) {
    // Just return the single change
    return [
      {
        id: entryId,
        startTime: newStartTime,
        changed: timeChanged,
      },
    ];
  }

  // Get entries for this track and cascade
  const trackEntries = updatedEntries.filter((e) => e.trackId === trackId);
  const sortedTrackEntries = sortEntriesByTime(trackEntries);

  const cascadeResults = cascadeTrackEntries(sortedTrackEntries, { gapMinutes });

  // Ensure the moved entry is marked as changed if its time actually changed
  // (cascadeTrackEntries marks the first entry as unchanged, but we need to
  // track if WE changed it)
  return cascadeResults.map((result) => {
    if (result.id === entryId && timeChanged) {
      return { ...result, changed: true };
    }
    return result;
  });
}

/**
 * Apply a duration change to an entry and cascade subsequent entries.
 *
 * @param {Array} entries - All schedule entries
 * @param {string} entryId - ID of the entry being resized
 * @param {number} newDuration - New duration in minutes
 * @param {object} options - Cascade options
 * @returns {Array<{ id: string, startTime?: string, duration?: number, changed: boolean }>}
 */
export function applyDurationChange(entries, entryId, newDuration, options = {}) {
  const { cascadeEnabled = true, gapMinutes = 0 } = options;

  const entryIndex = entries.findIndex((e) => e.id === entryId);
  if (entryIndex === -1) {
    return [];
  }

  const resizedEntry = entries[entryIndex];
  const trackId = resizedEntry.trackId;

  // Create working copy with updated duration
  const updatedEntries = entries.map((e) =>
    e.id === entryId ? { ...e, duration: newDuration } : e
  );

  const results = [
    {
      id: entryId,
      duration: newDuration,
      changed: true,
    },
  ];

  if (!cascadeEnabled) {
    return results;
  }

  // Get entries for this track and cascade times
  const trackEntries = updatedEntries.filter((e) => e.trackId === trackId);
  const sortedTrackEntries = sortEntriesByTime(trackEntries);

  const cascadeResults = cascadeTrackEntries(sortedTrackEntries, { gapMinutes });

  // Merge results, keeping duration change for the resized entry
  const mergedResults = cascadeResults.map((r) => {
    if (r.id === entryId) {
      return { ...r, duration: newDuration, changed: true };
    }
    return r;
  });

  return mergedResults;
}

/**
 * Reorder an entry within its track and optionally cascade times.
 * The entry is moved to a new position (before/after another entry).
 *
 * @param {Array} entries - All schedule entries
 * @param {string} entryId - ID of the entry being moved
 * @param {string} targetEntryId - ID of the target position entry
 * @param {'before' | 'after'} position - Insert before or after target
 * @param {object} options - Cascade options
 * @returns {{ reorderedEntries: Array, timeChanges: Array }}
 */
export function reorderEntry(entries, entryId, targetEntryId, position, options = {}) {
  const { cascadeEnabled = true, gapMinutes = 0 } = options;

  const entry = entries.find((e) => e.id === entryId);
  const targetEntry = entries.find((e) => e.id === targetEntryId);

  if (!entry || !targetEntry) {
    return { reorderedEntries: entries, timeChanges: [] };
  }

  // Group by track
  const trackGroups = groupEntriesByTrack(entries);
  const trackId = entry.trackId;
  const trackEntries = trackGroups.get(trackId) || [];

  // Remove the entry from its current position
  const withoutEntry = trackEntries.filter((e) => e.id !== entryId);

  // Find the target index
  const targetIndex = withoutEntry.findIndex((e) => e.id === targetEntryId);
  if (targetIndex === -1) {
    return { reorderedEntries: entries, timeChanges: [] };
  }

  // Insert at new position
  const insertIndex = position === "before" ? targetIndex : targetIndex + 1;
  withoutEntry.splice(insertIndex, 0, entry);

  // Update order values
  const reorderedTrackEntries = withoutEntry.map((e, idx) => ({
    ...e,
    order: idx,
  }));

  // Rebuild full entries list
  const reorderedEntries = entries.map((e) => {
    if (e.trackId !== trackId) return e;
    const updated = reorderedTrackEntries.find((re) => re.id === e.id);
    return updated || e;
  });

  // Calculate time cascades if enabled
  let timeChanges = [];
  if (cascadeEnabled) {
    // Assign times based on new order
    timeChanges = assignSequentialTimes(reorderedTrackEntries, {
      startTime: reorderedTrackEntries[0]?.startTime || "09:00",
      gapMinutes,
    });
  }

  return { reorderedEntries, timeChanges };
}

/**
 * Assign sequential times to entries based on their order.
 * Useful after reordering to recalculate all times.
 *
 * @param {Array} entries - Sorted entries for a single track
 * @param {object} options - Options
 * @param {string} options.startTime - Start time for first entry (HH:MM)
 * @param {number} options.gapMinutes - Gap between entries
 * @returns {Array<{ id: string, startTime: string, changed: boolean }>}
 */
export function assignSequentialTimes(entries, options = {}) {
  const { startTime = "09:00", gapMinutes = 0 } = options;
  const results = [];

  if (entries.length === 0) return results;

  let currentMinutes = parseTimeToMinutes(startTime);

  for (const entry of entries) {
    const newStartTime = minutesToTimeString(currentMinutes);
    const originalStartMinutes = parseTimeToMinutes(entry.startTime);
    const changed = currentMinutes !== originalStartMinutes;

    results.push({
      id: entry.id,
      startTime: newStartTime,
      changed,
    });

    currentMinutes += entry.duration + gapMinutes;
  }

  return results;
}

/**
 * Move an entry to a different track.
 *
 * @param {Array} entries - All schedule entries
 * @param {string} entryId - ID of the entry being moved
 * @param {string} newTrackId - ID of the target track
 * @param {string} newStartTime - New start time (optional, keeps current if not provided)
 * @param {object} options - Cascade options
 * @returns {{ updatedEntry: object, sourceTrackChanges: Array, targetTrackChanges: Array }}
 */
export function moveEntryToTrack(entries, entryId, newTrackId, newStartTime = null, options = {}) {
  const { cascadeEnabled = true, gapMinutes = 0 } = options;

  const entry = entries.find((e) => e.id === entryId);
  if (!entry) {
    return { updatedEntry: null, sourceTrackChanges: [], targetTrackChanges: [] };
  }

  const oldTrackId = entry.trackId;
  const finalStartTime = newStartTime || entry.startTime;

  // Update the entry
  const updatedEntry = {
    ...entry,
    trackId: newTrackId,
    startTime: finalStartTime,
  };

  // Create updated entries list
  const updatedEntries = entries.map((e) =>
    e.id === entryId ? updatedEntry : e
  );

  let sourceTrackChanges = [];
  let targetTrackChanges = [];

  if (cascadeEnabled) {
    // Cascade source track (entry was removed)
    const sourceTrackEntries = updatedEntries.filter(
      (e) => e.trackId === oldTrackId
    );
    sourceTrackChanges = cascadeTrackEntries(sortEntriesByTime(sourceTrackEntries), {
      gapMinutes,
    });

    // Cascade target track (entry was added)
    const targetTrackEntries = updatedEntries.filter(
      (e) => e.trackId === newTrackId
    );
    targetTrackChanges = cascadeTrackEntries(sortEntriesByTime(targetTrackEntries), {
      gapMinutes,
    });
  }

  return { updatedEntry, sourceTrackChanges, targetTrackChanges };
}

/**
 * Calculate the earliest available start time in a track.
 * Useful for "Add to end" functionality.
 *
 * @param {Array} entries - All schedule entries
 * @param {string} trackId - Track to check
 * @param {number} gapMinutes - Gap after last entry
 * @returns {string} Earliest available time (HH:MM)
 */
export function getNextAvailableTime(entries, trackId, gapMinutes = 0) {
  const trackEntries = entries.filter((e) => e.trackId === trackId);
  if (trackEntries.length === 0) {
    return "09:00"; // Default start time
  }

  const sorted = sortEntriesByTime(trackEntries);
  const lastEntry = sorted[sorted.length - 1];
  const lastEndMinutes =
    parseTimeToMinutes(lastEntry.startTime) + lastEntry.duration + gapMinutes;

  return minutesToTimeString(lastEndMinutes);
}

/**
 * Find gaps in a track's schedule where a new entry could fit.
 *
 * @param {Array} entries - All schedule entries
 * @param {string} trackId - Track to check
 * @param {number} minDuration - Minimum gap duration to include
 * @param {string} dayStart - Day start time (HH:MM)
 * @param {string} dayEnd - Day end time (HH:MM)
 * @returns {Array<{ startTime: string, endTime: string, duration: number }>}
 */
export function findGaps(entries, trackId, minDuration = 15, dayStart = "06:00", dayEnd = "22:00") {
  const trackEntries = entries.filter((e) => e.trackId === trackId);
  const sorted = sortEntriesByTime(trackEntries);
  const gaps = [];

  const dayStartMinutes = parseTimeToMinutes(dayStart);
  const dayEndMinutes = parseTimeToMinutes(dayEnd);

  let currentMinutes = dayStartMinutes;

  for (const entry of sorted) {
    const entryStartMinutes = parseTimeToMinutes(entry.startTime);
    const entryEndMinutes = entryStartMinutes + entry.duration;

    // Check for gap before this entry
    if (entryStartMinutes > currentMinutes) {
      const gapDuration = entryStartMinutes - currentMinutes;
      if (gapDuration >= minDuration) {
        gaps.push({
          startTime: minutesToTimeString(currentMinutes),
          endTime: minutesToTimeString(entryStartMinutes),
          duration: gapDuration,
        });
      }
    }

    currentMinutes = Math.max(currentMinutes, entryEndMinutes);
  }

  // Check for gap at end of day
  if (dayEndMinutes > currentMinutes) {
    const gapDuration = dayEndMinutes - currentMinutes;
    if (gapDuration >= minDuration) {
      gaps.push({
        startTime: minutesToTimeString(currentMinutes),
        endTime: minutesToTimeString(dayEndMinutes),
        duration: gapDuration,
      });
    }
  }

  return gaps;
}
