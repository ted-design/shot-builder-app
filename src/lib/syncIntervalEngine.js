// src/lib/syncIntervalEngine.js
// Sync Interval Engine for multi-lane timeline rendering
// Guarantees vertical alignment across lanes by using time-interval rows
// instead of entry-based rows.

import { parseTimeToMinutes, minutesToTimeString, minutesToTime12h } from "./timeUtils";

/**
 * @typedef {Object} SyncInterval
 * @property {number} startMin - Start time in minutes from midnight
 * @property {number} endMin - End time in minutes from midnight
 * @property {number} durationMin - Duration of this interval in minutes
 * @property {string} startTime - Start time in HH:MM format
 * @property {string} endTime - End time in HH:MM format
 * @property {string} label - Human-readable label (e.g., "9:00 AM")
 */

/**
 * @typedef {Object} Lane
 * @property {string} id - Lane identifier
 * @property {string} name - Display name
 * @property {string} color - Hex color code
 * @property {number} order - Sort order
 */

/**
 * @typedef {Object} OccupancyCell
 * @property {string|null} entryId - Entry ID occupying this cell, or null if empty
 * @property {boolean} isStart - True if this is the first interval of the entry
 * @property {boolean} isEnd - True if this is the last interval of the entry
 * @property {number} rowSpan - Total intervals this entry spans (only meaningful on isStart)
 */

/**
 * @typedef {Object} Conflict
 * @property {string} laneId - Lane where conflict occurs
 * @property {number} intervalIndex - Interval index where conflict occurs
 * @property {string[]} entryIds - Array of entry IDs that overlap
 * @property {string} intervalLabel - Human-readable interval time (e.g., "7:00 AM - 7:15 AM")
 */

/**
 * @typedef {Object} SyncIntervalGridData
 * @property {Lane[]} lanes - Ordered list of lanes
 * @property {SyncInterval[]} intervals - Ordered list of time intervals (rows)
 * @property {Map<number, Map<string, OccupancyCell>>} occupancy - Map of intervalIndex -> Map of laneId -> OccupancyCell
 * @property {Map<string, Object>} entryMetadata - Map of entryId -> { startIntervalIndex, endIntervalIndex, laneId }
 * @property {string[]} conflictWarnings - Array of conflict warning messages (legacy)
 * @property {Conflict[]} conflicts - Structured conflict data for rendering
 * @property {Map<string, number>} conflictCountByLane - Map of laneId -> conflict count
 */

/**
 * Extract unique time boundaries from all entries across all lanes.
 * Uses half-open intervals [start, end) semantics.
 *
 * @param {Array} entries - Schedule entries with startTime (HH:MM) and duration (minutes)
 * @returns {number[]} Sorted array of unique time boundaries in minutes
 */
export function extractTimeBoundaries(entries) {
  const boundaries = new Set();

  for (const entry of entries) {
    const startMin = parseTimeToMinutes(entry.startTime || "00:00");
    const duration = typeof entry.duration === "number" ? entry.duration : 15;
    const endMin = startMin + duration;

    boundaries.add(startMin);
    boundaries.add(endMin);
  }

  // Sort boundaries in ascending order
  return Array.from(boundaries).sort((a, b) => a - b);
}

/**
 * Convert time boundaries into intervals.
 * Each interval represents a row in the sync grid.
 *
 * @param {number[]} boundaries - Sorted array of time boundaries in minutes
 * @returns {SyncInterval[]} Array of intervals
 */
export function boundariesToIntervals(boundaries) {
  if (boundaries.length < 2) {
    return [];
  }

  const intervals = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const startMin = boundaries[i];
    const endMin = boundaries[i + 1];
    const durationMin = endMin - startMin;

    intervals.push({
      startMin,
      endMin,
      durationMin,
      startTime: minutesToTimeString(startMin),
      endTime: minutesToTimeString(endMin),
      label: minutesToTime12h(startMin),
    });
  }

  return intervals;
}

/**
 * Derive a stable list of lanes from tracks.
 * Includes a synthetic "Shared" lane at the beginning for shared-scope entries.
 *
 * @param {Array} tracks - Track definitions with id, name, color, order, scope
 * @param {Array} entries - Optional entries array to check if shared lane is needed
 * @returns {Lane[]} Ordered array of lane tracks
 */
export function deriveLanes(tracks, entries = []) {
  if (!tracks || tracks.length === 0) {
    return [];
  }

  // Find the shared track definition (if any)
  const sharedTrack = tracks.find(
    (t) => t.scope === "shared" || t.id === "shared"
  );

  // Check if there are any entries that belong to the shared lane
  const hasSharedEntries = entries.some(
    (e) =>
      e.trackId === "shared" ||
      !e.trackId ||
      (sharedTrack && e.trackId === sharedTrack.id)
  );

  // Filter to lane-scope tracks only (exclude shared)
  const laneTracks = tracks.filter(
    (t) => t.scope !== "shared" && t.id !== "shared"
  );

  // Sort by order, then by id for stability
  const sortedLaneTracks = laneTracks
    .map((t) => ({
      id: t.id,
      name: t.name || t.id,
      color: t.color || "#64748B",
      order: typeof t.order === "number" ? t.order : 999,
    }))
    .sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.id.localeCompare(b.id);
    });

  // Prepend synthetic Shared lane if there are shared entries
  if (hasSharedEntries && sharedTrack) {
    const sharedLane = {
      id: sharedTrack.id,
      name: sharedTrack.name || "Shared",
      color: sharedTrack.color || "#64748B",
      order: -1, // Always first
    };
    return [sharedLane, ...sortedLaneTracks];
  }

  return sortedLaneTracks;
}

/**
 * Build occupancy map: which entry occupies each interval cell.
 * Detects conflicts where multiple entries occupy the same lane at the same time.
 *
 * @param {SyncInterval[]} intervals - Time intervals
 * @param {Lane[]} lanes - Lane definitions
 * @param {Array} entries - Schedule entries with trackId, startTime, duration
 * @returns {{ occupancy: Map, entryMetadata: Map, conflictWarnings: string[], conflicts: Conflict[], conflictCountByLane: Map }}
 */
export function buildOccupancyMap(intervals, lanes, entries) {
  // Map of intervalIndex -> Map of laneId -> OccupancyCell
  const occupancy = new Map();
  // Map of entryId -> { startIntervalIndex, endIntervalIndex, laneId }
  const entryMetadata = new Map();
  // Conflict warnings (legacy string format)
  const conflictWarnings = [];
  // Structured conflicts for rendering
  const conflicts = [];
  // Track conflicts by lane for header badges
  const conflictCountByLane = new Map();
  // Track which interval+lane combos already have conflicts (to avoid duplicates)
  const conflictKeys = new Set();

  // Initialize occupancy map with null cells
  for (let i = 0; i < intervals.length; i++) {
    const laneCells = new Map();
    for (const lane of lanes) {
      laneCells.set(lane.id, { entryId: null, isStart: false, isEnd: false, rowSpan: 0 });
    }
    occupancy.set(i, laneCells);
  }

  // Build lane ID set for validation
  const laneIds = new Set(lanes.map((l) => l.id));

  // Filter entries to only those in valid lanes
  const laneEntries = entries.filter((entry) => laneIds.has(entry.trackId));

  // Track all entries per interval+lane for multi-entry conflict detection
  const entriesByIntervalLane = new Map(); // Map of "intervalIndex-laneId" -> entry IDs array

  // Process each entry
  for (const entry of laneEntries) {
    const entryStartMin = parseTimeToMinutes(entry.startTime || "00:00");
    const duration = typeof entry.duration === "number" ? entry.duration : 15;
    const entryEndMin = entryStartMin + duration;
    const laneId = entry.trackId;

    // Find which intervals this entry covers
    // Using half-open interval logic: entry covers interval [i] if
    // entry.start < interval.end AND entry.end > interval.start
    let startIntervalIndex = -1;
    let endIntervalIndex = -1;

    for (let i = 0; i < intervals.length; i++) {
      const interval = intervals[i];
      // Check if entry overlaps this interval
      if (entryStartMin < interval.endMin && entryEndMin > interval.startMin) {
        if (startIntervalIndex === -1) {
          startIntervalIndex = i;
        }
        endIntervalIndex = i;
      }
    }

    if (startIntervalIndex === -1) {
      // Entry doesn't fit in any interval - skip
      continue;
    }

    // Calculate row span
    const rowSpan = endIntervalIndex - startIntervalIndex + 1;

    // Store entry metadata
    entryMetadata.set(entry.id, {
      startIntervalIndex,
      endIntervalIndex,
      laneId,
      rowSpan,
    });

    // Track entries per interval+lane for conflict detection
    for (let i = startIntervalIndex; i <= endIntervalIndex; i++) {
      const key = `${i}-${laneId}`;
      if (!entriesByIntervalLane.has(key)) {
        entriesByIntervalLane.set(key, []);
      }
      entriesByIntervalLane.get(key).push(entry.id);
    }

    // Fill occupancy cells
    for (let i = startIntervalIndex; i <= endIntervalIndex; i++) {
      const laneCells = occupancy.get(i);
      if (!laneCells) continue;

      const existingCell = laneCells.get(laneId);
      if (existingCell && existingCell.entryId !== null) {
        // Conflict! Multiple entries in same lane at same time
        conflictWarnings.push(
          `Conflict at interval ${i} (${intervals[i].startTime}-${intervals[i].endTime}) in lane "${laneId}": ` +
          `entry "${existingCell.entryId}" already occupies this cell, overlapping with "${entry.id}"`
        );
        // Keep the existing entry (first wins)
        continue;
      }

      laneCells.set(laneId, {
        entryId: entry.id,
        isStart: i === startIntervalIndex,
        isEnd: i === endIntervalIndex,
        rowSpan: i === startIntervalIndex ? rowSpan : 0,
      });
    }
  }

  // Build structured conflicts from entriesByIntervalLane
  for (const [key, entryIds] of entriesByIntervalLane) {
    if (entryIds.length > 1) {
      // Conflict detected
      const [intervalIndexStr, laneId] = key.split("-");
      const intervalIndex = parseInt(intervalIndexStr, 10);
      const conflictKey = `${intervalIndex}-${laneId}`;

      if (!conflictKeys.has(conflictKey)) {
        conflictKeys.add(conflictKey);
        const interval = intervals[intervalIndex];
        conflicts.push({
          laneId,
          intervalIndex,
          entryIds: [...entryIds],
          intervalLabel: `${interval.label} - ${minutesToTime12h(interval.endMin)}`,
        });

        // Increment lane conflict count
        const currentCount = conflictCountByLane.get(laneId) || 0;
        conflictCountByLane.set(laneId, currentCount + 1);
      }
    }
  }

  return { occupancy, entryMetadata, conflictWarnings, conflicts, conflictCountByLane };
}

/**
 * Build complete sync interval grid data for rendering.
 * This is the main entry point for the Sync Interval Engine.
 *
 * @param {Array} entries - Schedule entries
 * @param {Array} tracks - Track definitions
 * @returns {SyncIntervalGridData}
 *
 * @example
 * const gridData = buildSyncIntervalGrid(entries, tracks);
 * // gridData.lanes = [{ id: "photo", name: "Photo", ... }, ...]
 * // gridData.intervals = [{ startMin: 420, endMin: 450, durationMin: 30, ... }, ...]
 * // gridData.occupancy.get(0).get("photo") = { entryId: "entry-1", isStart: true, rowSpan: 2 }
 */
export function buildSyncIntervalGrid(entries, tracks) {
  // Step 1: Derive lanes from tracks (pass entries to detect shared lane need)
  const lanes = deriveLanes(tracks, entries);

  if (lanes.length === 0 || entries.length === 0) {
    return {
      lanes,
      intervals: [],
      occupancy: new Map(),
      entryMetadata: new Map(),
      conflictWarnings: [],
      conflicts: [],
      conflictCountByLane: new Map(),
    };
  }

  // Build lane ID set
  const laneIds = new Set(lanes.map((l) => l.id));

  // Map entries with missing/null trackId to appropriate lane
  // Priority: 1) shared lane (if exists), 2) primary (first) lane track
  const normalizedEntries = entries.map((entry) => {
    if (!entry.trackId || !laneIds.has(entry.trackId)) {
      // Check if shared lane exists first
      const sharedLane = lanes.find((l) => l.id === "shared");
      if (sharedLane) {
        return { ...entry, trackId: "shared" };
      }
      // Fallback to primary (first) lane track to avoid dropping entries
      const primaryLane = lanes[0];
      if (primaryLane) {
        return { ...entry, trackId: primaryLane.id };
      }
    }
    return entry;
  });

  // Filter entries to only those in lane tracks
  const laneEntries = normalizedEntries.filter((entry) => laneIds.has(entry.trackId));

  if (laneEntries.length === 0) {
    return {
      lanes,
      intervals: [],
      occupancy: new Map(),
      entryMetadata: new Map(),
      conflictWarnings: [],
      conflicts: [],
      conflictCountByLane: new Map(),
    };
  }

  // Step 2: Extract time boundaries
  const boundaries = extractTimeBoundaries(laneEntries);

  // Step 3: Convert to intervals
  const intervals = boundariesToIntervals(boundaries);

  // Step 4: Build occupancy map
  const { occupancy, entryMetadata, conflictWarnings, conflicts, conflictCountByLane } = buildOccupancyMap(
    intervals,
    lanes,
    laneEntries
  );

  return {
    lanes,
    intervals,
    occupancy,
    entryMetadata,
    conflictWarnings,
    conflicts,
    conflictCountByLane,
  };
}

/**
 * Calculate row heights for intervals.
 * Ensures time-proportional heights with a minimum for readability.
 *
 * @param {SyncInterval[]} intervals - Time intervals
 * @param {number} pxPerMinute - Pixels per minute (zoom factor)
 * @param {number} minRowHeight - Minimum row height in pixels
 * @returns {number[]} Array of row heights in pixels, indexed by interval index
 *
 * @example
 * const heights = calculateRowHeights(intervals, 2, 40);
 * // heights[0] = 60 (30min * 2px = 60px, above min)
 * // heights[1] = 40 (15min * 2px = 30px, clamped to min 40px)
 */
export function calculateRowHeights(intervals, pxPerMinute = 2, minRowHeight = 40) {
  return intervals.map((interval) => {
    const naturalHeight = interval.durationMin * pxPerMinute;
    return Math.max(naturalHeight, minRowHeight);
  });
}

/**
 * Generate CSS grid template rows string from row heights.
 *
 * @param {number[]} rowHeights - Array of row heights in pixels
 * @returns {string} CSS grid-template-rows value
 *
 * @example
 * generateGridTemplateRows([60, 40, 80]) // => "60px 40px 80px"
 */
export function generateGridTemplateRows(rowHeights) {
  return rowHeights.map((h) => `${h}px`).join(" ");
}

/**
 * Get unique entries that need to be rendered (one block per entry).
 * Returns entries with their grid positioning info.
 *
 * @param {SyncIntervalGridData} gridData - Grid data from buildSyncIntervalGrid
 * @param {Array} entries - Original entries array (for full entry data)
 * @returns {Array<{ entry: Object, startRow: number, rowSpan: number, laneId: string }>}
 */
export function getEntryRenderInfo(gridData, entries) {
  const result = [];
  const entriesById = new Map(entries.map((e) => [e.id, e]));

  for (const [entryId, meta] of gridData.entryMetadata) {
    const entry = entriesById.get(entryId);
    if (!entry) continue;

    result.push({
      entry,
      // CSS grid is 1-indexed, so add 1
      startRow: meta.startIntervalIndex + 1,
      rowSpan: meta.rowSpan,
      laneId: meta.laneId,
    });
  }

  return result;
}

/**
 * Get lane index for CSS grid column positioning.
 *
 * @param {Lane[]} lanes - Ordered lanes array
 * @param {string} laneId - Lane ID to find
 * @returns {number} 1-indexed column number for CSS grid
 */
export function getLaneColumn(lanes, laneId) {
  const index = lanes.findIndex((l) => l.id === laneId);
  // CSS grid is 1-indexed; add 1 for time column, add 1 for 1-indexing
  return index === -1 ? 2 : index + 2; // +1 for time col, +1 for 1-index
}
