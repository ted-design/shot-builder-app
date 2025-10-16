/**
 * Activity Timeline Component
 *
 * Main container for the project activity feed. Displays filtered activities
 * with real-time updates, loading states, and error handling.
 */

import { useState } from "react";
import { useActivities } from "../../hooks/useActivities";
import { useAuth } from "../../context/AuthContext";
import ActivityFilters from "./ActivityFilters";
import ActivityList from "./ActivityList";
import EmptyState from "./EmptyState";
import { Loader2 } from "lucide-react";

/**
 * Activity Timeline - displays project activity feed with filters
 *
 * @param {object} props
 * @param {string} props.clientId - Client ID
 * @param {string} props.projectId - Project ID
 * @param {number} props.limit - Max activities to display (default: 100)
 * @returns {JSX.Element}
 */
export default function ActivityTimeline({ clientId, projectId, limit = 100 }) {
  const { user } = useAuth();

  // Filter state
  const [filters, setFilters] = useState({
    types: [], // Empty = all types
    actorIds: [], // Empty = all users
    startDate: null,
    endDate: null,
    limit,
  });

  // Fetch activities with realtime updates
  const { data: activities, isLoading, error } = useActivities(
    clientId,
    projectId,
    filters
  );

  // Handle filter changes
  const handleFilterChange = (newFilters) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  // Handle clear all filters
  const handleClearFilters = () => {
    setFilters({
      types: [],
      actorIds: [],
      startDate: null,
      endDate: null,
      limit,
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center h-64"
        role="status"
        aria-live="polite"
        aria-label="Loading activities"
      >
        <Loader2
          className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin"
          aria-hidden="true"
        />
        <span className="sr-only">Loading activities...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"
        role="alert"
        aria-live="assertive"
      >
        <p className="text-red-800 dark:text-red-200">
          Failed to load activity timeline. Please try again.
        </p>
      </div>
    );
  }

  // Check if filters are active
  const hasFilters =
    filters.types.length > 0 ||
    filters.actorIds.length > 0 ||
    filters.startDate ||
    filters.endDate;

  // Empty state
  if (!activities || activities.length === 0) {
    return (
      <div className="space-y-4">
        <ActivityFilters
          clientId={clientId}
          filters={filters}
          onChange={handleFilterChange}
          onClear={handleClearFilters}
        />
        <EmptyState hasFilters={hasFilters} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <ActivityFilters
        clientId={clientId}
        filters={filters}
        onChange={handleFilterChange}
        onClear={handleClearFilters}
      />

      {/* Activity count */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Showing {activities.length} {activities.length === 1 ? "activity" : "activities"}
        {hasFilters && " (filtered)"}
      </div>

      {/* Activity list */}
      <ActivityList activities={activities} currentUserId={user?.uid} />
    </div>
  );
}
