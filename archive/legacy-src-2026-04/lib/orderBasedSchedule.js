/**
 * Order-based schedule engine.
 *
 * When cascade mode is ON, the `order` field is the canonical source of truth
 * for entry sequencing within a track. Start times are derived from the order
 * plus entry durations.
 *
 * This module provides:
 * 1. Migration: deriveOrderFromEntries - assigns sequential order per track
 * 2. Derivation: computeDerivedStartTimes - computes times from order + durations
 * 3. Sorting: sortEntriesByOrder - canonical order-first sorting for cascade mode
 */

import { minutesToTimeString, parseTimeToMinutes } from "./timeUtils";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const DEFAULT_DURATION = 15;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Parse start time to minutes since midnight.
 * @param {Object} entry - Schedule entry
 * @returns {number} Minutes since midnight
 */
function getStartMinutes(entry) {
  return parseTimeToMinutes(entry?.startTime || "00:00");
}

/**
 * Get duration in minutes (default to DEFAULT_DURATION if invalid).
 * @param {Object} entry - Schedule entry
 * @returns {number} Duration in minutes
 */
function getDurationMinutes(entry) {
  const raw = entry?.duration;
  if (typeof raw !== "number" || Number.isNaN(raw) || raw <= 0) {
    return DEFAULT_DURATION;
  }
  return Math.round(raw);
}

/**
 * Group entries by trackId.
 * @param {Array} entries - All entries
 * @returns {Map<string, Array>} Map of trackId to entries
 */
function groupByTrack(entries) {
  const byTrack = new Map();
  for (const entry of entries) {
    if (!entry?.trackId) continue;
    const list = byTrack.get(entry.trackId) || [];
    list.push(entry);
    byTrack.set(entry.trackId, list);
  }
  return byTrack;
}

// -----------------------------------------------------------------------------
// Migration: Derive order from existing entries
// -----------------------------------------------------------------------------

/**
 * Check if entries have valid order values.
 * Returns false if any entry is missing order or all entries have order=0.
 * @param {Array} entries - Track entries
 * @returns {boolean} True if orders are meaningful
 */
export function hasValidOrderValues(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return true;

  let hasNonZero = false;
  let hasMissing = false;

  for (const entry of entries) {
    const order = entry.order;
    if (order === undefined || order === null) {
      hasMissing = true;
    } else if (order !== 0) {
      hasNonZero = true;
    }
  }

  // If any are missing or all are zero, orders aren't meaningful
  if (hasMissing) return false;
  if (!hasNonZero && entries.length > 1) return false;

  return true;
}

/**
 * Derive order values for entries that don't have valid orders.
 * Sorts by (startTime ASC, createdAt ASC, id ASC) and assigns 0..n.
 *
 * @param {Array} trackEntries - Entries for a single track
 * @returns {Array<{id: string, order: number}>} List of order updates
 */
export function deriveOrderForTrackEntries(trackEntries) {
  if (!Array.isArray(trackEntries) || trackEntries.length === 0) return [];

  // Sort deterministically: startTime ASC, then createdAt ASC, then id ASC
  const sorted = [...trackEntries].sort((a, b) => {
    // Primary: startTime
    const aTime = getStartMinutes(a);
    const bTime = getStartMinutes(b);
    if (aTime !== bTime) return aTime - bTime;

    // Secondary: createdAt (handle Firestore Timestamp and Date)
    const aCreated = a.createdAt?.toMillis?.() ?? a.createdAt?.getTime?.() ?? 0;
    const bCreated = b.createdAt?.toMillis?.() ?? b.createdAt?.getTime?.() ?? 0;
    if (aCreated !== bCreated) return aCreated - bCreated;

    // Tertiary: id (stable tiebreaker)
    return (a.id || "").localeCompare(b.id || "");
  });

  // Assign sequential order values
  return sorted.map((entry, index) => ({
    id: entry.id,
    order: index,
  }));
}

/**
 * Derive order values for all entries across all tracks.
 * Only returns updates for tracks where orders are not valid.
 *
 * @param {Array} allEntries - All schedule entries
 * @returns {Array<{entryId: string, order: number}>} List of order updates
 */
export function deriveOrderFromEntries(allEntries) {
  if (!Array.isArray(allEntries) || allEntries.length === 0) return [];

  const byTrack = groupByTrack(allEntries);
  const updates = [];

  for (const [trackId, trackEntries] of byTrack) {
    // Skip if this track already has valid orders
    if (hasValidOrderValues(trackEntries)) continue;

    const derived = deriveOrderForTrackEntries(trackEntries);
    for (const { id, order } of derived) {
      const entry = trackEntries.find((e) => e.id === id);
      // Only include if order actually changed
      if (entry && (entry.order ?? -1) !== order) {
        updates.push({ entryId: id, order });
      }
    }
  }

  return updates;
}

// -----------------------------------------------------------------------------
// Derivation: Compute start times from canonical order
// -----------------------------------------------------------------------------

/**
 * Sort track entries by their canonical order field.
 * Falls back to startTime if orders are equal (shouldn't happen with valid data).
 *
 * @param {Array} trackEntries - Entries for a single track
 * @returns {Array} Sorted entries
 */
export function sortEntriesByOrder(trackEntries) {
  if (!Array.isArray(trackEntries)) return [];

  return [...trackEntries].sort((a, b) => {
    const aOrder = a.order ?? Number.MAX_SAFE_INTEGER;
    const bOrder = b.order ?? Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;

    // Fallback: sort by startTime if orders are equal
    const aTime = getStartMinutes(a);
    const bTime = getStartMinutes(b);
    return aTime - bTime;
  });
}

/**
 * Compute derived start times for a track based on canonical order.
 * Entries are sequenced gaplessly starting from the anchor time.
 *
 * @param {Array} trackEntries - Entries for a single track
 * @param {number} anchorStartMinutes - Starting time in minutes (e.g., 360 for 06:00)
 * @returns {Array<{id: string, derivedStartTime: string, derivedStartMinutes: number}>}
 */
export function computeDerivedStartTimes(trackEntries, anchorStartMinutes) {
  if (!Array.isArray(trackEntries) || trackEntries.length === 0) return [];

  const sorted = sortEntriesByOrder(trackEntries);
  let cursor = typeof anchorStartMinutes === "number" ? anchorStartMinutes : 0;

  return sorted.map((entry) => {
    const derivedStartMinutes = cursor;
    const derivedStartTime = minutesToTimeString(cursor);
    cursor += getDurationMinutes(entry);

    return {
      id: entry.id,
      derivedStartTime,
      derivedStartMinutes,
    };
  });
}

/**
 * Compute start time updates needed to align entries with canonical order.
 * Returns only entries where the derived time differs from current.
 *
 * @param {Array} trackEntries - Entries for a single track
 * @param {number} anchorStartMinutes - Starting time in minutes
 * @returns {Array<{entryId: string, startTime: string}>} Updates to apply
 */
export function computeStartTimeUpdates(trackEntries, anchorStartMinutes) {
  if (!Array.isArray(trackEntries) || trackEntries.length === 0) return [];

  const derived = computeDerivedStartTimes(trackEntries, anchorStartMinutes);
  const byId = new Map(trackEntries.map((e) => [e.id, e]));

  const updates = [];
  for (const { id, derivedStartTime } of derived) {
    const entry = byId.get(id);
    if (entry && entry.startTime !== derivedStartTime) {
      updates.push({ entryId: id, startTime: derivedStartTime });
    }
  }

  return updates;
}

// -----------------------------------------------------------------------------
// Reorder: Update orders after drag-drop
// -----------------------------------------------------------------------------

/**
 * Build order updates for reordering entries within a track.
 * Given a new sequence of IDs, assigns sequential order values.
 *
 * @param {Array} trackEntries - Current entries for the track
 * @param {Array<string>} newOrderedIds - Entry IDs in their new order
 * @returns {Array<{entryId: string, order: number}>} Order updates
 */
export function buildReorderUpdates(trackEntries, newOrderedIds) {
  if (!Array.isArray(trackEntries) || !Array.isArray(newOrderedIds)) return [];

  const byId = new Map(trackEntries.map((e) => [e.id, e]));
  const updates = [];

  newOrderedIds.forEach((id, index) => {
    const entry = byId.get(id);
    if (!entry) return;

    // Only include if order actually changed
    if ((entry.order ?? -1) !== index) {
      updates.push({ entryId: id, order: index });
    }
  });

  return updates;
}

/**
 * Build complete updates for a reorder operation when cascade is ON.
 * Updates both order values and derived start times.
 *
 * @param {Array} allEntries - All schedule entries
 * @param {string} trackId - Track being reordered
 * @param {Array<string>} newOrderedIds - Entry IDs in their new order
 * @param {Object} options - Options
 * @param {number} options.anchorStartMinutes - Anchor start time in minutes
 * @returns {Array<{entryId: string, order?: number, startTime?: string}>} Combined updates
 */
export function buildCascadeReorderUpdates(allEntries, trackId, newOrderedIds, options = {}) {
  if (!Array.isArray(allEntries) || !trackId || !Array.isArray(newOrderedIds)) {
    return [];
  }

  const trackEntries = allEntries.filter((e) => e.trackId === trackId);
  if (trackEntries.length === 0) return [];

  // Build order updates
  const orderUpdates = buildReorderUpdates(trackEntries, newOrderedIds);

  // Apply order updates to get new state for time derivation
  const updatedEntries = trackEntries.map((entry) => {
    const orderUpdate = orderUpdates.find((u) => u.entryId === entry.id);
    if (orderUpdate) {
      return { ...entry, order: orderUpdate.order };
    }
    return entry;
  });

  // Compute anchor from options or use earliest existing time
  let anchorStartMinutes = options.anchorStartMinutes;
  if (typeof anchorStartMinutes !== "number") {
    anchorStartMinutes = Math.min(...trackEntries.map(getStartMinutes));
  }

  // Build time updates based on new order
  const timeUpdates = computeStartTimeUpdates(updatedEntries, anchorStartMinutes);

  // Merge order and time updates
  const byId = new Map();

  for (const update of orderUpdates) {
    byId.set(update.entryId, { entryId: update.entryId, order: update.order });
  }

  for (const update of timeUpdates) {
    const existing = byId.get(update.entryId) || { entryId: update.entryId };
    byId.set(update.entryId, { ...existing, startTime: update.startTime });
  }

  return Array.from(byId.values());
}

// -----------------------------------------------------------------------------
// Utility: Get track anchor time
// -----------------------------------------------------------------------------

/**
 * Get the earliest start time in a track (used as anchor).
 * @param {Array} trackEntries - Entries for a single track
 * @returns {number|null} Earliest start time in minutes, or null if empty
 */
export function getTrackAnchorMinutes(trackEntries) {
  if (!Array.isArray(trackEntries) || trackEntries.length === 0) return null;

  let min = null;
  for (const entry of trackEntries) {
    const minutes = getStartMinutes(entry);
    if (min === null || minutes < min) {
      min = minutes;
    }
  }
  return min;
}
