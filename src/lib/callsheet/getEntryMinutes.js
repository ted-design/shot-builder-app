// src/lib/callsheet/getEntryMinutes.js
// Canonical helper for deriving start/end minutes from schedule entries
//
// This module provides a SINGLE source of truth for time-to-minutes conversion.
// Entries may have explicit startTime OR derive it from canonical order (gapless).
//
// IMPORTANT:
//   - Derivation must be applied ONLY in a sorted-by-order sequence
//   - This helper does NOT sort; caller must supply entries already sorted (sortEntriesCanonical)
//   - This is for rendering/conflicts only; do NOT write derived time back to Firestore
//
// Used by:
//   - detectConflictsPairwise.js (conflict detection)
//   - ScheduleBoardView.jsx (grid positioning)
//   - ScheduleTableSection.tsx (preview table)
//   - syncIntervalEngine.js (interval boundaries)

/**
 * @typedef {Object} EntryMinutesResult
 * @property {number|null} startMin - Start time in minutes from midnight, or null if unavailable
 * @property {number|null} endMin - End time in minutes from midnight, or null if unavailable
 * @property {"explicit"|"derived"|"none"} source - How the time was determined
 */

/**
 * Parse time string to minutes from midnight.
 * Supports HH:MM (24h) and h:mm AM/PM (12h) formats.
 *
 * @param {string|null|undefined} time - Time string
 * @returns {number|null} Minutes from midnight, or null if invalid
 */
function parseTimeToMinutes(time) {
  if (!time || typeof time !== "string") return null;

  // Try canonical 24h format "HH:MM" first
  const match24 = time.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return hours * 60 + minutes;
    }
  }

  // Fallback: 12h format "7:00 AM", "2:30 PM"
  const match12 = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const meridiem = match12[3]?.toUpperCase();

    if (meridiem === "PM" && hours !== 12) {
      hours += 12;
    } else if (meridiem === "AM" && hours === 12) {
      hours = 0;
    }

    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return hours * 60 + minutes;
    }
  }

  return null;
}

/**
 * Parse duration to minutes.
 * Prefers numeric value (canonical), falls back to field aliases.
 *
 * @param {Object} entry - Entry with duration field(s)
 * @returns {number|null} Duration in minutes, or null if not available
 */
function parseDuration(entry) {
  // Prefer canonical durationMinutes field
  if (
    typeof entry.durationMinutes === "number" &&
    isFinite(entry.durationMinutes) &&
    entry.durationMinutes > 0
  ) {
    return entry.durationMinutes;
  }

  // Fallback: duration field (numeric)
  if (
    typeof entry.duration === "number" &&
    isFinite(entry.duration) &&
    entry.duration > 0
  ) {
    return entry.duration;
  }

  return null;
}

/**
 * Get start/end minutes for a single entry.
 *
 * For explicit startTime: parses and returns source="explicit"
 * For missing startTime: returns null values with source="none"
 *
 * This is the non-derived version. For derived values in a sequence, use getSequenceMinutes.
 *
 * @param {Object} entry - Schedule entry
 * @param {Object} opts - Options
 * @param {number} opts.defaultDurationMin - Default duration if missing (REQUIRED)
 * @returns {EntryMinutesResult}
 */
export function getEntryMinutes(entry, { defaultDurationMin }) {
  if (typeof defaultDurationMin !== "number" || !isFinite(defaultDurationMin)) {
    throw new Error("getEntryMinutes: defaultDurationMin is required and must be a finite number");
  }

  // Try to parse explicit start time (prefer canonical fields)
  let startMin = null;
  if (entry.startTimeCanonical) {
    startMin = parseTimeToMinutes(entry.startTimeCanonical);
  }
  if (startMin === null && entry.startTime) {
    startMin = parseTimeToMinutes(entry.startTime);
  }
  if (startMin === null && entry.time) {
    startMin = parseTimeToMinutes(entry.time);
  }

  // If no explicit start time, return "none" source
  if (startMin === null) {
    return {
      startMin: null,
      endMin: null,
      source: "none",
    };
  }

  // Parse duration
  let durationMin = parseDuration(entry);
  if (durationMin === null) {
    durationMin = defaultDurationMin;
  }

  return {
    startMin,
    endMin: startMin + durationMin,
    source: "explicit",
  };
}

/**
 * Get start/end minutes for a sequence of entries, deriving time for missing startTime entries.
 *
 * IMPORTANT: Entries MUST be sorted by canonical order (sortEntriesCanonical) before calling.
 *
 * Derivation rules (explicit, deterministic):
 * - If entry.startTime is valid -> parse -> source="explicit"
 * - Else derive deterministically using canonical order:
 *   - First missing-time entry starts at fallbackStartMin
 *   - Subsequent missing-time entries start at previous entry's endMin (gapless)
 *   - endMin = startMin + (entry.duration || defaultDurationMin)
 *
 * @param {Object[]} sortedEntries - Entries sorted by canonical order (REQUIRED)
 * @param {Object} opts - Options
 * @param {number} opts.fallbackStartMin - Start time for first missing-time entry (REQUIRED)
 * @param {number} opts.defaultDurationMin - Default duration if missing (REQUIRED)
 * @returns {Map<string, EntryMinutesResult>} Map of entryId -> minutes result
 */
export function getSequenceMinutes(sortedEntries, { fallbackStartMin, defaultDurationMin }) {
  if (typeof fallbackStartMin !== "number" || !isFinite(fallbackStartMin)) {
    throw new Error("getSequenceMinutes: fallbackStartMin is required and must be a finite number");
  }
  if (typeof defaultDurationMin !== "number" || !isFinite(defaultDurationMin)) {
    throw new Error("getSequenceMinutes: defaultDurationMin is required and must be a finite number");
  }

  const results = new Map();

  // Track the end of the previous entry for gapless derivation
  let previousEndMin = fallbackStartMin;

  for (const entry of sortedEntries) {
    if (!entry.id) continue;

    // Get single entry minutes
    const singleResult = getEntryMinutes(entry, { defaultDurationMin });

    if (singleResult.source === "explicit") {
      // Explicit time - use it and update previous end
      results.set(entry.id, singleResult);
      previousEndMin = singleResult.endMin;
    } else {
      // Missing time - derive from previous entry's end (gapless)
      let durationMin = parseDuration(entry);
      if (durationMin === null) {
        durationMin = defaultDurationMin;
      }

      const derivedStartMin = previousEndMin;
      const derivedEndMin = derivedStartMin + durationMin;

      results.set(entry.id, {
        startMin: derivedStartMin,
        endMin: derivedEndMin,
        source: "derived",
      });

      previousEndMin = derivedEndMin;
    }
  }

  return results;
}

/**
 * Check if an entry has an explicit (parseable) start time.
 *
 * @param {Object} entry - Schedule entry
 * @returns {boolean} True if entry has explicit start time
 */
export function hasExplicitStartTime(entry) {
  if (entry.startTimeCanonical && parseTimeToMinutes(entry.startTimeCanonical) !== null) {
    return true;
  }
  if (entry.startTime && parseTimeToMinutes(entry.startTime) !== null) {
    return true;
  }
  if (entry.time && parseTimeToMinutes(entry.time) !== null) {
    return true;
  }
  return false;
}

// Re-export parseTimeToMinutes for callers that need direct access
export { parseTimeToMinutes };
