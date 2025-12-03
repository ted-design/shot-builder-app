import React from "react";

/**
 * Displays shot count totals, either by lane (Planner) or by date group (Builder).
 * Extracted from PlannerSummary for reuse in Builder insights sidebar.
 */
function InsightsShotTotals({
  isLoading = false,
  totalShots = 0,
  rows = [], // Array of { id, name, shotCount } or { key, label, shotCount }
  onRowClick,
  activeRowId,
  showTotal = true,
  emptyMessage = "No shots yet - totals will appear once shots are added.",
  loadingMessage = "Gathering statistics...",
}) {
  const hasData = !isLoading && totalShots > 0;

  return (
    <div>
      {showTotal && (
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Shot Totals</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Overview of shots by group</p>
          </div>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {isLoading ? "--" : totalShots} total
          </span>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{loadingMessage}</p>
      ) : hasData ? (
        <table className="w-full table-fixed text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
              <th className="py-2 pr-3">Group</th>
              <th className="py-2 text-right">Shots</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const rowId = row.id || row.key;
              const rowLabel = row.name || row.label;
              const isActive = activeRowId === rowId;
              const isClickable = typeof onRowClick === "function";

              return (
                <tr
                  key={rowId}
                  className={`border-b border-slate-100 last:border-b-0 dark:border-slate-700/60 ${
                    isClickable ? "cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50" : ""
                  } ${isActive ? "bg-primary/5 dark:bg-primary/10" : ""}`}
                  onClick={() => isClickable && onRowClick(row)}
                  role={isClickable ? "button" : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (isClickable && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      onRowClick(row);
                    }
                  }}
                >
                  <td
                    className={`py-2 pr-3 ${
                      isActive ? "font-medium text-primary dark:text-primary" : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {rowLabel}
                  </td>
                  <td
                    className={`py-2 text-right font-medium ${
                      isActive ? "text-primary dark:text-primary" : "text-slate-900 dark:text-slate-100"
                    }`}
                  >
                    {row.shotCount}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">{emptyMessage}</p>
      )}
    </div>
  );
}

export default InsightsShotTotals;
