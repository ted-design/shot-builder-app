import React from "react";
import { ChevronDown } from "lucide-react";

/**
 * Accordion-style grouped view for shots in the Builder tab.
 * Only one group can be expanded at a time (accordion behavior).
 */
function BuilderGroupedView({
  groups = [],
  expandedGroups = new Set(),
  onToggleGroup,
  renderShot,
  className = "",
}) {
  if (!groups.length) {
    return null;
  }

  // If only one group with key "all", just render shots without headers
  if (groups.length === 1 && groups[0].key === "all") {
    return (
      <div className={className}>
        {groups[0].shots.map((shot, index) => renderShot(shot, index))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const isExpanded = expandedGroups.has(group.key);
        const hasShots = group.shots.length > 0;

        return (
          <div
            key={group.key}
            className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
          >
            {/* Group Header */}
            <button
              type="button"
              onClick={() => onToggleGroup(group.key)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:hover:bg-slate-700/50"
              aria-expanded={isExpanded}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {group.label}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  {group.shotCount} shot{group.shotCount !== 1 ? "s" : ""}
                </span>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-slate-500 transition-transform dark:text-slate-400 ${
                  isExpanded ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Group Content */}
            {isExpanded && hasShots && (
              <div className="border-t border-slate-200 p-4 dark:border-slate-700">
                <div className={className}>
                  {group.shots.map((shot, index) => renderShot(shot, index))}
                </div>
              </div>
            )}

            {/* Empty state for expanded group with no shots */}
            {isExpanded && !hasShots && (
              <div className="border-t border-slate-200 p-4 dark:border-slate-700">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No shots in this group.
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default BuilderGroupedView;
