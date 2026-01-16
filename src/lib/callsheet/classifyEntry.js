// src/lib/callsheet/classifyEntry.js
// Canonical entry classification for schedule rendering
//
// This module provides a SINGLE source of truth for determining whether
// a schedule entry is:
//   - A lane entry (renders in a specific track column)
//   - A shared/banner entry (spans multiple lanes)
//   - Invalid (missing or invalid trackId)
//
// Used by:
//   - ScheduleBoardView.jsx (editor Board view)
//   - PreviewPanel.jsx (preview/PDF rendering)

/**
 * @typedef {Object} ClassifyResult
 * @property {boolean} isValid - Whether the entry has a valid trackId
 * @property {boolean} isShared - Whether the entry is shared (spans lanes) or a banner
 * @property {string|null} laneTrackId - The track ID if it's a valid lane entry, null otherwise
 * @property {string|undefined} reason - Reason for invalid classification ("missing" | "invalid")
 */

/**
 * Classify a schedule entry as lane, shared/banner, or invalid.
 *
 * Classification rules (explicit, deterministic):
 *
 * 1. **Invalid (missing)**: entry.trackId is falsy (null, undefined, empty)
 *    - NOT silently promoted to shared
 *    - Returns: { isValid: false, isShared: false, laneTrackId: null, reason: "missing" }
 *
 * 2. **Shared (explicit trackId)**: entry.trackId === "shared"
 *    - Returns: { isValid: true, isShared: true, laneTrackId: null }
 *
 * 3. **Shared (appliesToTrackIds)**: entry.appliesToTrackIds is non-empty array
 *    - This indicates an entry that applies to specific lanes (banner behavior)
 *    - Returns: { isValid: true, isShared: true, laneTrackId: null }
 *
 * 4. **Invalid (track not found)**: trackId doesn't exist in tracksById
 *    - NOT silently promoted to shared
 *    - Returns: { isValid: false, isShared: false, laneTrackId: null, reason: "invalid" }
 *
 * 5. **Shared (track scope)**: track exists and track.scope === "shared"
 *    - Returns: { isValid: true, isShared: true, laneTrackId: null }
 *
 * 6. **Lane entry**: valid trackId referencing a lane-scoped track
 *    - Returns: { isValid: true, isShared: false, laneTrackId: trackId }
 *
 * @param {Object} entry - The schedule entry to classify
 * @param {string|null|undefined} entry.trackId - The track ID this entry belongs to
 * @param {Array<string>|null|undefined} entry.appliesToTrackIds - Track IDs this entry applies to
 * @param {Map<string, Object>|Object} tracksById - Map or object keyed by track.id
 *        Track objects may have optional `scope` property ("lane" | "shared")
 * @returns {ClassifyResult}
 */
export function classifyEntry(entry, tracksById) {
  // Rule 1: Missing trackId is invalid (not silently promoted)
  if (!entry.trackId) {
    return { isValid: false, isShared: false, laneTrackId: null, reason: "missing" };
  }

  // Rule 2: Explicit "shared" trackId
  if (entry.trackId === "shared") {
    return { isValid: true, isShared: true, laneTrackId: null };
  }

  // Rule 3: Non-empty appliesToTrackIds indicates shared/banner behavior
  if (Array.isArray(entry.appliesToTrackIds) && entry.appliesToTrackIds.length > 0) {
    return { isValid: true, isShared: true, laneTrackId: null };
  }

  // Lookup track (support both Map and plain object)
  const track = tracksById instanceof Map
    ? tracksById.get(entry.trackId)
    : tracksById[entry.trackId];

  // Rule 4: Track not found is invalid (not silently promoted)
  if (!track) {
    return { isValid: false, isShared: false, laneTrackId: null, reason: "invalid" };
  }

  // Rule 5: Track with shared scope
  if (track.scope === "shared") {
    return { isValid: true, isShared: true, laneTrackId: null };
  }

  // Rule 6: Valid lane entry
  return { isValid: true, isShared: false, laneTrackId: entry.trackId };
}

// Track IDs we've already warned about to avoid log spam
const warnedMissingTrackIds = new Set();

/**
 * Emit a deduplicated warning for entries with missing/invalid trackId.
 * Safe for repeated calls - will only warn once per (entryId, reason) pair.
 *
 * @param {Object} entry - The entry with invalid trackId
 * @param {string} entry.id - Entry ID
 * @param {string} [entry.type] - Entry type ("shot" | "custom")
 * @param {string} [entry.shotNumber] - Shot number (for shot entries)
 * @param {string} [entry.shotRef] - Shot reference (for shot entries)
 * @param {Object} [entry.customData] - Custom data (for custom entries)
 * @param {string} [entry.customData.title] - Custom entry title
 * @param {string} [entry.trackId] - The invalid trackId
 * @param {string} reason - Reason for classification failure ("missing" | "invalid")
 * @param {string} [context="ScheduleEntry"] - Context for the warning message
 */
export function warnInvalidEntry(entry, reason, context = "ScheduleEntry") {
  const key = `${entry.id}-${reason}`;
  if (warnedMissingTrackIds.has(key)) return;
  warnedMissingTrackIds.add(key);

  const label = entry.type === "shot"
    ? `Shot ${entry.shotNumber || entry.shotRef || entry.id}`
    : entry.customData?.title || `Entry ${entry.id}`;

  if (reason === "missing") {
    console.warn(
      `[${context}] Entry "${label}" has no trackId and will not be rendered. ` +
      `Assign it to a track or set trackId="shared" for lane-spanning behavior.`
    );
  } else {
    console.warn(
      `[${context}] Entry "${label}" references invalid trackId="${entry.trackId}" ` +
      `and will not be rendered.`
    );
  }
}

/**
 * Build a Map of tracks keyed by id for efficient lookup.
 *
 * @param {Array<{id: string, scope?: string}>} tracks - Array of track objects
 * @returns {Map<string, Object>} Map keyed by track.id
 */
export function buildTracksById(tracks) {
  return new Map((tracks || []).map((t) => [t.id, t]));
}
