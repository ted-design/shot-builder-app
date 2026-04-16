// src/lib/callsheet/detectConflictsPairwise.js
// Canonical pair-based conflict detection for schedule entries
//
// This module provides deterministic, pair-based conflict detection for schedule
// entries. It uses getApplicableTrackIds for consistent applicability semantics:
//   - Lane entries (kind="single") conflict only within the same track
//   - Shared entries (kind="all") conflict with ANY overlapping entry
//   - Subset entries (kind="subset") conflict with entries in those specific tracks
//
// Overlap semantics: half-open interval [startMin, endMin)
//   overlap if: a.start < b.end AND b.start < a.end
//   adjacency (a.end === b.start) is NOT a conflict
//
// Output is deterministic:
//   - pairs: sorted by (minId, maxId) string order
//   - byEntryId: arrays sorted deterministically

import { getApplicableTrackIds } from "./getApplicableTrackIds";
import { getSequenceMinutes } from "./getEntryMinutes";
import { sortEntriesCanonical } from "./sortEntriesCanonical";

/**
 * @typedef {Object} Track
 * @property {string} id - Track identifier
 * @property {string} [name] - Track display name
 * @property {"lane"|"shared"} [scope] - Track scope (defaults to "lane")
 */

/**
 * @typedef {Object} NormalizedEntry
 * @property {string} id - Entry ID
 * @property {number} startMin - Start time in minutes from midnight
 * @property {number} endMin - End time in minutes from midnight
 * @property {string|null} trackId - Track this entry belongs to
 * @property {boolean} isSharedToAll - Whether this entry applies to all tracks
 * @property {Set<string>} applicableTracks - Set of track IDs this entry applies to
 */

/**
 * @typedef {Object} ConflictPair
 * @property {string} aId - First entry ID (alphabetically smaller)
 * @property {string} bId - Second entry ID (alphabetically larger)
 * @property {"overlap"} type - Type of conflict (currently only "overlap")
 */

/**
 * @typedef {Object} ConflictResult
 * @property {ConflictPair[]} pairs - Array of conflict pairs, sorted by (aId, bId)
 * @property {Map<string, string[]>} byEntryId - Map of entryId -> sorted array of conflicting entry IDs
 */

// parseTimeToMinutes is now in getEntryMinutes.js - use getSequenceMinutes for batch processing

/**
 * Build a Map of tracks keyed by id.
 *
 * @param {Track[]} tracks - Array of track objects
 * @returns {Map<string, Track>} Map keyed by track.id
 */
function buildTracksById(tracks) {
  return new Map((tracks || []).map((t) => [t.id, t]));
}

/**
 * Check if two entries have overlapping applicable tracks.
 *
 * Two entries can conflict if they have at least one track in common.
 * Shared-to-all entries overlap with any entry that has applicable tracks.
 *
 * @param {NormalizedEntry} a - First entry
 * @param {NormalizedEntry} b - Second entry
 * @returns {boolean}
 */
function hasOverlappingTracks(a, b) {
  // If either is shared-to-all, they can conflict (if the other has any tracks)
  if (a.isSharedToAll && b.applicableTracks.size > 0) return true;
  if (b.isSharedToAll && a.applicableTracks.size > 0) return true;

  // Otherwise, check for intersection
  for (const trackId of a.applicableTracks) {
    if (b.applicableTracks.has(trackId)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if two time ranges overlap using half-open interval semantics.
 * Overlap if: a.start < b.end AND b.start < a.end
 *
 * @param {NormalizedEntry} a - First entry
 * @param {NormalizedEntry} b - Second entry
 * @returns {boolean}
 */
function hasTimeOverlap(a, b) {
  return a.startMin < b.endMin && b.startMin < a.endMin;
}

/**
 * Detect schedule conflicts using pair-based counting.
 *
 * A conflict occurs when two entries:
 *   1. Overlap in time (half-open: a.start < b.end AND b.start < a.end)
 *   2. Apply to at least one common track
 *
 * Time derivation:
 *   - Entries are sorted by canonical order (sortEntriesCanonical)
 *   - getSequenceMinutes derives time for entries missing startTime (gapless)
 *   - This ensures entries without explicit time still participate in conflict detection
 *
 * @param {Object[]} entries - Schedule entries with:
 *   - id: string
 *   - trackId: string|null
 *   - startTimeCanonical: string (HH:MM) or startTime: string
 *   - durationMinutes: number or duration: number
 *   - appliesToTrackIds?: string[] (optional)
 *   - isBanner?: boolean (banners are excluded)
 *   - order?: number (for canonical sorting)
 * @param {Map<string, Track>|Object} tracksById - Track lookup (Map or object)
 * @param {Object} [opts] - Options
 * @param {number} [opts.defaultStartMin=0] - Fallback start time for first missing-time entry
 * @param {number} [opts.defaultDuration=15] - Default duration if missing
 * @returns {ConflictResult}
 */
export function detectConflictsPairwise(entries, tracksById, opts = {}) {
  const { defaultStartMin = 0, defaultDuration = 15 } = opts;

  // Convert tracksById to Map if it's an object
  const trackMap = tracksById instanceof Map
    ? tracksById
    : new Map(Object.entries(tracksById || {}));

  // Filter valid entries (exclude banners and entries without trackId)
  const validEntries = entries.filter((entry) => {
    if (entry.isBanner) return false;
    if (!entry.trackId) return false;
    return true;
  });

  // Sort entries canonically by order for deterministic time derivation
  const sortedEntries = sortEntriesCanonical(validEntries, { context: "detectConflictsPairwise" });

  // Get minutes for all entries using canonical helper (derives time for missing startTime)
  const minutesMap = getSequenceMinutes(sortedEntries, {
    fallbackStartMin: defaultStartMin,
    defaultDurationMin: defaultDuration,
  });

  // Normalize entries with time and track applicability
  const normalizedEntries = [];

  for (const entry of sortedEntries) {
    const minutes = minutesMap.get(entry.id);
    if (!minutes || minutes.startMin === null || minutes.endMin === null) {
      // Entry has no valid time even after derivation - skip
      continue;
    }

    // Get applicable tracks using canonical helper
    const applicability = getApplicableTrackIds(entry, trackMap);

    // Skip entries with no applicable tracks (invalid)
    if (applicability.kind === "none") continue;

    // Convert to Set for efficient intersection checks
    const applicableTracks = new Set(applicability.trackIds);
    const isSharedToAll = applicability.kind === "all";

    normalizedEntries.push({
      id: entry.id,
      startMin: minutes.startMin,
      endMin: minutes.endMin,
      trackId: entry.trackId,
      isSharedToAll,
      applicableTracks,
    });
  }

  // Collect conflict pairs
  const pairSet = new Set();
  const byEntryIdMap = new Map();

  // O(n^2) pairwise check
  for (let i = 0; i < normalizedEntries.length; i++) {
    const a = normalizedEntries[i];

    for (let j = i + 1; j < normalizedEntries.length; j++) {
      const b = normalizedEntries[j];

      // Check time overlap
      if (!hasTimeOverlap(a, b)) continue;

      // Check track overlap
      if (!hasOverlappingTracks(a, b)) continue;

      // Create stable pair key using sorted IDs
      const [minId, maxId] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
      const pairKey = `${minId}::${maxId}`;

      pairSet.add(pairKey);

      // Track in byEntryId
      if (!byEntryIdMap.has(a.id)) {
        byEntryIdMap.set(a.id, new Set());
      }
      if (!byEntryIdMap.has(b.id)) {
        byEntryIdMap.set(b.id, new Set());
      }
      byEntryIdMap.get(a.id).add(b.id);
      byEntryIdMap.get(b.id).add(a.id);
    }
  }

  // Convert pairs to sorted array
  const sortedPairKeys = Array.from(pairSet).sort();
  const pairs = sortedPairKeys.map((key) => {
    const [aId, bId] = key.split("::");
    return { aId, bId, type: "overlap" };
  });

  // Convert byEntryId to sorted Map
  const byEntryId = new Map();
  const sortedEntryIds = Array.from(byEntryIdMap.keys()).sort();
  for (const entryId of sortedEntryIds) {
    const conflictingIds = Array.from(byEntryIdMap.get(entryId)).sort();
    byEntryId.set(entryId, conflictingIds);
  }

  return { pairs, byEntryId };
}

/**
 * Get the total number of unique conflict pairs.
 *
 * @param {ConflictResult} result - Result from detectConflictsPairwise
 * @returns {number}
 */
export function getTotalConflictPairCount(result) {
  return result.pairs.length;
}

/**
 * Get the set of entry IDs involved in any conflict.
 *
 * @param {ConflictResult} result - Result from detectConflictsPairwise
 * @returns {Set<string>}
 */
export function getEntryIdsInConflicts(result) {
  return new Set(result.byEntryId.keys());
}

/**
 * Check if a specific entry is involved in any conflict.
 *
 * @param {ConflictResult} result - Result from detectConflictsPairwise
 * @param {string} entryId - Entry ID to check
 * @returns {boolean}
 */
export function hasConflict(result, entryId) {
  return result.byEntryId.has(entryId);
}

/**
 * Get all entry IDs that conflict with a specific entry.
 *
 * @param {ConflictResult} result - Result from detectConflictsPairwise
 * @param {string} entryId - Entry ID to check
 * @returns {string[]} Array of conflicting entry IDs (sorted)
 */
export function getConflictingEntries(result, entryId) {
  return result.byEntryId.get(entryId) || [];
}
