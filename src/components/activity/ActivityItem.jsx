/**
 * Activity Item Component
 *
 * Displays a single activity card in the timeline with icon, description,
 * timestamp, and optional action link. Supports dark mode and WCAG 2.1 AA.
 */

import { formatRelativeTime } from "../../lib/notifications";
import { getActivityType, formatActivityDescription } from "../../lib/activities";
import {
  Camera,
  MessageSquare,
  Edit,
  Trash2,
  Plus,
  RefreshCw,
  Layers,
  FolderPlus,
  FolderOpen,
} from "lucide-react";
import { Link } from "react-router-dom";

// Icon component mapping
const ICON_MAP = {
  Plus,
  Edit,
  Trash2,
  MessageSquare,
  RefreshCw,
  Layers,
  Camera,
  FolderPlus,
  FolderOpen,
};

/**
 * Activity Item - single activity card in timeline
 *
 * @param {object} props
 * @param {object} props.activity - Activity document from Firestore
 * @param {string} props.currentUserId - Current user ID to highlight own activities
 * @returns {JSX.Element}
 */
export default function ActivityItem({ activity, currentUserId }) {
  const activityType = getActivityType(activity.type);
  const description = formatActivityDescription(activity);
  const isOwnActivity = activity.actorId === currentUserId;

  // Get icon component (fallback to Camera)
  const IconComponent = activityType?.icon
    ? ICON_MAP[activityType.icon] || Camera
    : Camera;

  // Color mapping for activity types
  const colorClasses = {
    blue: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
    green:
      "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
    purple:
      "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
    red: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
    gray: "bg-slate-100 dark:bg-slate-900/30 text-slate-600 dark:text-slate-400",
    indigo:
      "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400",
  };

  const iconColorClass =
    colorClasses[activityType?.color] || colorClasses.gray;

  return (
    <div
      className="flex gap-3 p-4 bg-white dark:bg-slate-800 rounded-card border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
      role="article"
      aria-label={`${activity.actorName} ${description}`}
    >
      {/* Icon */}
      <div
        className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${iconColorClass}`}
        aria-hidden="true"
      >
        <IconComponent className="w-5 h-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Actor and description */}
        <div className="text-sm">
          <span
            className={`font-medium ${
              isOwnActivity
                ? "text-blue-600 dark:text-blue-400"
                : "text-slate-900 dark:text-white"
            }`}
          >
            {isOwnActivity ? "You" : activity.actorName}
          </span>{" "}
          <span className="text-slate-600 dark:text-slate-300">
            {description}
          </span>
        </div>

        {/* Metadata preview (for comments) */}
        {activity.metadata?.commentText && (
          <div
            className="mt-1 text-sm text-slate-500 dark:text-slate-400 italic truncate"
            aria-label={`Comment preview: ${activity.metadata.commentText}`}
          >
            "{activity.metadata.commentText}"
          </div>
        )}

        {/* Timestamp */}
        <div
          className="mt-1 text-xs text-slate-500 dark:text-slate-400"
          aria-label={`Time: ${formatRelativeTime(activity.createdAt)}`}
        >
          {formatRelativeTime(activity.createdAt)}
        </div>
      </div>

      {/* Action link */}
      {activity.entityId && activity.entityType === "shot" && (
        <div className="flex-shrink-0">
          <Link
            to={`/shots/${activity.entityId}`}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 rounded px-2 py-1"
            aria-label={`View ${activity.entityName}`}
          >
            View
          </Link>
        </div>
      )}
    </div>
  );
}
