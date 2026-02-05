import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  NOTIFICATION_TYPES,
  getNotificationType,
  createNotification,
  formatRelativeTime,
  groupNotificationsByReadStatus,
  getUnreadCount,
} from "../notifications";

describe("notifications utilities", () => {
  describe("NOTIFICATION_TYPES", () => {
    it("exports all notification types", () => {
      expect(NOTIFICATION_TYPES.SHOT_ASSIGNED).toEqual({
        type: "shot_assigned",
        icon: "Camera",
        color: "blue",
        title: "Shot Assigned",
      });

      expect(NOTIFICATION_TYPES.PULL_READY).toEqual({
        type: "pull_ready",
        icon: "Package",
        color: "green",
        title: "Pull Ready",
      });

      expect(NOTIFICATION_TYPES.PROJECT_UPDATED).toEqual({
        type: "project_updated",
        icon: "FolderOpen",
        color: "purple",
        title: "Project Updated",
      });

      expect(NOTIFICATION_TYPES.GENERIC).toEqual({
        type: "generic",
        icon: "Bell",
        color: "gray",
        title: "Notification",
      });
    });
  });

  describe("getNotificationType", () => {
    it("returns correct type metadata for known types", () => {
      const result = getNotificationType("shot_assigned");
      expect(result).toEqual({
        type: "shot_assigned",
        icon: "Camera",
        color: "blue",
        title: "Shot Assigned",
      });
    });

    it("returns GENERIC type for unknown types", () => {
      const result = getNotificationType("unknown_type");
      expect(result).toEqual(NOTIFICATION_TYPES.GENERIC);
    });

    it("handles null/undefined gracefully", () => {
      const result = getNotificationType(null);
      expect(result).toEqual(NOTIFICATION_TYPES.GENERIC);
    });
  });

  describe("formatRelativeTime", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-10-14T12:00:00Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('formats seconds ago as "Just now"', () => {
      const timestamp = new Date("2025-10-14T11:59:30Z");
      expect(formatRelativeTime(timestamp)).toBe("Just now");
    });

    it("formats minutes ago", () => {
      const timestamp = new Date("2025-10-14T11:55:00Z");
      expect(formatRelativeTime(timestamp)).toBe("5 minutes ago");
    });

    it("formats single minute correctly", () => {
      const timestamp = new Date("2025-10-14T11:59:00Z");
      expect(formatRelativeTime(timestamp)).toBe("1 minute ago");
    });

    it("formats hours ago", () => {
      const timestamp = new Date("2025-10-14T09:00:00Z");
      expect(formatRelativeTime(timestamp)).toBe("3 hours ago");
    });

    it("formats single hour correctly", () => {
      const timestamp = new Date("2025-10-14T11:00:00Z");
      expect(formatRelativeTime(timestamp)).toBe("1 hour ago");
    });

    it("formats days ago", () => {
      const timestamp = new Date("2025-10-12T12:00:00Z");
      expect(formatRelativeTime(timestamp)).toBe("2 days ago");
    });

    it("formats dates older than 7 days", () => {
      const timestamp = new Date("2025-10-01T12:00:00Z");
      expect(formatRelativeTime(timestamp)).toBe("Oct 1");
    });

    it("handles Firestore Timestamp objects", () => {
      const firestoreTimestamp = {
        toDate: () => new Date("2025-10-14T11:55:00Z"),
      };
      expect(formatRelativeTime(firestoreTimestamp)).toBe("5 minutes ago");
    });

    it("returns empty string for null/undefined", () => {
      expect(formatRelativeTime(null)).toBe("");
      expect(formatRelativeTime(undefined)).toBe("");
    });

  });

  describe("groupNotificationsByReadStatus", () => {
    it("groups notifications by read status", () => {
      const notifications = [
        { id: "1", read: false, message: "Unread 1" },
        { id: "2", read: true, message: "Read 1" },
        { id: "3", read: false, message: "Unread 2" },
        { id: "4", read: true, message: "Read 2" },
      ];

      const result = groupNotificationsByReadStatus(notifications);

      expect(result.unread).toHaveLength(2);
      expect(result.read).toHaveLength(2);
      expect(result.unread[0].id).toBe("1");
      expect(result.unread[1].id).toBe("3");
      expect(result.read[0].id).toBe("2");
      expect(result.read[1].id).toBe("4");
    });

    it("handles all unread notifications", () => {
      const notifications = [
        { id: "1", read: false },
        { id: "2", read: false },
      ];

      const result = groupNotificationsByReadStatus(notifications);

      expect(result.unread).toHaveLength(2);
      expect(result.read).toHaveLength(0);
    });

    it("handles all read notifications", () => {
      const notifications = [
        { id: "1", read: true },
        { id: "2", read: true },
      ];

      const result = groupNotificationsByReadStatus(notifications);

      expect(result.unread).toHaveLength(0);
      expect(result.read).toHaveLength(2);
    });

    it("handles empty array", () => {
      const result = groupNotificationsByReadStatus([]);
      expect(result).toEqual({ unread: [], read: [] });
    });

    it("handles null/undefined", () => {
      expect(groupNotificationsByReadStatus(null)).toEqual({ unread: [], read: [] });
      expect(groupNotificationsByReadStatus(undefined)).toEqual({ unread: [], read: [] });
    });
  });

  describe("getUnreadCount", () => {
    it("counts unread notifications", () => {
      const notifications = [
        { id: "1", read: false },
        { id: "2", read: true },
        { id: "3", read: false },
        { id: "4", read: false },
      ];

      expect(getUnreadCount(notifications)).toBe(3);
    });

    it("returns 0 for all read notifications", () => {
      const notifications = [
        { id: "1", read: true },
        { id: "2", read: true },
      ];

      expect(getUnreadCount(notifications)).toBe(0);
    });

    it("returns 0 for empty array", () => {
      expect(getUnreadCount([])).toBe(0);
    });

    it("returns 0 for null/undefined", () => {
      expect(getUnreadCount(null)).toBe(0);
      expect(getUnreadCount(undefined)).toBe(0);
    });
  });

  describe("createNotification", () => {
    it("throws error if clientId is missing", async () => {
      await expect(
        createNotification(null, {
          userId: "user123",
          type: "shot_assigned",
          message: "Test",
        })
      ).rejects.toThrow("clientId is required");
    });

    it("throws error if userId is missing", async () => {
      await expect(
        createNotification("client123", {
          type: "shot_assigned",
          message: "Test",
        })
      ).rejects.toThrow("notification.userId is required");
    });

    it("throws error if type is missing", async () => {
      await expect(
        createNotification("client123", {
          userId: "user123",
          message: "Test",
        })
      ).rejects.toThrow("notification.type is required");
    });

    it("throws error if message is missing", async () => {
      await expect(
        createNotification("client123", {
          userId: "user123",
          type: "shot_assigned",
        })
      ).rejects.toThrow("notification.message is required");
    });
  });
});
