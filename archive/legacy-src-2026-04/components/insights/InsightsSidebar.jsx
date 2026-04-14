import React from "react";
import { X, BarChart3 } from "lucide-react";
import InsightsShotTotals from "./InsightsShotTotals";
import InsightsTalentMatrix from "./InsightsTalentMatrix";

/**
 * Collapsible right sidebar for Builder tab showing shot totals and talent coverage.
 * Designed to slide in/out from the right edge.
 */
function InsightsSidebar({
  isOpen,
  onClose,
  isLoading = false,
  // Shot totals props
  totalShots = 0,
  shotTotalsRows = [], // For Builder: grouped by date/etc. For Planner: by lane
  onShotRowClick,
  activeShotRowId,
  // Talent matrix props
  talentRows = [],
  onTalentClick,
  activeTalentIds = [],
  // Optional lane breakdown for Planner compatibility
  lanes = [],
  showLaneBreakdown = false,
}) {
  if (!isOpen) return null;

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-l border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-slate-500 dark:text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Insights</h2>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          aria-label="Close insights panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-6">
          {/* Shot Totals Section */}
          <InsightsShotTotals
            isLoading={isLoading}
            totalShots={totalShots}
            rows={shotTotalsRows}
            onRowClick={onShotRowClick}
            activeRowId={activeShotRowId}
          />

          {/* Divider */}
          <hr className="border-slate-200 dark:border-slate-700" />

          {/* Talent Matrix Section */}
          <InsightsTalentMatrix
            isLoading={isLoading}
            rows={talentRows}
            lanes={lanes}
            onTalentClick={onTalentClick}
            activeTalentIds={activeTalentIds}
            showLaneBreakdown={showLaneBreakdown}
          />
        </div>
      </div>

      {/* Footer with summary */}
      <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-700">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>
            {isLoading ? "--" : totalShots} shot{totalShots !== 1 ? "s" : ""}
          </span>
          <span>
            {isLoading ? "--" : talentRows.filter((r) => r.id !== "__talent_unassigned__").length} talent
            {talentRows.filter((r) => r.id !== "__talent_unassigned__").length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </aside>
  );
}

export default InsightsSidebar;
