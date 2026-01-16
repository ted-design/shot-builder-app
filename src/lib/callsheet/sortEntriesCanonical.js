// src/lib/callsheet/sortEntriesCanonical.js
// Canonical entry ordering for schedule rendering
//
// This module provides a SINGLE source of truth for ordering schedule entries.
// Order is canonical; time is derived. No time-based sorting fallbacks.
//
// Used by:
//   - ScheduleBoardView.jsx (editor Board view)
//   - PreviewPanel.jsx (preview/PDF rendering)

/**
 * Set of entry IDs we've already warned about missing/invalid order.
 * Keyed by `${entryId}:${reason}` to deduplicate warnings.
 */
const warnedOrderEntries = new Set();

/**
 * Emit a deduplicated warning for entries with missing/invalid order.
 * Safe for repeated calls - will only warn once per (entryId, reason) pair.
 *
 * @param {Object} entry - The entry with invalid order
 * @param {string} entry.id - Entry ID
 * @param {string} [entry.type] - Entry type ("shot" | "custom")
 * @param {string} [entry.shotNumber] - Shot number (for shot entries)
 * @param {Object} [entry.customData] - Custom data (for custom entries)
 * @param {string} reason - Reason ("missing" | "invalid")
 * @param {string} [context="sortEntriesCanonical"] - Context for warning
 */
function warnMissingOrder(entry, reason, context = "sortEntriesCanonical") {
  const key = `${entry.id}:order:${reason}`;
  if (warnedOrderEntries.has(key)) return;
  warnedOrderEntries.add(key);

  const label = entry.type === "shot"
    ? `Shot ${entry.shotNumber || entry.id}`
    : entry.customData?.title || `Entry ${entry.id}`;

  if (reason === "missing") {
    console.warn(
      `[${context}] Entry "${label}" has no order value. ` +
      `It will be sorted to the end. Consider assigning an order.`
    );
  } else {
    console.warn(
      `[${context}] Entry "${label}" has invalid order=${entry.order}. ` +
      `It will be sorted to the end.`
    );
  }
}

/**
 * Check if order value is valid (finite number).
 *
 * @param {*} order - The order value to check
 * @returns {boolean} True if order is a finite number
 */
function isValidOrder(order) {
  return typeof order === "number" && Number.isFinite(order);
}

/**
 * Sort schedule entries canonically by order, with deterministic tie-breaking.
 *
 * Sorting rules (explicit, deterministic):
 *
 * 1. **Primary**: entry.order (ascending) IF it is a finite number
 * 2. **Missing/invalid order**: entry goes to the end AND emits a DEDUPED warning
 * 3. **Tie-breaker**: entry.id (string compare) to guarantee deterministic output
 *
 * IMPORTANT: No time-based sorting. No derived-time fallback. No implicit defaults.
 *
 * @param {Array<Object>} entries - The schedule entries to sort
 * @param {Object} [options] - Options
 * @param {string} [options.context] - Context for warning messages
 * @returns {Array<Object>} New sorted array (does not mutate input)
 */
export function sortEntriesCanonical(entries, options = {}) {
  if (!Array.isArray(entries)) return [];
  if (entries.length === 0) return [];

  const context = options.context || "sortEntriesCanonical";

  // Create a copy to avoid mutating the original
  return [...entries].sort((a, b) => {
    const aOrderValid = isValidOrder(a.order);
    const bOrderValid = isValidOrder(b.order);

    // Both have valid orders: compare them
    if (aOrderValid && bOrderValid) {
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      // Tie-breaker: id (string compare for determinism)
      return (a.id || "").localeCompare(b.id || "");
    }

    // a has valid order, b does not: a comes first
    if (aOrderValid && !bOrderValid) {
      warnMissingOrder(b, isValidOrder(b.order) ? "invalid" : "missing", context);
      return -1;
    }

    // b has valid order, a does not: b comes first
    if (!aOrderValid && bOrderValid) {
      warnMissingOrder(a, isValidOrder(a.order) ? "invalid" : "missing", context);
      return 1;
    }

    // Neither has valid order: both go to end, tie-break by id
    warnMissingOrder(a, isValidOrder(a.order) ? "invalid" : "missing", context);
    warnMissingOrder(b, isValidOrder(b.order) ? "invalid" : "missing", context);
    return (a.id || "").localeCompare(b.id || "");
  });
}

/**
 * Clear the warning set (useful for tests).
 */
export function clearOrderWarnings() {
  warnedOrderEntries.clear();
}
