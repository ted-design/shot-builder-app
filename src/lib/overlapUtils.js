// src/lib/overlapUtils.js
// Overlap detection utilities for the Call Sheet Builder
// Identifies parallel activities across different tracks

import { parseTimeToMinutes, minutesToTimeString } from "./timeUtils";
import { sortEntriesByTime } from "./cascadeEngine";

/**
 * Check if two time ranges overlap.
 *
 * @param {number} start1 - Start time in minutes
 * @param {number} end1 - End time in minutes
 * @param {number} start2 - Start time in minutes
 * @param {number} end2 - End time in minutes
 * @returns {boolean} True if ranges overlap
 */
function rangesOverlap(start1, end1, start2, end2) {
  return start1 < end2 && start2 < end1;
}

/**
 * Calculate the overlap amount between two time ranges.
 *
 * @param {number} start1 - Start time in minutes
 * @param {number} end1 - End time in minutes
 * @param {number} start2 - Start time in minutes
 * @param {number} end2 - End time in minutes
 * @returns {number} Overlap in minutes (0 if no overlap)
 */
function calculateOverlapMinutes(start1, end1, start2, end2) {
  const overlapStart = Math.max(start1, start2);
  const overlapEnd = Math.min(end1, end2);
  return Math.max(0, overlapEnd - overlapStart);
}

/**
 * Get time bounds for an entry.
 *
 * @param {object} entry - Schedule entry
 * @returns {{ start: number, end: number }}
 */
function getEntryBounds(entry) {
  const start = parseTimeToMinutes(entry.startTime);
  const end = start + entry.duration;
  return { start, end };
}

/**
 * Find all entries that overlap with a given entry.
 * Only considers entries in different tracks (cross-track overlaps).
 *
 * @param {object} entry - The entry to check
 * @param {Array} allEntries - All schedule entries
 * @returns {Array<{ entryId: string, trackId: string, overlapMinutes: number }>}
 */
export function findOverlappingEntries(entry, allEntries) {
  const { start: entryStart, end: entryEnd } = getEntryBounds(entry);
  const overlaps = [];

  for (const other of allEntries) {
    // Skip same entry
    if (other.id === entry.id) continue;
    // Skip same track (within-track overlaps are handled by cascade)
    if (other.trackId === entry.trackId) continue;

    const { start: otherStart, end: otherEnd } = getEntryBounds(other);

    if (rangesOverlap(entryStart, entryEnd, otherStart, otherEnd)) {
      const overlapMinutes = calculateOverlapMinutes(
        entryStart,
        entryEnd,
        otherStart,
        otherEnd
      );
      overlaps.push({
        entryId: other.id,
        trackId: other.trackId,
        overlapMinutes,
      });
    }
  }

  return overlaps;
}

/**
 * Build an overlap map for all entries.
 * Maps each entry ID to an array of overlapping entry IDs.
 *
 * @param {Array} entries - All schedule entries
 * @returns {Map<string, string[]>} Map of entryId -> array of overlapping entry IDs
 */
export function buildOverlapMap(entries) {
  const overlapMap = new Map();

  // Initialize all entries with empty arrays
  for (const entry of entries) {
    overlapMap.set(entry.id, []);
  }

  // Compare all pairs (cross-track only)
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const entryA = entries[i];
      const entryB = entries[j];

      // Skip same track
      if (entryA.trackId === entryB.trackId) continue;

      const { start: startA, end: endA } = getEntryBounds(entryA);
      const { start: startB, end: endB } = getEntryBounds(entryB);

      if (rangesOverlap(startA, endA, startB, endB)) {
        overlapMap.get(entryA.id).push(entryB.id);
        overlapMap.get(entryB.id).push(entryA.id);
      }
    }
  }

  return overlapMap;
}

/**
 * Group overlapping entries into clusters.
 * A cluster contains all entries that overlap with each other (transitively).
 *
 * @param {Array} entries - All schedule entries
 * @returns {Array<{ entries: Array, startTime: string, endTime: string, tracks: string[] }>}
 */
export function findOverlapClusters(entries) {
  const overlapMap = buildOverlapMap(entries);
  const visited = new Set();
  const clusters = [];

  // Helper to get all connected entries via DFS
  function getConnectedEntries(entryId, cluster = []) {
    if (visited.has(entryId)) return cluster;
    visited.add(entryId);

    const entry = entries.find((e) => e.id === entryId);
    if (entry) cluster.push(entry);

    const overlaps = overlapMap.get(entryId) || [];
    for (const otherId of overlaps) {
      getConnectedEntries(otherId, cluster);
    }

    return cluster;
  }

  // Find all clusters
  for (const entry of entries) {
    if (visited.has(entry.id)) continue;

    const clusterEntries = getConnectedEntries(entry.id);

    // Only include clusters with 2+ entries (actual overlaps)
    if (clusterEntries.length > 1) {
      // Calculate cluster bounds
      let clusterStart = Infinity;
      let clusterEnd = -Infinity;
      const trackSet = new Set();

      for (const e of clusterEntries) {
        const { start, end } = getEntryBounds(e);
        clusterStart = Math.min(clusterStart, start);
        clusterEnd = Math.max(clusterEnd, end);
        trackSet.add(e.trackId);
      }

      clusters.push({
        entries: clusterEntries,
        startTime: minutesToTimeString(clusterStart),
        endTime: minutesToTimeString(clusterEnd),
        tracks: Array.from(trackSet),
      });
    }
  }

  return clusters;
}

/**
 * Check if an entry has any overlaps with other tracks.
 *
 * @param {object} entry - The entry to check
 * @param {Array} allEntries - All schedule entries
 * @returns {boolean} True if entry has cross-track overlaps
 */
export function hasOverlap(entry, allEntries) {
  const overlaps = findOverlappingEntries(entry, allEntries);
  return overlaps.length > 0;
}

/**
 * Get entries that have overlaps, grouped by whether they overlap.
 *
 * @param {Array} entries - All schedule entries
 * @returns {{ withOverlap: string[], withoutOverlap: string[] }}
 */
export function categorizeByOverlap(entries) {
  const overlapMap = buildOverlapMap(entries);
  const withOverlap = [];
  const withoutOverlap = [];

  for (const entry of entries) {
    const overlaps = overlapMap.get(entry.id) || [];
    if (overlaps.length > 0) {
      withOverlap.push(entry.id);
    } else {
      withoutOverlap.push(entry.id);
    }
  }

  return { withOverlap, withoutOverlap };
}

/**
 * Get time slots where overlaps occur.
 * Useful for visualizing overlap regions on a timeline.
 *
 * @param {Array} entries - All schedule entries
 * @param {number} resolution - Time resolution in minutes (default: 5)
 * @returns {Array<{ startTime: string, endTime: string, entryCount: number, trackCount: number }>}
 */
export function getOverlapTimeSlots(entries, resolution = 5) {
  if (entries.length === 0) return [];

  // Find day bounds
  let dayStart = Infinity;
  let dayEnd = -Infinity;
  for (const entry of entries) {
    const { start, end } = getEntryBounds(entry);
    dayStart = Math.min(dayStart, start);
    dayEnd = Math.max(dayEnd, end);
  }

  // Scan through time slots
  const slots = [];
  let currentSlot = null;

  for (let t = dayStart; t < dayEnd; t += resolution) {
    // Count entries and tracks active at this time
    const activeEntries = [];
    const activeTracks = new Set();

    for (const entry of entries) {
      const { start, end } = getEntryBounds(entry);
      // Entry is active if time t falls within [start, end)
      if (t >= start && t < end) {
        activeEntries.push(entry.id);
        activeTracks.add(entry.trackId);
      }
    }

    const trackCount = activeTracks.size;
    const isOverlap = trackCount > 1;

    if (isOverlap) {
      if (!currentSlot) {
        // Start new overlap slot
        currentSlot = {
          startMinutes: t,
          maxEntryCount: activeEntries.length,
          maxTrackCount: trackCount,
        };
      } else {
        // Extend current slot
        currentSlot.maxEntryCount = Math.max(
          currentSlot.maxEntryCount,
          activeEntries.length
        );
        currentSlot.maxTrackCount = Math.max(currentSlot.maxTrackCount, trackCount);
      }
    } else if (currentSlot) {
      // End current slot
      slots.push({
        startTime: minutesToTimeString(currentSlot.startMinutes),
        endTime: minutesToTimeString(t),
        entryCount: currentSlot.maxEntryCount,
        trackCount: currentSlot.maxTrackCount,
      });
      currentSlot = null;
    }
  }

  // Close any remaining slot
  if (currentSlot) {
    slots.push({
      startTime: minutesToTimeString(currentSlot.startMinutes),
      endTime: minutesToTimeString(dayEnd),
      entryCount: currentSlot.maxEntryCount,
      trackCount: currentSlot.maxTrackCount,
    });
  }

  return slots;
}

/**
 * Validate that an entry move won't cause issues.
 * Returns warnings about potential problems (not hard blocks).
 *
 * @param {object} entry - The entry being moved
 * @param {string} newStartTime - Proposed new start time
 * @param {string} newTrackId - Proposed new track (optional, defaults to current)
 * @param {Array} allEntries - All schedule entries
 * @returns {{ hasOverlap: boolean, overlappingEntries: Array, warnings: string[] }}
 */
export function validateEntryMove(entry, newStartTime, newTrackId, allEntries) {
  const targetTrackId = newTrackId || entry.trackId;
  const warnings = [];

  // Create a mock entry with new position
  const mockEntry = {
    ...entry,
    startTime: newStartTime,
    trackId: targetTrackId,
  };

  // Check for overlaps
  const overlaps = findOverlappingEntries(
    mockEntry,
    allEntries.filter((e) => e.id !== entry.id)
  );

  const hasOverlap = overlaps.length > 0;

  if (hasOverlap) {
    warnings.push(
      `This entry will overlap with ${overlaps.length} other ${
        overlaps.length === 1 ? "entry" : "entries"
      } on different tracks.`
    );
  }

  // Check for same-track conflicts (should be handled by cascade, but warn)
  const sameTrackEntries = allEntries.filter(
    (e) => e.trackId === targetTrackId && e.id !== entry.id
  );
  const { start: mockStart, end: mockEnd } = getEntryBounds(mockEntry);

  for (const other of sameTrackEntries) {
    const { start: otherStart, end: otherEnd } = getEntryBounds(other);
    if (rangesOverlap(mockStart, mockEnd, otherStart, otherEnd)) {
      warnings.push(
        "This will cause an overlap within the same track. Cascade will adjust subsequent entries."
      );
      break;
    }
  }

  return {
    hasOverlap,
    overlappingEntries: overlaps,
    warnings,
  };
}

/**
 * Resolve entries with their overlap information.
 * Adds `hasOverlap` and `overlapsWith` fields to each entry.
 *
 * @param {Array} entries - All schedule entries
 * @returns {Array<entry & { hasOverlap: boolean, overlapsWith: string[] }>}
 */
export function resolveOverlaps(entries) {
  const overlapMap = buildOverlapMap(entries);

  return entries.map((entry) => {
    const overlapsWith = overlapMap.get(entry.id) || [];
    return {
      ...entry,
      hasOverlap: overlapsWith.length > 0,
      overlapsWith,
    };
  });
}

/**
 * Get a summary of overlaps in the schedule.
 *
 * @param {Array} entries - All schedule entries
 * @returns {{ totalOverlaps: number, entriesWithOverlaps: number, clusters: number, maxConcurrent: number }}
 */
export function getOverlapSummary(entries) {
  const overlapMap = buildOverlapMap(entries);
  const clusters = findOverlapClusters(entries);

  let totalOverlaps = 0;
  let entriesWithOverlaps = 0;

  for (const [, overlaps] of overlapMap) {
    if (overlaps.length > 0) {
      entriesWithOverlaps++;
      totalOverlaps += overlaps.length;
    }
  }

  // Divide by 2 since each overlap is counted twice (A overlaps B and B overlaps A)
  totalOverlaps = totalOverlaps / 2;

  // Find max concurrent entries
  let maxConcurrent = 0;
  for (const cluster of clusters) {
    maxConcurrent = Math.max(maxConcurrent, cluster.entries.length);
  }

  return {
    totalOverlaps,
    entriesWithOverlaps,
    clusters: clusters.length,
    maxConcurrent,
  };
}
