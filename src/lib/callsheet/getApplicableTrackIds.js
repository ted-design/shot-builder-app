// src/lib/callsheet/getApplicableTrackIds.js
// Canonical helper to compute an entry's applicable tracks deterministically.
//
// This is the SINGLE source of truth for determining which tracks an entry
// applies to, with explicit kind classification:
//   - "all": Entry applies to ALL lane tracks (shared/banner spanning all lanes)
//   - "subset": Entry applies to a SUBSET of lane tracks (appliesToTrackIds)
//   - "single": Entry applies to exactly ONE lane track
//   - "none": Entry is invalid (missing/invalid trackId with no appliesToTrackIds)
//
// Used by:
//   - detectConflictsPairwise.js (conflict detection)
//   - ScheduleBoardView.jsx (badge rendering and spanning behavior)
//   - ScheduleTableSection.tsx (badge/marker semantics)

/**
 * @typedef {"all" | "subset" | "single" | "none"} ApplicabilityKind
 */

/**
 * @typedef {Object} ApplicabilityResult
 * @property {ApplicabilityKind} kind - Classification of the entry's applicability
 * @property {string[]} trackIds - Array of applicable track IDs (sorted alphabetically)
 * @property {string} reason - Human-readable explanation for debugging
 */

/**
 * Get all lane track IDs from a tracks collection, sorted alphabetically.
 * Excludes tracks with scope="shared" or id="shared".
 *
 * @param {Map<string, Object>|Object} tracksById - Track lookup (Map or object)
 * @returns {string[]} Sorted array of lane track IDs
 */
function getLaneTrackIdsSorted(tracksById) {
  const laneIds = [];

  if (tracksById instanceof Map) {
    for (const [id, track] of tracksById) {
      if (track.scope !== "shared" && id !== "shared") {
        laneIds.push(id);
      }
    }
  } else if (tracksById && typeof tracksById === "object") {
    for (const [id, track] of Object.entries(tracksById)) {
      if (track && track.scope !== "shared" && id !== "shared") {
        laneIds.push(id);
      }
    }
  }

  return laneIds.sort();
}

/**
 * Determine which tracks an entry applies to with explicit kind classification.
 *
 * Rules (EXPLICIT, NO SILENT DEFAULTS):
 *
 * 1. **Invalid (none)**: entry has missing/invalid trackId AND no appliesToTrackIds
 *    - kind="none", trackIds=[]
 *
 * 2. **Shared-to-all (all)**: entry.trackId === "shared" OR entry.trackId === "all" OR track.scope === "shared"
 *    - kind="all", trackIds = all lane trackIds (excludes shared scope tracks)
 *
 * 3. **Subset (subset)**: entry.appliesToTrackIds is a non-empty array
 *    - kind="subset", trackIds = filtered to only valid lane trackIds that exist
 *    - Note: even if appliesToTrackIds contains all lanes, kind remains "subset"
 *      (explicit subset semantics vs implicit "all")
 *
 * 4. **Single lane (single)**: entry.trackId references a valid lane track
 *    - kind="single", trackIds=[entry.trackId]
 *
 * 5. **Fallback (none)**: entry has invalid trackId (not found or shared scope check failed)
 *    - kind="none", trackIds=[]
 *
 * Determinism:
 * - trackIds are ALWAYS sorted alphabetically for stable output
 * - No reliance on object iteration order
 *
 * @param {Object} entry - Schedule entry
 * @param {string|null|undefined} entry.trackId - Track this entry belongs to
 * @param {Array<string>|null|undefined} entry.appliesToTrackIds - Specific tracks this entry applies to
 * @param {Map<string, Object>|Object} tracksById - Track lookup (Map or object keyed by track.id)
 * @returns {ApplicabilityResult}
 */
export function getApplicableTrackIds(entry, tracksById) {
  // Get all valid lane track IDs upfront (sorted)
  const allLaneTrackIds = getLaneTrackIdsSorted(tracksById);
  const laneTrackIdSet = new Set(allLaneTrackIds);

  // Normalize tracksById access
  const getTrack = (id) => {
    if (!id) return null;
    if (tracksById instanceof Map) {
      return tracksById.get(id);
    }
    return tracksById?.[id] ?? null;
  };

  // Rule 1: Check for missing trackId first
  const hasTrackId = entry.trackId != null && entry.trackId !== "";
  const hasAppliesToTrackIds = Array.isArray(entry.appliesToTrackIds) && entry.appliesToTrackIds.length > 0;

  // Rule 2: Check for shared-to-all (before checking appliesToTrackIds)
  // This takes precedence because explicit "shared" trackId means ALL lanes
  if (hasTrackId) {
    if (entry.trackId === "shared" || entry.trackId === "all") {
      return {
        kind: "all",
        trackIds: allLaneTrackIds,
        reason: `trackId === "${entry.trackId}" (explicit shared-to-all)`,
      };
    }

    const track = getTrack(entry.trackId);
    if (track?.scope === "shared") {
      return {
        kind: "all",
        trackIds: allLaneTrackIds,
        reason: `track "${entry.trackId}" has scope="shared" (shared-to-all)`,
      };
    }
  }

  // Rule 3: Check for appliesToTrackIds (subset behavior)
  if (hasAppliesToTrackIds) {
    // Filter to only valid lane track IDs and sort
    const validSubset = entry.appliesToTrackIds
      .filter((id) => laneTrackIdSet.has(id))
      .sort();

    if (validSubset.length > 0) {
      return {
        kind: "subset",
        trackIds: validSubset,
        reason: `appliesToTrackIds contains ${validSubset.length} valid lane track(s)`,
      };
    }
    // If appliesToTrackIds exists but all IDs are invalid, fall through to single/none
  }

  // Rule 4: Check for valid single lane track
  if (hasTrackId) {
    const track = getTrack(entry.trackId);
    if (track && laneTrackIdSet.has(entry.trackId)) {
      return {
        kind: "single",
        trackIds: [entry.trackId],
        reason: `valid lane track "${entry.trackId}"`,
      };
    }
  }

  // Rule 5: Invalid - no valid trackId and no valid appliesToTrackIds
  if (!hasTrackId) {
    return {
      kind: "none",
      trackIds: [],
      reason: "missing trackId and no valid appliesToTrackIds",
    };
  }

  return {
    kind: "none",
    trackIds: [],
    reason: `invalid trackId "${entry.trackId}" (not found or not a lane track)`,
  };
}

/**
 * Check if an entry is shared-to-all (applies to all lane tracks).
 * Convenience wrapper for common use case.
 *
 * @param {Object} entry - Schedule entry
 * @param {Map<string, Object>|Object} tracksById - Track lookup
 * @returns {boolean}
 */
export function isSharedToAllTracks(entry, tracksById) {
  return getApplicableTrackIds(entry, tracksById).kind === "all";
}

/**
 * Generate a concise display label for an entry's applicable tracks.
 *
 * @param {ApplicabilityResult} result - Result from getApplicableTrackIds
 * @param {Map<string, Object>|Object} tracksById - Track lookup for names
 * @returns {string|null} Display label, or null for single/none kinds
 */
export function getApplicabilityLabel(result, tracksById) {
  if (result.kind === "all") {
    return "All Tracks";
  }

  if (result.kind === "subset" && result.trackIds.length > 0) {
    // Get track names for the subset
    const getTrackName = (id) => {
      if (tracksById instanceof Map) {
        return tracksById.get(id)?.name;
      }
      return tracksById?.[id]?.name;
    };

    const names = result.trackIds
      .map((id) => getTrackName(id) || id)
      .slice(0, 3); // Limit to 3 for display

    if (result.trackIds.length > 3) {
      return `${names.join(", ")} +${result.trackIds.length - 3}`;
    }
    return names.join(" + ");
  }

  // "single" and "none" don't need a label (track chip handles single)
  return null;
}
