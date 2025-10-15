import React, { useState, useRef, useEffect, useMemo } from "react";
import { Bell } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../hooks/useFirestoreQuery";
import { getUnreadCount } from "../../lib/notifications";
import NotificationPanel from "./NotificationPanel";

/**
 * NotificationBell component - Bell icon with unread badge and dropdown
 *
 * @component
 * @example
 * <NotificationBell />
 */
export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const bellRef = useRef(null);
  const { user, clientId } = useAuth();

  // Fetch notifications for current user
  const { data: notifications = [], isLoading } = useNotifications(
    clientId,
    user?.uid,
    {
      enabled: !!clientId && !!user?.uid,
    }
  );

  // Calculate unread count
  const unreadCount = useMemo(() => getUnreadCount(notifications), [notifications]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (bellRef.current && !bellRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleEscape);
      };
    }
  }, [isOpen]);

  return (
    <div className="relative" ref={bellRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-slate-600 dark:text-slate-400 transition hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 dark:focus-visible:ring-primary-light"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        aria-haspopup="true"
        aria-expanded={isOpen}
        title="Notifications"
      >
        <Bell className="h-5 w-5" />

        {/* Badge */}
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel Dropdown */}
      {isOpen && (
        <NotificationPanel
          notifications={notifications}
          isLoading={isLoading}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
