/**
 * Empty State Component for Activity Timeline
 *
 * Displays a friendly message when no activities are found,
 * with different messages for filtered vs unfiltered states.
 */

import { Activity } from "lucide-react";

/**
 * Empty State - displays when no activities are available
 *
 * @param {object} props
 * @param {boolean} props.hasFilters - Whether filters are currently applied
 * @returns {JSX.Element}
 */
export default function EmptyState({ hasFilters = false }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-12 px-4 text-center"
      role="status"
      aria-live="polite"
    >
      <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <Activity
          className="w-8 h-8 text-slate-400 dark:text-slate-500"
          aria-hidden="true"
        />
      </div>

      {hasFilters ? (
        <>
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            No activities match your filters
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md">
            Try adjusting your filters or clearing them to see all project
            activity.
          </p>
        </>
      ) : (
        <>
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            No activity yet
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md">
            Project activity will appear here as team members create shots, add
            comments, and make updates.
          </p>
        </>
      )}
    </div>
  );
}
