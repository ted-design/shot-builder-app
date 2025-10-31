import { useMemo } from "react";
import { useShots } from "./useFirestoreQuery";
import { DEFAULT_TAGS, DEFAULT_TAG_GROUPS } from "../lib/defaultTags";

const PROJECT_TAG_GROUP_ID = "project";
const PROJECT_TAG_GROUP_LABEL = "Project Tags";
const DEFAULT_TAG_INDEX = new Map(DEFAULT_TAGS.map((tag) => [tag.id, tag]));
const DEFAULT_GROUP_LABELS = new Map(
  DEFAULT_TAG_GROUPS.map((group) => [group.id, group.label])
);
const DEFAULT_GROUP_DESCRIPTIONS = new Map(
  DEFAULT_TAG_GROUPS.map((group) => [group.id, group.description])
);

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

    // Seed with default tags so they are always available
    DEFAULT_TAGS.forEach((tag) => {
      tagMap.set(tag.id, { ...tag });
    });

    shots.forEach((shot) => {
      if (!Array.isArray(shot.tags)) return;

      shot.tags.forEach((tag) => {
        if (!tag || !tag.id || !tag.label) return;

        const trimmedLabel = String(tag.label).trim();
        if (!trimmedLabel) return;

        const defaultTag = DEFAULT_TAG_INDEX.get(tag.id) || null;
        const groupId = tag.groupId || defaultTag?.groupId || PROJECT_TAG_GROUP_ID;
        const groupLabel = tag.groupLabel
          || defaultTag?.groupLabel
          || DEFAULT_GROUP_LABELS.get(groupId)
          || (groupId === PROJECT_TAG_GROUP_ID ? PROJECT_TAG_GROUP_LABEL : null);
        const groupDescription = tag.groupDescription
          || defaultTag?.groupDescription
          || DEFAULT_GROUP_DESCRIPTIONS.get(groupId)
          || null;

        const entry = {
          id: tag.id,
          label: trimmedLabel,
          color: tag.color || defaultTag?.color || "gray",
          groupId,
          groupLabel,
          groupDescription,
          isDefault: Boolean(tag.isDefault || defaultTag?.isDefault),
        };

        if (tagMap.has(entry.id)) {
          const existing = tagMap.get(entry.id);
          tagMap.set(entry.id, {
            ...existing,
            ...entry,
          });
        } else {
          tagMap.set(entry.id, entry);
        }
      });
    });

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
