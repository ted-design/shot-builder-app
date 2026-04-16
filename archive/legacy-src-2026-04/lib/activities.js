/**
 * Activity types and utilities for Shot Builder activity feed
 *
 * Provides type definitions, formatting utilities, and metadata
 * for project-level activity logging and timeline display.
 */

/**
 * Activity type definitions with metadata for UI rendering
 *
 * Each activity type includes:
 * - type: Unique identifier for the activity
 * - icon: Lucide icon name for visual representation
 * - color: Color theme for the activity (matches Tailwind palette)
 * - label: Human-readable label
 * - template: Function to generate activity description
 */
export const ACTIVITY_TYPES = {
  // Shot Operations
  SHOT_CREATED: {
    type: "shot_created",
    icon: "Plus",
    color: "green",
    label: "Created shot",
    template: (activity) => `created ${activity.entityName || "a shot"}`,
  },

  SHOT_UPDATED: {
    type: "shot_updated",
    icon: "Edit",
    color: "blue",
    label: "Updated shot",
    template: (activity) => {
      const field = activity.metadata?.field;
      const fieldLabels = {
        status: "status",
        location: "location",
        talent: "talent",
        products: "products",
        date: "shoot date",
        notes: "notes",
        shotNumber: "shot number",
        name: "name",
      };
      const fieldName = fieldLabels[field] || "details";
      return `updated ${fieldName} for ${activity.entityName || "a shot"}`;
    },
  },

  SHOT_DELETED: {
    type: "shot_deleted",
    icon: "Trash2",
    color: "red",
    label: "Deleted shot",
    template: (activity) => `deleted ${activity.entityName || "a shot"}`,
  },

  STATUS_CHANGED: {
    type: "status_changed",
    icon: "RefreshCw",
    color: "purple",
    label: "Changed status",
    template: (activity) => {
      const { fromStatus, toStatus } = activity.metadata || {};
      const shotName = activity.entityName || "a shot";
      if (fromStatus && toStatus) {
        return `moved ${shotName} from ${fromStatus} to ${toStatus}`;
      }
      return `changed status of ${shotName}`;
    },
  },

  // Comment Operations
  COMMENT_ADDED: {
    type: "comment_added",
    icon: "MessageSquare",
    color: "blue",
    label: "Commented",
    template: (activity) => `commented on ${activity.entityName || "a shot"}`,
  },

  COMMENT_EDITED: {
    type: "comment_edited",
    icon: "Edit",
    color: "gray",
    label: "Edited comment",
    template: (activity) =>
      `edited a comment on ${activity.entityName || "a shot"}`,
  },

  COMMENT_DELETED: {
    type: "comment_deleted",
    icon: "Trash2",
    color: "gray",
    label: "Deleted comment",
    template: (activity) =>
      `deleted a comment on ${activity.entityName || "a shot"}`,
  },

  // Bulk Operations
  BULK_UPDATED: {
    type: "bulk_updated",
    icon: "Layers",
    color: "indigo",
    label: "Bulk updated shots",
    template: (activity) => {
      const count = activity.metadata?.shotCount || 0;
      const field = activity.metadata?.updateField || "field";
      return `bulk updated ${count} shot${count !== 1 ? "s" : ""} (${field})`;
    },
  },

  // Project Operations (future enhancement)
  PROJECT_CREATED: {
    type: "project_created",
    icon: "FolderPlus",
    color: "green",
    label: "Created project",
    template: (activity) =>
      `created project ${activity.entityName || "a project"}`,
  },

  PROJECT_UPDATED: {
    type: "project_updated",
    icon: "FolderOpen",
    color: "blue",
    label: "Updated project",
    template: (activity) => `updated project settings`,
  },
};

/**
 * Get activity type metadata by type string
 *
 * @param {string} type - Activity type identifier
 * @returns {object|null} Type metadata or null if not found
 *
 * @example
 * const metadata = getActivityType('shot_created');
 * console.log(metadata.label); // "Created shot"
 */
export function getActivityType(type) {
  const typeKey = Object.keys(ACTIVITY_TYPES).find(
    (key) => ACTIVITY_TYPES[key].type === type
  );
  return typeKey ? ACTIVITY_TYPES[typeKey] : null;
}

/**
 * Format activity description using template function
 *
 * @param {object} activity - Activity document from Firestore
 * @returns {string} Formatted description
 *
 * @example
 * const activity = {
 *   type: 'shot_created',
 *   entityName: 'Shot A-101',
 *   actorName: 'Alex Rivera',
 * };
 * formatActivityDescription(activity); // "created Shot A-101"
 */
export function formatActivityDescription(activity) {
  const activityType = getActivityType(activity.type);
  if (!activityType) {
    console.warn(`[Activities] Unknown activity type: ${activity.type}`);
    return "performed an action";
  }

  try {
    return activityType.template(activity);
  } catch (error) {
    console.error(
      `[Activities] Error formatting activity ${activity.id}:`,
      error
    );
    return "performed an action";
  }
}

/**
 * Get all activity types as an array
 *
 * @returns {Array} Array of activity type objects
 *
 * @example
 * const types = getActivityTypesList();
 * types.forEach(type => console.log(type.label));
 */
export function getActivityTypesList() {
  return Object.values(ACTIVITY_TYPES);
}

/**
 * Check if an activity type exists
 *
 * @param {string} type - Activity type to check
 * @returns {boolean} True if type exists
 *
 * @example
 * isValidActivityType('shot_created'); // true
 * isValidActivityType('invalid_type'); // false
 */
export function isValidActivityType(type) {
  return getActivityType(type) !== null;
}
