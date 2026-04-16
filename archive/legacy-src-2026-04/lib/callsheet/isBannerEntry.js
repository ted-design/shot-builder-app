// src/lib/callsheet/isBannerEntry.js
// Canonical banner detection for schedule entries
//
// This module provides a SINGLE source of truth for determining whether
// a schedule entry is a "banner" (shared/all-track entry that spans lanes).
//
// Used by:
//   - DayStreamView.jsx (editor banner section)
//   - classifyEntry.js (projection classification)
//   - ScheduleBlockSection.tsx (preview rendering)
//
// Banner detection rules (all must have type="custom"):
//   1. trackId === "all" (quick banner creation)
//   2. trackId === "shared" (modal banner creation)
//   3. entry.role === "banner" (explicit role marker)
//   4. Non-empty appliesToTrackIds array (applies to multiple tracks)
//
// Note: Track scope ("shared") is checked separately in classifyEntry
// because it requires track lookup. This helper checks entry-level fields only.

/**
 * Check if a schedule entry is a banner (spans all tracks).
 *
 * Banners are custom entries that apply to all tracks rather than
 * a single lane. They appear as full-width strips in the schedule.
 *
 * @param {Object} entry - The schedule entry to check
 * @param {string} [entry.type] - Entry type ("shot" | "custom")
 * @param {string|null} [entry.trackId] - Track ID this entry belongs to
 * @param {string|null} [entry.role] - Entry role (e.g., "banner")
 * @param {string[]|null} [entry.appliesToTrackIds] - Track IDs this entry applies to
 * @returns {boolean} True if the entry is a banner
 */
export function isBannerEntry(entry) {
  if (!entry) return false;

  // Only custom entries can be banners (shots are always lane-scoped)
  if (entry.type !== "custom") return false;

  // Check trackId for banner markers
  // "all" is used by quick banner creation
  // "shared" is used by modal banner creation
  if (entry.trackId === "all" || entry.trackId === "shared") {
    return true;
  }

  // Check explicit role marker
  if (entry.role === "banner") {
    return true;
  }

  // Check if entry applies to multiple tracks (banner behavior)
  if (Array.isArray(entry.appliesToTrackIds) && entry.appliesToTrackIds.length > 0) {
    return true;
  }

  return false;
}
