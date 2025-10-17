import { useMemo } from "react";
import { useShots } from "./useFirestoreQuery";

/**
 * Hook for aggregating unique tags from all shots in a project
 *
 * This hook leverages the useShots hook's caching and real-time updates
 * to provide a list of unique tags available across all shots in a project.
 *
 * @param {string} clientId - Client ID
 * @param {string} projectId - Project ID to filter shots
 * @returns {object} Result with availableTags array and loading state
 *
 * @example
 * const { availableTags, isLoading } = useAvailableTags(clientId, projectId);
 * // availableTags: [{ id: "tag-123", label: "Outdoor", color: "blue" }, ...]
 */
export function useAvailableTags(clientId, projectId) {
  // Fetch all shots for the project (with caching and real-time updates)
  const { data: shots = [], isLoading, error } = useShots(clientId, projectId);

  // Aggregate unique tags from all shots
  const availableTags = useMemo(() => {
    const tagMap = new Map();

    shots.forEach((shot) => {
      if (Array.isArray(shot.tags)) {
        shot.tags.forEach((tag) => {
          if (tag && tag.id && tag.label) {
            // Only store unique tags by ID
            // If the same tag ID appears multiple times, we keep the first occurrence
            if (!tagMap.has(tag.id)) {
              tagMap.set(tag.id, {
                id: tag.id,
                label: tag.label,
                color: tag.color || "gray",
              });
            }
          }
        });
      }
    });

    // Convert to array and sort alphabetically by label
    return Array.from(tagMap.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  }, [shots]);

  return {
    availableTags,
    isLoading,
    error,
  };
}
