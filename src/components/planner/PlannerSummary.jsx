import React from "react";
import { Card, CardContent, CardHeader } from "../ui/card";

function PlannerSummary({ isLoading, laneSummary, talentSummary }) {
  const lanes = Array.isArray(laneSummary?.lanes) ? laneSummary.lanes : [];
  const totalShots = typeof laneSummary?.totalShots === "number" ? laneSummary.totalShots : 0;
  const talentRows = Array.isArray(talentSummary?.rows) ? talentSummary.rows : [];
  const talentLanes = Array.isArray(talentSummary?.lanes) ? talentSummary.lanes : [];
  const hasPlannerData = !isLoading && totalShots > 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="h-full">
        <CardHeader>
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Shot totals</h2>
              <p className="text-sm text-slate-500">Overview of shots per lane.</p>
            </div>
            <span className="text-sm font-medium text-slate-700">{totalShots} total</span>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-slate-500">Gathering lane statistics…</p>
          ) : hasPlannerData ? (
            <table className="w-full table-fixed text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3">Lane</th>
                  <th className="py-2 text-right">Shots</th>
                </tr>
              </thead>
              <tbody>
                {lanes.map((lane) => (
                  <tr key={lane.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-2 pr-3 text-slate-700">{lane.name}</td>
                    <td className="py-2 text-right font-medium text-slate-900">{lane.shotCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-slate-500">No shots yet – totals will appear once shots are added.</p>
          )}
        </CardContent>
      </Card>
      <Card className="h-full">
        <CardHeader>
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Talent coverage</h2>
              <p className="text-sm text-slate-500">Shots assigned to each talent by lane.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <p className="text-sm text-slate-500">Gathering talent assignments…</p>
          ) : hasPlannerData ? (
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
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
                {talentRows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 last:border-b-0">
                    <td className={`py-2 pr-3 ${row.id === "__talent_unassigned__" ? "text-slate-500" : "text-slate-700"}`}>
                      {row.name}
                    </td>
                    <td className="py-2 pr-3 text-right font-medium text-slate-900">{row.total}</td>
                    {talentLanes.map((lane) => (
                      <td key={lane.id} className="py-2 pr-3 text-right text-slate-700">
                        {row.byLane?.[lane.id] ?? 0}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-slate-500">Talent breakdowns will appear once shots have assignments.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default PlannerSummary;
