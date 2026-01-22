/**
 * WorkspaceEmptyState - Placeholder state for workspace sections
 *
 * Design system:
 * - Dashed border container
 * - Centered icon + title + description
 * - Disabled action button
 * - "Coming soon" indicator
 *
 * Usage:
 * <WorkspaceEmptyState
 *   icon={FileText}
 *   title="Documents & Files"
 *   description="Upload tech packs, material specifications..."
 *   actionLabel="Upload file"
 * />
 */

import { Plus } from "lucide-react";

export default function WorkspaceEmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  comingSoon = true,
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 p-8">
      <div className="flex flex-col items-center justify-center text-center">
        {/* Icon */}
        {Icon && (
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-3">
            <Icon className="w-6 h-6 text-slate-400 dark:text-slate-500" />
          </div>
        )}

        {/* Title */}
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {title}
        </h3>

        {/* Description */}
        {description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mb-4">
            {description}
          </p>
        )}

        {/* Disabled action button */}
        {actionLabel && (
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" />
            {actionLabel}
          </button>
        )}

        {/* Coming soon indicator */}
        {comingSoon && (
          <p className="mt-3 text-[10px] text-slate-300 dark:text-slate-600 italic">
            Coming soon
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Compact variant for inline table empty states
 */
export function WorkspaceTableEmpty({
  icon: Icon,
  title,
  subtitle,
  colSpan = 1,
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-8">
        <div className="flex flex-col items-center justify-center text-center">
          {Icon && (
            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-2">
              <Icon className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            </div>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
            {title}
          </p>
          {subtitle && (
            <p className="text-[10px] text-slate-400 dark:text-slate-500">
              {subtitle}
            </p>
          )}
        </div>
      </td>
    </tr>
  );
}
