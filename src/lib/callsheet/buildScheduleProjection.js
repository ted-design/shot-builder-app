// src/lib/callsheet/buildScheduleProjection.js
// Canonical schedule projection module for PDF/Preview rendering
//
// This module provides a SINGLE source of truth for schedule projection.
// It combines canonical helpers to produce a complete, ready-to-render projection.
//
// Order is canonical; time may be derived. This projection ensures PDF/Preview
// cannot independently sort/group entries - they must consume the projection.
//
// Used by:
//   - PreviewPanel.jsx (buildModernCallSheetData)
//   - ScheduleTableSection.tsx (conflict detection via projection)
//   - CallSheetExportModal.jsx (PDF export)

import { sortEntriesCanonical } from "./sortEntriesCanonical";
import { classifyEntry, buildTracksById } from "./classifyEntry";
import { getApplicableTrackIds, getApplicabilityLabel } from "./getApplicableTrackIds";
import { getSequenceMinutes } from "./getEntryMinutes";
import {
  detectConflictsPairwise,
  getTotalConflictPairCount,
  getEntryIdsInConflicts,
} from "./detectConflictsPairwise";

/**
 * @typedef {"sequence"|"time"} ScheduleProjectionMode
 * - "sequence": rows sorted by entry.order asc (tie-breaker: id) - editorial order
 * - "time": rows sorted by startMin asc (tie-breakers: entry.order asc, then id) - chronological
 */

/**
 * @typedef {Object} ScheduleProjectionOptions
 * @property {"sequence"|"time"} mode - Projection mode (REQUIRED, no default)
 * @property {number} fallbackStartMin - Start time for first missing-time entry (REQUIRED)
 * @property {number} defaultDurationMin - Default duration if missing (REQUIRED)
 * @property {(entry: Object) => string} [formatTime12h] - Optional time formatter (for display)
 * @property {string} [context] - Context for debug logging
 */

/**
 * @typedef {Object} ProjectedTableRow
 * @property {string} id - Entry ID
 * @property {string} time - Display-formatted time (e.g., "7:00 AM")
 * @property {string} duration - Display-formatted duration (e.g., "30m")
 * @property {string} description - Entry description/title
 * @property {string} cast - Cast members (comma-separated)
 * @property {string} notes - Entry notes
 * @property {{name: string, address: string}|null} location - Location info
 * @property {boolean} isBanner - Whether this is a banner/shared entry
 * @property {Object|null} marker - Visual marker for quick identification
 * @property {string|null} trackId - Track this entry belongs to
 * @property {string|null} startTimeCanonical - Canonical start time (HH:MM)
 * @property {number|null} durationMinutes - Canonical duration in minutes
 * @property {string[]|null} appliesToTrackIds - Track IDs this entry applies to
 * @property {"all"|"subset"|"single"|"none"} applicabilityKind - Applicability classification
 * @property {boolean} hasConflict - Whether this entry has a conflict
 * @property {"explicit"|"derived"|"none"} timeSource - How time was determined
 * @property {number} order - Original entry order (for reference/debugging)
 * @property {number|null} startMin - Start time in minutes from midnight (for sorting)
 */

/**
 * @typedef {Object} ScheduleProjection
 * @property {"sequence"|"time"} mode - The projection mode used
 * @property {Object[]} orderedEntries - Entries sorted by canonical order (immutable copy)
 * @property {Map<string, Object>} tracksById - Track lookup map
 * @property {Map<string, Object>} applicabilityById - Entry ID -> ApplicabilityResult
 * @property {Map<string, Object>} minutesById - Entry ID -> EntryMinutesResult
 * @property {Object} conflicts - ConflictResult from detectConflictsPairwise
 * @property {number} conflictPairCount - Total number of conflict pairs
 * @property {Set<string>} entryIdsInConflicts - Set of entry IDs involved in conflicts
 * @property {ProjectedTableRow[]} tableRows - Ready-to-render rows for preview/PDF
 */

/**
 * Format time from HH:MM to 12h display format.
 * Default implementation if not provided in options.
 *
 * @param {string|null|undefined} time - Time in HH:MM format
 * @returns {string} Formatted time (e.g., "7:00 AM") or empty string
 */
function defaultFormatTime12h(time) {
  if (!time) return "";
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return time;
  let h = parseInt(match[1], 10);
  const m = match[2];
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

/**
 * Build a complete schedule projection from raw entries and tracks.
 *
 * This function is the SINGLE entry point for PDF/Preview schedule rendering.
 * It ensures:
 *   - Entries are sorted canonically by order (not time)
 *   - Applicability is computed once and reused
 *   - Time/duration is derived consistently (explicit or gapless)
 *   - Conflicts are detected using the SAME minutes/applicability data
 *   - Table rows are built deterministically from the projection
 *
 * The output is immutable - input entries are NOT mutated.
 *
 * @param {Object} params - Parameters
 * @param {Object[]} params.entries - Raw schedule entries
 * @param {Object[]} params.tracks - Track definitions (id, name, scope?)
 * @param {ScheduleProjectionOptions} params.options - Options
 * @returns {ScheduleProjection}
 */
export function buildScheduleProjection({ entries, tracks, options }) {
  const {
    mode,
    fallbackStartMin,
    defaultDurationMin,
    formatTime12h = defaultFormatTime12h,
    context = "buildScheduleProjection",
  } = options || {};

  // Validate required options
  if (mode !== "sequence" && mode !== "time") {
    throw new Error(`${context}: mode is required and must be "sequence" or "time" (got: ${mode})`);
  }
  if (typeof fallbackStartMin !== "number" || !Number.isFinite(fallbackStartMin)) {
    throw new Error(`${context}: fallbackStartMin is required and must be a finite number`);
  }
  if (typeof defaultDurationMin !== "number" || !Number.isFinite(defaultDurationMin)) {
    throw new Error(`${context}: defaultDurationMin is required and must be a finite number`);
  }

  // Build tracks lookup deterministically
  const tracksById = buildTracksById(tracks || []);

  // Sort entries canonically by order (not time) - creates a copy
  const orderedEntries = sortEntriesCanonical(entries || [], { context });

  // Compute applicability for each entry
  const applicabilityById = new Map();
  for (const entry of orderedEntries) {
    if (!entry.id) continue;
    const applicability = getApplicableTrackIds(entry, tracksById);
    applicabilityById.set(entry.id, applicability);
  }

  // Compute minutes for sequence (derives time for missing startTime)
  const minutesById = getSequenceMinutes(orderedEntries, {
    fallbackStartMin,
    defaultDurationMin,
  });

  // Detect conflicts using the SAME applicability/minutes semantics
  // Pass tracksById to detectConflictsPairwise for track-aware conflict detection
  const conflicts = detectConflictsPairwise(orderedEntries, tracksById, {
    defaultStartMin: fallbackStartMin,
    defaultDuration: defaultDurationMin,
  });

  const conflictPairCount = getTotalConflictPairCount(conflicts);
  const entryIdsInConflicts = getEntryIdsInConflicts(conflicts);

  // Build table rows in canonical order
  const tableRows = [];

  for (const entry of orderedEntries) {
    if (!entry.id) continue;

    const classification = classifyEntry(entry, tracksById);
    const applicability = applicabilityById.get(entry.id);
    const minutes = minutesById.get(entry.id);

    // Skip invalid entries (no trackId and no appliesToTrackIds)
    // But we still include them in tableRows with a warning state
    const isBanner = classification.isShared;

    // Build description from available fields
    const titleParts = [];
    if (entry.shotNumber) titleParts.push(entry.shotNumber);
    if (entry.resolvedTitle) titleParts.push(entry.resolvedTitle);
    const description = titleParts.length > 0
      ? titleParts.join(" — ")
      : entry.resolvedTitle || entry.customData?.title || "—";

    // Cast/talent
    const cast = Array.isArray(entry.resolvedTalent)
      ? entry.resolvedTalent.filter(Boolean).join(", ")
      : "";

    // Notes
    const notes = entry.resolvedNotes || entry.description || "";

    // Location
    const locationName = entry.resolvedLocation || "";
    const location = locationName ? { name: locationName, address: "" } : null;

    // Canonical time values
    const startTimeCanonical = entry.startTime || null;
    const durationMinutes = typeof entry.duration === "number" ? entry.duration : null;

    // AppliesToTrackIds for conflict detection passthrough
    const appliesToTrackIds = Array.isArray(entry.appliesToTrackIds) && entry.appliesToTrackIds.length > 0
      ? entry.appliesToTrackIds
      : null;

    // Format display time (from canonical or derived)
    let displayTime = "";
    if (entry.startTime) {
      displayTime = formatTime12h(entry.startTime);
    } else if (minutes?.startMin != null) {
      // Convert derived minutes back to HH:MM for display
      const h = Math.floor(minutes.startMin / 60) % 24;
      const m = minutes.startMin % 60;
      const hhMM = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      displayTime = formatTime12h(hhMM);
    }

    // Format duration for display
    const displayDuration = typeof entry.duration === "number" ? `${entry.duration}m` : "";

    // Extract order and startMin for sorting
    const entryOrder = typeof entry.order === "number" ? entry.order : Infinity;
    const rowStartMin = minutes?.startMin ?? null;
    const timeSource = minutes?.source || "none";

    tableRows.push({
      id: String(entry.id),
      time: displayTime,
      duration: displayDuration,
      description,
      cast: cast || "—",
      notes: notes || "—",
      location,
      isBanner,
      marker: entry.marker || null,
      colorKey: entry.colorKey || null,
      trackId: entry.trackId || null,
      // Canonical fields for downstream conflict display
      startTimeCanonical,
      durationMinutes,
      appliesToTrackIds,
      // Applicability kind for badge rendering
      applicabilityKind: applicability?.kind || "none",
      // Conflict status
      hasConflict: entryIdsInConflicts.has(entry.id),
      // Time source for rendering (explicit, derived, none)
      timeSource,
      // Original entry order (for sorting/debugging)
      order: entryOrder,
      // Start time in minutes (for sorting)
      startMin: rowStartMin,
    });
  }

  // Sort tableRows based on mode (deterministic, stable)
  if (mode === "time") {
    // mode="time": sort by startMin asc, tie-breaker: order asc, final tie-breaker: id
    // Entries with null startMin go to end (timeSource="none")
    tableRows.sort((a, b) => {
      // Null startMin goes to end
      const aHasTime = a.startMin !== null;
      const bHasTime = b.startMin !== null;
      if (aHasTime && !bHasTime) return -1;
      if (!aHasTime && bHasTime) return 1;

      // Both have time: sort by startMin
      if (aHasTime && bHasTime) {
        if (a.startMin !== b.startMin) {
          return a.startMin - b.startMin;
        }
      }

      // Tie-breaker: order asc
      if (a.order !== b.order) {
        return a.order - b.order;
      }

      // Final tie-breaker: id (string comparison for stability)
      return a.id.localeCompare(b.id);
    });
  }
  // mode="sequence": already in canonical order from orderedEntries loop (no re-sort needed)

  return {
    mode,
    orderedEntries,
    tracksById,
    applicabilityById,
    minutesById,
    conflicts,
    conflictPairCount,
    entryIdsInConflicts,
    tableRows,
  };
}

/**
 * Get the track name map from a projection.
 * Convenience helper for display rendering.
 *
 * @param {ScheduleProjection} projection - The projection
 * @returns {Record<string, string>} Map of trackId -> track name
 */
export function getTrackNameMap(projection) {
  const map = {};
  for (const [id, track] of projection.tracksById) {
    map[id] = track.name;
  }
  return map;
}
