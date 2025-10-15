import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Camera,
  Package,
  FolderOpen,
  CheckCircle,
  MessageSquare,
  Tag,
  X,
  CheckCheck,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useMarkAsRead, useDismissNotification } from "../../hooks/useFirestoreMutations";
import {
  getNotificationType,
  formatRelativeTime,
  groupNotificationsByReadStatus,
} from "../../lib/notifications";
import { LoadingSpinner } from "./LoadingSpinner";

/**
 * Get icon component based on notification type
 */
const iconMap = {
  Camera,
  Package,
  FolderOpen,
  CheckCircle,
  MessageSquare,
  Tag,
  Bell,
};

function getIconComponent(iconName) {
  return iconMap[iconName] || Bell;
}

/**
 * NotificationItem component - Individual notification display
 */
function NotificationItem({ notification, onDismiss, onMarkAsRead, onNavigate }) {
  const typeMetadata = getNotificationType(notification.type);
  const IconComponent = getIconComponent(typeMetadata.icon);
  const relativeTime = formatRelativeTime(notification.createdAt);

  const handleClick = () => {
    // Mark as read if unread
    if (!notification.read) {
      onMarkAsRead([notification.id]);
    }

    // Navigate if action URL provided
    if (notification.actionUrl) {
      onNavigate(notification.actionUrl);
    }
  };

  const handleDismiss = (e) => {
    e.stopPropagation();
    onDismiss(notification.id);
  };

  const colorClasses = {
    blue: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
    green: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
    purple: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
    gray: "bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400",
  };

  const iconColorClass = colorClasses[typeMetadata.color] || colorClasses.gray;

  return (
    <div
      onClick={handleClick}
      className={`group relative flex items-start gap-3 rounded-md p-3 transition ${
        notification.read
          ? "hover:bg-slate-50 dark:hover:bg-slate-800/50"
          : "bg-primary/5 dark:bg-primary/10 hover:bg-primary/10 dark:hover:bg-primary/15"
      } ${notification.actionUrl ? "cursor-pointer" : ""}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {/* Icon */}
      <div
        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${iconColorClass}`}
      >
        <IconComponent className="h-5 w-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {notification.title}
            </p>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
              {notification.message}
            </p>
          </div>

          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 rounded p-1 text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 transition hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary/80 dark:focus-visible:ring-primary-light"
            aria-label="Dismiss notification"
            title="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Timestamp */}
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
          {relativeTime}
        </p>

        {/* Unread indicator */}
        {!notification.read && (
          <div className="absolute left-1 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary dark:bg-primary-light" />
        )}
      </div>
    </div>
  );
}

/**
 * NotificationPanel component - Dropdown panel with notification list
 *
 * @component
 * @param {Array} notifications - Array of notifications
 * @param {boolean} isLoading - Loading state
 * @param {function} onClose - Callback to close panel
 */
export default function NotificationPanel({ notifications = [], isLoading, onClose }) {
  const navigate = useNavigate();
  const { user, clientId } = useAuth();

  const markAsRead = useMarkAsRead(clientId, user?.uid);
  const dismissNotification = useDismissNotification(clientId, user?.uid);

  const { unread, read } = useMemo(
    () => groupNotificationsByReadStatus(notifications),
    [notifications]
  );

  const handleMarkAllAsRead = () => {
    const unreadIds = unread.map((n) => n.id);
    if (unreadIds.length > 0) {
      markAsRead.mutate({ notificationIds: unreadIds });
    }
  };

  const handleMarkAsRead = (notificationIds) => {
    markAsRead.mutate({ notificationIds });
  };

  const handleDismiss = (notificationId) => {
    dismissNotification.mutate({ notificationId });
  };

  const handleNavigate = (url) => {
    onClose();
    navigate(url);
  };

  return (
    <div className="absolute right-0 top-full mt-2 w-96 max-w-[calc(100vw-2rem)] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg animate-fade-in-down z-100">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 p-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Notifications
        </h3>

        {unread.length > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            disabled={markAsRead.isPending}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-primary dark:text-primary-light transition hover:bg-primary/10 dark:hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 dark:focus-visible:ring-primary-light"
            title="Mark all as read"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </button>
        )}
      </div>

      {/* Content */}
      <div className="max-h-[480px] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="md" />
          </div>
        ) : notifications.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-3">
              <Bell className="h-8 w-8 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
              No notifications
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
              You're all caught up!
            </p>
          </div>
        ) : (
          /* Notification list */
          <div className="divide-y divide-slate-200 dark:divide-slate-700/50">
            {/* Unread notifications */}
            {unread.length > 0 && (
              <div className="p-2 space-y-1">
                {unread.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onDismiss={handleDismiss}
                    onMarkAsRead={handleMarkAsRead}
                    onNavigate={handleNavigate}
                  />
                ))}
              </div>
            )}

            {/* Read notifications */}
            {read.length > 0 && (
              <div className="p-2 space-y-1">
                {unread.length > 0 && (
                  <div className="px-3 py-2">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wide">
                      Earlier
                    </p>
                  </div>
                )}
                {read.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onDismiss={handleDismiss}
                    onMarkAsRead={handleMarkAsRead}
                    onNavigate={handleNavigate}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
