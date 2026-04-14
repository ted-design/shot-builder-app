/**
 * Activity List Component
 *
 * Renders a list of activity items with proper spacing and accessibility.
 */

import ActivityItem from "./ActivityItem";

/**
 * Activity List - renders list of activity cards
 *
 * @param {object} props
 * @param {Array} props.activities - Array of activity documents
 * @param {string} props.currentUserId - Current user ID
 * @returns {JSX.Element}
 */
export default function ActivityList({ activities, currentUserId }) {
  return (
    <div
      className="space-y-3"
      role="feed"
      aria-label={`${activities.length} ${
        activities.length === 1 ? "activity" : "activities"
      }`}
      aria-busy="false"
    >
      {activities.map((activity) => (
        <ActivityItem
          key={activity.id}
          activity={activity}
          currentUserId={currentUserId}
        />
      ))}
    </div>
  );
}
