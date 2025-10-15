/**
 * Notification utilities for Shot Builder
 *
 * Provides functions for creating, formatting, and managing notifications.
 */

import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Notification types with metadata
 */
export const NOTIFICATION_TYPES = {
  SHOT_ASSIGNED: {
    type: "shot_assigned",
    icon: "Camera",
    color: "blue",
    title: "Shot Assigned",
  },
  PULL_READY: {
    type: "pull_ready",
    icon: "Package",
    color: "green",
    title: "Pull Ready",
  },
  PROJECT_UPDATED: {
    type: "project_updated",
    icon: "FolderOpen",
    color: "purple",
    title: "Project Updated",
  },
  SHOT_COMPLETED: {
    type: "shot_completed",
    icon: "CheckCircle",
    color: "green",
    title: "Shot Completed",
  },
  COMMENT_ADDED: {
    type: "comment_added",
    icon: "MessageSquare",
    color: "blue",
    title: "New Comment",
  },
  TAG_ADDED: {
    type: "tag_added",
    icon: "Tag",
    color: "purple",
    title: "Tag Added",
  },
  MENTION: {
    type: "mention",
    icon: "AtSign",
    color: "indigo",
    title: "You were mentioned",
  },
  GENERIC: {
    type: "generic",
    icon: "Bell",
    color: "gray",
    title: "Notification",
  },
};

/**
 * Get notification type metadata by type string
 *
 * @param {string} type - Notification type
 * @returns {object} Type metadata
 */
export function getNotificationType(type) {
  const typeKey = Object.keys(NOTIFICATION_TYPES).find(
    (key) => NOTIFICATION_TYPES[key].type === type
  );
  return typeKey ? NOTIFICATION_TYPES[typeKey] : NOTIFICATION_TYPES.GENERIC;
}

/**
 * Create a notification in Firestore
 *
 * @param {string} clientId - Client ID
 * @param {object} notification - Notification data
 * @param {string} notification.userId - User ID to notify
 * @param {string} notification.type - Notification type
 * @param {string} notification.message - Notification message
 * @param {string} notification.relatedId - Related entity ID (optional)
 * @param {string} notification.relatedType - Related entity type (optional)
 * @param {string} notification.actionUrl - URL to navigate to (optional)
 * @returns {Promise<string>} Document ID of created notification
 *
 * @example
 * await createNotification(clientId, {
 *   userId: 'user123',
 *   type: 'shot_assigned',
 *   message: 'You were assigned to Shot #123',
 *   relatedId: 'shot123',
 *   relatedType: 'shot',
 *   actionUrl: '/shots'
 * });
 */
export async function createNotification(clientId, notification) {
  if (!clientId) {
    throw new Error("clientId is required");
  }

  if (!notification.userId) {
    throw new Error("notification.userId is required");
  }

  if (!notification.type) {
    throw new Error("notification.type is required");
  }

  if (!notification.message) {
    throw new Error("notification.message is required");
  }

  const typeMetadata = getNotificationType(notification.type);

  const notificationData = {
    userId: notification.userId,
    type: notification.type,
    title: typeMetadata.title,
    message: notification.message,
    relatedId: notification.relatedId || null,
    relatedType: notification.relatedType || null,
    actionUrl: notification.actionUrl || null,
    read: false,
    createdAt: serverTimestamp(),
  };

  const notificationsRef = collection(db, "clients", clientId, "notifications");
  const docRef = await addDoc(notificationsRef, notificationData);

  return docRef.id;
}

/**
 * Format relative time for notification timestamps
 *
 * @param {Date|object} timestamp - Firestore timestamp or Date
 * @returns {string} Formatted relative time
 *
 * @example
 * formatRelativeTime(notification.createdAt) // "2 minutes ago"
 */
export function formatRelativeTime(timestamp) {
  if (!timestamp) return "";

  let date;
  if (timestamp?.toDate) {
    // Firestore Timestamp
    date = timestamp.toDate();
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else {
    return "";
  }

  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return "Just now";
  } else if (diffMin < 60) {
    return `${diffMin} minute${diffMin !== 1 ? "s" : ""} ago`;
  } else if (diffHour < 24) {
    return `${diffHour} hour${diffHour !== 1 ? "s" : ""} ago`;
  } else if (diffDay < 7) {
    return `${diffDay} day${diffDay !== 1 ? "s" : ""} ago`;
  } else {
    // Format as date for older notifications
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }
}

/**
 * Group notifications by read status
 *
 * @param {Array} notifications - Array of notifications
 * @returns {object} Grouped notifications { unread: [], read: [] }
 */
export function groupNotificationsByReadStatus(notifications) {
  if (!notifications || !Array.isArray(notifications)) {
    return { unread: [], read: [] };
  }

  return notifications.reduce(
    (acc, notification) => {
      if (notification.read) {
        acc.read.push(notification);
      } else {
        acc.unread.push(notification);
      }
      return acc;
    },
    { unread: [], read: [] }
  );
}

/**
 * Get unread notification count
 *
 * @param {Array} notifications - Array of notifications
 * @returns {number} Count of unread notifications
 */
export function getUnreadCount(notifications) {
  if (!notifications || !Array.isArray(notifications)) {
    return 0;
  }
  return notifications.filter((n) => !n.read).length;
}

/**
 * Create mention notifications for multiple users
 *
 * Creates a notification for each mentioned user when they are @mentioned in a comment or note.
 * Excludes the author from notifications (users don't get notified when they mention themselves).
 *
 * @param {string} clientId - Client ID
 * @param {Array<string>} mentionedUserIds - Array of user IDs that were mentioned
 * @param {object} context - Context about where the mention occurred
 * @param {string} context.authorId - ID of the user who created the mention
 * @param {string} context.authorName - Display name of the author
 * @param {string} context.shotId - ID of the shot (optional)
 * @param {string} context.shotName - Name of the shot (optional)
 * @param {string} context.commentText - Preview of comment text (optional)
 * @returns {Promise<Array<string>>} Array of created notification IDs
 *
 * @example
 * await createMentionNotifications(clientId, ['user1', 'user2'], {
 *   authorId: 'author123',
 *   authorName: 'John Doe',
 *   shotId: 'shot123',
 *   shotName: 'Shot A-101',
 *   commentText: 'Great work on this shot!'
 * });
 */
export async function createMentionNotifications(clientId, mentionedUserIds, context) {
  if (!clientId) {
    throw new Error("clientId is required");
  }

  if (!mentionedUserIds || !Array.isArray(mentionedUserIds) || mentionedUserIds.length === 0) {
    return []; // No users to notify
  }

  if (!context?.authorId || !context?.authorName) {
    throw new Error("context.authorId and context.authorName are required");
  }

  // Filter out the author (don't notify yourself)
  const usersToNotify = mentionedUserIds.filter((userId) => userId !== context.authorId);

  if (usersToNotify.length === 0) {
    return []; // No one to notify after filtering
  }

  // Build notification message
  const shotContext = context.shotName ? ` in ${context.shotName}` : "";
  const message = `${context.authorName} mentioned you${shotContext}`;

  // Create preview text (first 50 chars of comment)
  const previewText = context.commentText
    ? context.commentText.substring(0, 50) + (context.commentText.length > 50 ? "..." : "")
    : "";

  // Create notifications for all mentioned users
  const notificationPromises = usersToNotify.map((userId) =>
    createNotification(clientId, {
      userId,
      type: "mention",
      message: previewText ? `${message}: "${previewText}"` : message,
      relatedId: context.shotId || null,
      relatedType: context.shotId ? "shot" : null,
      actionUrl: context.shotId ? `/shots/${context.shotId}` : null,
    })
  );

  const notificationIds = await Promise.all(notificationPromises);
  return notificationIds;
}
