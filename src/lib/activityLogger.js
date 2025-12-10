/**
 * Activity logging utilities for Shot Builder
 *
 * Provides safe, non-blocking activity logging to Firestore.
 * CRITICAL: Activity logging failures must NEVER break core functionality.
 */

import { collection, addDoc, serverTimestamp, writeBatch, query, where, limit, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { isDemoModeActive } from "./flags";

/**
 * Log an activity to Firestore
 *
 * This is the core logging function used by all activity loggers.
 * It safely handles errors to ensure logging never breaks core functionality.
 *
 * @param {string} clientId - Client ID
 * @param {string} projectId - Project ID
 * @param {object} activityData - Activity data
 * @param {string} activityData.type - Activity type
 * @param {string} activityData.actorId - Actor user ID
 * @param {string} activityData.actorName - Actor display name
 * @param {string|null} activityData.actorAvatar - Actor avatar URL
 * @param {string} activityData.entityType - Entity type (shot, comment, project)
 * @param {string|null} activityData.entityId - Entity ID
 * @param {string|null} activityData.entityName - Entity display name
 * @param {object} activityData.metadata - Type-specific metadata
 * @returns {Promise<string|null>} Activity ID or null if failed
 *
 * @example
 * await logActivity(clientId, projectId, {
 *   type: 'shot_created',
 *   actorId: 'user123',
 *   actorName: 'Alex Rivera',
 *   actorAvatar: 'https://avatar.url',
 *   entityType: 'shot',
 *   entityId: 'shot456',
 *   entityName: 'Shot A-101',
 *   metadata: {},
 * });
 */
export async function logActivity(clientId, projectId, activityData) {
  // Feature flag check (can be disabled in development)
  if (import.meta.env.VITE_DISABLE_ACTIVITY_LOGGING === "true") {
    return null;
  }

  // Demo mode: skip logging
  if (isDemoModeActive()) {
    console.info("[Demo Mode] Activity logging skipped:", activityData.type);
    return "demo-activity-id";
  }

  try {
    if (!clientId || !projectId) {
      console.warn("[Activity Logger] Missing clientId or projectId");
      return null;
    }

    if (!activityData.type || !activityData.actorId) {
      console.warn("[Activity Logger] Missing required activity fields");
      return null;
    }

    const activitiesRef = collection(
      db,
      "clients",
      clientId,
      "projects",
      projectId,
      "activities"
    );

    // Calculate expiration date (90 days from now)
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const activity = {
      ...activityData,
      projectId, // Redundant for collection group queries
      createdAt: serverTimestamp(),
      expiresAt,
    };

    const docRef = await addDoc(activitiesRef, activity);
    return docRef.id;
  } catch (error) {
    // CRITICAL: Never throw errors from activity logging
    // Logging failures should not break core functionality
    console.error("[Activity Logger] Failed to log activity:", error);

    // Optional: Send to error monitoring
    if (typeof window !== "undefined" && window.Sentry) {
      window.Sentry.captureException(error, {
        tags: { component: "activity-logger" },
        extra: { activityData },
      });
    }

    return null;
  }
}

/**
 * Create activity data for shot creation
 *
 * @param {string} actorId - Actor user ID
 * @param {string} actorName - Actor display name
 * @param {string|null} actorAvatar - Actor avatar URL
 * @param {object} shotData - Shot data
 * @returns {object} Activity data ready for logging
 */
export function createShotCreatedActivity(
  actorId,
  actorName,
  actorAvatar,
  shotData
) {
  return {
    type: "shot_created",
    actorId,
    actorName,
    actorAvatar,
    entityType: "shot",
    entityId: shotData.id,
    entityName: shotData.name || `Shot ${shotData.shotNumber || "Untitled"}`,
    metadata: {},
  };
}

/**
 * Create activity data for shot update
 *
 * @param {string} actorId - Actor user ID
 * @param {string} actorName - Actor display name
 * @param {string|null} actorAvatar - Actor avatar URL
 * @param {string} shotId - Shot ID
 * @param {string} shotName - Shot display name
 * @param {object} updates - Fields that were updated
 * @returns {object} Activity data ready for logging
 */
export function createShotUpdatedActivity(
  actorId,
  actorName,
  actorAvatar,
  shotId,
  shotName,
  updates
) {
  // Detect which field was updated (use first non-timestamp field)
  const updatedFields = Object.keys(updates).filter(
    (key) => !["updatedAt", "createdAt", "deleted"].includes(key)
  );

  const field = updatedFields[0] || "unknown";

  return {
    type: "shot_updated",
    actorId,
    actorName,
    actorAvatar,
    entityType: "shot",
    entityId: shotId,
    entityName: shotName,
    metadata: {
      field,
      newValue: updates[field],
    },
  };
}

/**
 * Create activity data for status change
 *
 * @param {string} actorId - Actor user ID
 * @param {string} actorName - Actor display name
 * @param {string|null} actorAvatar - Actor avatar URL
 * @param {string} shotId - Shot ID
 * @param {string} shotName - Shot display name
 * @param {string} fromStatus - Previous status
 * @param {string} toStatus - New status
 * @returns {object} Activity data ready for logging
 */
export function createStatusChangedActivity(
  actorId,
  actorName,
  actorAvatar,
  shotId,
  shotName,
  fromStatus,
  toStatus
) {
  return {
    type: "status_changed",
    actorId,
    actorName,
    actorAvatar,
    entityType: "shot",
    entityId: shotId,
    entityName: shotName,
    metadata: {
      field: "status",
      fromStatus,
      toStatus,
    },
  };
}

/**
 * Create activity data for shot deletion
 *
 * @param {string} actorId - Actor user ID
 * @param {string} actorName - Actor display name
 * @param {string|null} actorAvatar - Actor avatar URL
 * @param {string} shotId - Shot ID
 * @param {string} shotName - Shot display name
 * @returns {object} Activity data ready for logging
 */
export function createShotDeletedActivity(
  actorId,
  actorName,
  actorAvatar,
  shotId,
  shotName
) {
  return {
    type: "shot_deleted",
    actorId,
    actorName,
    actorAvatar,
    entityType: "shot",
    entityId: shotId,
    entityName: shotName,
    metadata: {},
  };
}

/**
 * Create activity data for comment
 *
 * @param {string} actorId - Actor user ID
 * @param {string} actorName - Actor display name
 * @param {string|null} actorAvatar - Actor avatar URL
 * @param {string} shotId - Shot ID
 * @param {string} shotName - Shot display name
 * @param {string} commentText - Comment text (HTML)
 * @param {string[]} mentionedUserIds - Mentioned user IDs
 * @returns {object} Activity data ready for logging
 */
export function createCommentAddedActivity(
  actorId,
  actorName,
  actorAvatar,
  shotId,
  shotName,
  commentText,
  mentionedUserIds = []
) {
  // Strip HTML tags and limit to 100 chars for preview
  const plainText = commentText.replace(/<[^>]*>/g, "").substring(0, 100);

  return {
    type: "comment_added",
    actorId,
    actorName,
    actorAvatar,
    entityType: "shot",
    entityId: shotId,
    entityName: shotName,
    metadata: {
      commentText: plainText,
      mentionedUserIds,
    },
  };
}

/**
 * Create activity data for comment edit
 *
 * @param {string} actorId - Actor user ID
 * @param {string} actorName - Actor display name
 * @param {string|null} actorAvatar - Actor avatar URL
 * @param {string} shotId - Shot ID
 * @param {string} shotName - Shot display name
 * @returns {object} Activity data ready for logging
 */
export function createCommentEditedActivity(
  actorId,
  actorName,
  actorAvatar,
  shotId,
  shotName
) {
  return {
    type: "comment_edited",
    actorId,
    actorName,
    actorAvatar,
    entityType: "shot",
    entityId: shotId,
    entityName: shotName,
    metadata: {},
  };
}

/**
 * Create activity data for comment deletion
 *
 * @param {string} actorId - Actor user ID
 * @param {string} actorName - Actor display name
 * @param {string|null} actorAvatar - Actor avatar URL
 * @param {string} shotId - Shot ID
 * @param {string} shotName - Shot display name
 * @returns {object} Activity data ready for logging
 */
export function createCommentDeletedActivity(
  actorId,
  actorName,
  actorAvatar,
  shotId,
  shotName
) {
  return {
    type: "comment_deleted",
    actorId,
    actorName,
    actorAvatar,
    entityType: "shot",
    entityId: shotId,
    entityName: shotName,
    metadata: {},
  };
}

/**
 * Create activity data for bulk update
 *
 * @param {string} actorId - Actor user ID
 * @param {string} actorName - Actor display name
 * @param {string|null} actorAvatar - Actor avatar URL
 * @param {number} shotCount - Number of shots affected
 * @param {string} updateField - Field that was updated
 * @param {any} newValue - New value
 * @returns {object} Activity data ready for logging
 */
export function createBulkUpdatedActivity(
  actorId,
  actorName,
  actorAvatar,
  shotCount,
  updateField,
  newValue
) {
  return {
    type: "bulk_updated",
    actorId,
    actorName,
    actorAvatar,
    entityType: "shot",
    entityId: null,
    entityName: null,
    metadata: {
      shotCount,
      updateField,
      newValue,
    },
  };
}

/**
 * Cleanup expired activities (90-day retention)
 *
 * This function should be called opportunistically (e.g., when timeline loads).
 * It deletes activities that have passed their expiration date.
 *
 * @param {string} clientId - Client ID
 * @param {string} projectId - Project ID
 * @returns {Promise<number>} Number of activities deleted
 *
 * @example
 * const deleted = await cleanupExpiredActivities(clientId, projectId);
 * console.log(`Cleaned up ${deleted} expired activities`);
 */
export async function cleanupExpiredActivities(clientId, projectId) {
  try {
    if (!clientId || !projectId) {
      return 0;
    }

    const now = new Date();
    const activitiesRef = collection(
      db,
      "clients",
      clientId,
      "projects",
      projectId,
      "activities"
    );

    // Query activities that have expired
    const q = query(
      activitiesRef,
      where("expiresAt", "<=", now),
      limit(100) // Batch delete 100 at a time
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return 0;
    }

    // Delete in batch
    const batch = writeBatch(db);
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));

    await batch.commit();

    const deletedCount = snapshot.docs.length;
    console.log(
      `[Activity Cleanup] Deleted ${deletedCount} expired activities for project ${projectId}`
    );

    return deletedCount;
  } catch (error) {
    console.error("[Activity Cleanup] Failed to cleanup activities:", error);
    return 0;
  }
}
