import React from "react";
import { User } from "lucide-react";
import Thumb from "../Thumb";
import { TALENT_UNASSIGNED_ID } from "../../lib/insightsCalculator";

/**
 * Displays talent coverage matrix with optional lane breakdown.
 * Extracted from PlannerSummary for reuse in Builder insights sidebar.
 *
 * Props:
 * - isLoading: boolean
 * - rows: Array of talent rows with { id, name, talentId, headshotPath, total, byLane? }
 * - lanes: Array of { id, name } for column headers (optional, for Planner view)
 * - onTalentClick: callback when talent row is clicked
 * - activeTalentIds: array of active talent IDs for highlighting
 * - showLaneBreakdown: whether to show per-lane columns (default: false)
 * - emptyMessage: message when no data
 * - loadingMessage: message when loading
 */
function InsightsTalentMatrix({
  isLoading = false,
  rows = [],
  lanes = [],
  onTalentClick,
  activeTalentIds = [],
  showLaneBreakdown = false,
  emptyMessage = "Talent breakdowns will appear once shots have assignments.",
  loadingMessage = "Gathering talent assignments...",
}) {
  const hasData = !isLoading && rows.length > 0;
  const totalTalentCount = rows.filter((row) => row.id !== TALENT_UNASSIGNED_ID).length;

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Talent Coverage</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {showLaneBreakdown ? "Shots assigned to each talent by lane" : "Shots assigned to each talent"}
          </p>
        </div>
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {isLoading ? "--" : totalTalentCount} talent{totalTalentCount !== 1 ? "s" : ""}
        </span>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{loadingMessage}</p>
      ) : hasData ? (
        <div className={showLaneBreakdown ? "overflow-x-auto" : ""}>
          <table className={`w-full text-left text-sm ${showLaneBreakdown ? "min-w-[420px]" : ""}`}>
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <th className="py-2 pr-3">Talent</th>
                <th className="py-2 pr-3 text-right">Total</th>
                {showLaneBreakdown &&
                  lanes.map((lane) => (
                    <th key={lane.id} className="py-2 pr-3 text-right">
                      {lane.name}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isUnassigned = row.id === TALENT_UNASSIGNED_ID;
                const isActive = !isUnassigned && activeTalentIds.includes(row.talentId || row.name);
                const isClickable = !isUnassigned && typeof onTalentClick === "function";

                return (
                  <tr
                    key={row.id}
                    className={`border-b border-slate-100 last:border-b-0 dark:border-slate-700/60 ${
                      isClickable ? "cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50" : ""
                    } ${isActive ? "bg-primary/5 dark:bg-primary/10" : ""}`}
                    onClick={() => isClickable && onTalentClick(row)}
                    role={isClickable ? "button" : undefined}
                    tabIndex={isClickable ? 0 : undefined}
                    onKeyDown={(e) => {
                      if (isClickable && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        onTalentClick(row);
                      }
                    }}
                  >
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        {/* Avatar thumbnail */}
                        {!isUnassigned ? (
                          row.headshotPath ? (
                            <Thumb
                              path={row.headshotPath}
                              preferredSize={64}
                              className="h-6 w-6 shrink-0 rounded-full border border-slate-200 dark:border-slate-600 overflow-hidden"
                              imageClassName="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 dark:border-slate-600 dark:bg-slate-700">
                              <span className="text-2xs font-medium text-slate-600 dark:text-slate-300">
                                {row.name?.charAt(0)?.toUpperCase() || "?"}
                              </span>
                            </div>
                          )
                        ) : (
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-800">
                            <User className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                          </div>
                        )}
                        {/* Name */}
                        <span
                          className={`truncate ${
                            isUnassigned
                              ? "text-slate-500 dark:text-slate-400"
                              : "text-slate-700 dark:text-slate-300"
                          } ${isActive ? "font-medium text-primary dark:text-primary" : ""}`}
                        >
                          {row.name}
                        </span>
                      </div>
                    </td>
                    <td
                      className={`py-2 pr-3 text-right font-medium ${
                        isActive ? "text-primary dark:text-primary" : "text-slate-900 dark:text-slate-100"
                      }`}
                    >
                      {row.total}
                    </td>
                    {showLaneBreakdown &&
                      lanes.map((lane) => (
                        <td key={lane.id} className="py-2 pr-3 text-right text-slate-700 dark:text-slate-300">
                          {row.byLane?.[lane.id] ?? 0}
                        </td>
                      ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">{emptyMessage}</p>
      )}
    </div>
  );
}

export default InsightsTalentMatrix;
