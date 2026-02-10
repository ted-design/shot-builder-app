// src/lib/callsheet/buildEntryTimeCascadePlan.js
// Builds deterministic mutation plans for entry updates that include startTime.

import { buildGaplessTimeChangeUpdates } from "../gaplessSchedule";

function hasOwnKey(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function normalizeStartTime(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

/**
 * Build a mutation plan for updates that include startTime.
 *
 * Plan rules:
 * - If updates do not include startTime: return null (caller should use normal path).
 * - If startTime is cleared/blank OR cascade is OFF: single-entry update only.
 * - If startTime is non-empty and cascade is ON:
 *   - derive timing updates via gapless helper,
 *   - merge non-timing fields onto the target entry update,
 *   - return single/batch plan based on update count.
 *
 * @param {Array} allEntries - Current schedule entries
 * @param {string} entryId - Target entry ID being updated
 * @param {Object} updates - Partial updates from UI
 * @param {Object} [options]
 * @param {boolean} [options.cascadeChanges=true] - Whether cascade is enabled
 * @returns {{mode: "none" | "single" | "batch", updates: Array<{entryId: string}>} | null}
 */
export function buildEntryTimeCascadePlan(allEntries, entryId, updates, options = {}) {
  if (!entryId || !updates || !hasOwnKey(updates, "startTime")) return null;

  const cascadeChanges = options.cascadeChanges !== false;
  const normalizedStartTime = normalizeStartTime(updates.startTime);

  // Clearing time (or cascade disabled) is always a direct single-entry update.
  if (!normalizedStartTime || !cascadeChanges) {
    return {
      mode: "single",
      updates: [{ entryId, ...updates, startTime: normalizedStartTime }],
    };
  }

  const hasDurationUpdate = hasOwnKey(updates, "duration");
  const timingEntries =
    hasDurationUpdate && Array.isArray(allEntries)
      ? allEntries.map((entry) => (entry.id === entryId ? { ...entry, duration: updates.duration } : entry))
      : allEntries;

  const timingUpdates = buildGaplessTimeChangeUpdates(timingEntries, entryId, normalizedStartTime);
  const mergedById = new Map();

  for (const update of timingUpdates) {
    mergedById.set(update.entryId, { ...update });
  }

  // Merge original non-time fields into target entry, preserving computed timing fields for others.
  const target = mergedById.get(entryId) || { entryId };
  mergedById.set(entryId, {
    ...target,
    ...updates,
    startTime: normalizedStartTime,
  });

  const mergedUpdates = Array.from(mergedById.values()).filter((update) => Object.keys(update).length > 1);

  if (mergedUpdates.length === 0) return { mode: "none", updates: [] };
  if (mergedUpdates.length === 1) return { mode: "single", updates: mergedUpdates };
  return { mode: "batch", updates: mergedUpdates };
}

