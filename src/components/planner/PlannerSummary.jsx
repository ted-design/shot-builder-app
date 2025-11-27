import React, { useId } from "react";
import { ChevronDown, User } from "lucide-react";
import { Card, CardContent, CardHeader } from "../ui/card";
import Thumb from "../Thumb";

function PlannerSummary({ isLoading, laneSummary, talentSummary, collapsed, onToggle, onTalentClick, activeTalentIds = [] }) {
  const contentId = useId();
  const lanes = Array.isArray(laneSummary?.lanes) ? laneSummary.lanes : [];
  const totalShots = typeof laneSummary?.totalShots === "number" ? laneSummary.totalShots : 0;
  const talentRows = Array.isArray(talentSummary?.rows) ? talentSummary.rows : [];
  const talentLanes = Array.isArray(talentSummary?.lanes) ? talentSummary.lanes : [];
  const totalTalentCount = talentRows.filter((row) => row.id !== "__talent_unassigned__").length;
  const hasPlannerData = !isLoading && totalShots > 0;

  const headerMetrics = [
    { label: "shots", value: isLoading ? "--" : String(totalShots) },
    { label: "talents", value: isLoading ? "--" : String(totalTalentCount) },
  ];

  return (
    <section className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:hover:bg-slate-700"
        aria-expanded={!collapsed}
        aria-controls={contentId}
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Planner insights</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">Shot totals and talent coverage</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {headerMetrics.map((metric) => (
            <div key={metric.label} className="flex items-baseline gap-1 text-slate-500 dark:text-slate-400">
              <span className="text-base font-semibold text-slate-900 dark:text-slate-100">{metric.value}</span>
              <span className="text-xs uppercase tracking-wide">{metric.label}</span>
            </div>
          ))}
          <ChevronDown
            className={`h-4 w-4 text-slate-500 transition-transform dark:text-slate-400 ${collapsed ? "" : "-rotate-180"}`}
            aria-hidden="true"
          />
        </div>
      </button>
      <div
        id={contentId}
        className="border-t border-slate-200 bg-white px-4 pb-4 dark:border-slate-700 dark:bg-slate-800"
        hidden={collapsed}
      >
        {!collapsed && (
          <div className="pt-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-baseline justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Shot totals</h2>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Overview of shots per lane.</p>
                    </div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{totalShots} total</span>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">Gathering lane statistics...</p>
                  ) : hasPlannerData ? (
                    <table className="w-full table-fixed text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                          <th className="py-2 pr-3">Lane</th>
                          <th className="py-2 text-right">Shots</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lanes.map((lane) => (
                          <tr key={lane.id} className="border-b border-slate-100 last:border-b-0 dark:border-slate-700/60">
                            <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{lane.name}</td>
                            <td className="py-2 text-right font-medium text-slate-900 dark:text-slate-100">{lane.shotCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400">No shots yet - totals will appear once shots are added.</p>
                  )}
                </CardContent>
              </Card>
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-baseline justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Talent coverage</h2>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Shots assigned to each talent by lane.</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  {isLoading ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">Gathering talent assignments...</p>
                  ) : hasPlannerData ? (
                    <table className="w-full min-w-[420px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                          <th className="py-2 pr-3">Talent</th>
                          <th className="py-2 pr-3 text-right">Total</th>
                          {talentLanes.map((lane) => (
                            <th key={lane.id} className="py-2 pr-3 text-right">
                              {lane.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {talentRows.map((row) => {
                          const isUnassigned = row.id === "__talent_unassigned__";
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
                                        className="h-8 w-8 shrink-0 rounded-full border border-slate-200 dark:border-slate-600 overflow-hidden"
                                        imageClassName="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 dark:border-slate-600 dark:bg-slate-700">
                                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                                          {row.name?.charAt(0)?.toUpperCase() || "?"}
                                        </span>
                                      </div>
                                    )
                                  ) : (
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-800">
                                      <User className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                                    </div>
                                  )}
                                  {/* Name */}
                                  <span
                                    className={`${
                                      isUnassigned
                                        ? "text-slate-500 dark:text-slate-400"
                                        : "text-slate-700 dark:text-slate-300"
                                    } ${isActive ? "font-medium text-primary dark:text-primary" : ""}`}
                                  >
                                    {row.name}
                                  </span>
                                </div>
                              </td>
                              <td className={`py-2 pr-3 text-right font-medium ${isActive ? "text-primary dark:text-primary" : "text-slate-900 dark:text-slate-100"}`}>
                                {row.total}
                              </td>
                              {talentLanes.map((lane) => (
                                <td key={lane.id} className="py-2 pr-3 text-right text-slate-700 dark:text-slate-300">
                                  {row.byLane?.[lane.id] ?? 0}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400">Talent breakdowns will appear once shots have assignments.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default PlannerSummary;
