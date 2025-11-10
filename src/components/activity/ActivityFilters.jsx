/**
 * Activity Filters Component
 *
 * Provides filtering UI for activity timeline with collapsible filter panel.
 * Supports filtering by activity type, user, and date range (future).
 */

import { useState } from "react";
import { Filter, X, ChevronDown, ChevronUp } from "lucide-react";
import { getActivityTypesList } from "../../lib/activities";
import { useUsers } from "../../hooks/useComments";

/**
 * Activity Filters - filter UI for timeline
 *
 * @param {object} props
 * @param {string} props.clientId - Client ID (for fetching users)
 * @param {object} props.filters - Current filter state
 * @param {Function} props.onChange - Callback when filters change
 * @param {Function} props.onClear - Callback to clear all filters
 * @returns {JSX.Element}
 */
export default function ActivityFilters({
  clientId,
  filters,
  onChange,
  onClear,
}) {
  const [isOpen, setIsOpen] = useState(false);

  // Fetch users for actor filter
  const { data: users = [] } = useUsers(clientId);

  // Get all available activity types
  const activityTypes = getActivityTypesList();

  // Count active filters
  const hasActiveFilters =
    (filters.types && filters.types.length > 0) ||
    (filters.actorIds && filters.actorIds.length > 0) ||
    filters.startDate ||
    filters.endDate;

  const activeFilterCount =
    (filters.types?.length || 0) + (filters.actorIds?.length || 0);

  // Handle type filter change
  const handleTypeChange = (e) => {
    const selected = Array.from(e.target.selectedOptions, (opt) => opt.value);
    onChange({ types: selected });
  };

  // Handle user filter change
  const handleUserChange = (e) => {
    const selected = Array.from(e.target.selectedOptions, (opt) => opt.value);
    onChange({ actorIds: selected });
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-card border border-slate-200 dark:border-slate-700 p-4">
      {/* Filter header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 rounded px-2 py-1"
          aria-expanded={isOpen}
          aria-controls="filter-panel"
        >
          <Filter className="w-4 h-4" aria-hidden="true" />
          Filters
          {hasActiveFilters && (
            <span
              className="ml-2 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full"
              aria-label={`${activeFilterCount} active filters`}
            >
              {activeFilterCount}
            </span>
          )}
          {isOpen ? (
            <ChevronUp className="w-4 h-4 ml-1" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-4 h-4 ml-1" aria-hidden="true" />
          )}
        </button>

        {hasActiveFilters && (
          <button
            onClick={onClear}
            className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 rounded px-2 py-1"
            aria-label="Clear all filters"
          >
            <X className="w-4 h-4 inline mr-1" aria-hidden="true" />
            Clear all
          </button>
        )}
      </div>

      {/* Filter panel */}
      {isOpen && (
        <div
          id="filter-panel"
          className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {/* Activity Type Filter */}
          <div>
            <label
              htmlFor="activity-type-filter"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >
              Activity Type
            </label>
            <select
              id="activity-type-filter"
              multiple
              value={filters.types || []}
              onChange={handleTypeChange}
              className="w-full h-32 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              aria-label="Select activity types to filter"
            >
              {activityTypes.map((type) => (
                <option key={type.type} value={type.type}>
                  {type.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Hold Ctrl/Cmd to select multiple
            </p>
          </div>

          {/* User Filter */}
          <div>
            <label
              htmlFor="user-filter"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >
              User
            </label>
            <select
              id="user-filter"
              multiple
              value={filters.actorIds || []}
              onChange={handleUserChange}
              className="w-full h-32 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              aria-label="Select users to filter"
            >
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName || user.email}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Hold Ctrl/Cmd to select multiple
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
