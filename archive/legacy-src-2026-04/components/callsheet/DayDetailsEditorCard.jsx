import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { useDayDetails } from "../../hooks/useDayDetails";

export default function DayDetailsEditorCard({ clientId, projectId, scheduleId, readOnly = false }) {
  const { dayDetails, hasRemoteDayDetails, ensureDayDetails, updateDayDetails } = useDayDetails(
    clientId,
    projectId,
    scheduleId
  );

  const [draft, setDraft] = useState({
    crewCallTime: "",
    shootingCallTime: "",
    estimatedWrap: "",
  });

  useEffect(() => {
    if (!scheduleId) return;
    if (hasRemoteDayDetails) return;
    if (readOnly) return;
    ensureDayDetails.mutate();
  }, [ensureDayDetails, hasRemoteDayDetails, readOnly, scheduleId]);

  useEffect(() => {
    if (!dayDetails) return;
    setDraft({
      crewCallTime: dayDetails.crewCallTime || "",
      shootingCallTime: dayDetails.shootingCallTime || "",
      estimatedWrap: dayDetails.estimatedWrap || "",
    });
  }, [dayDetails]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
              Day details
            </div>
            <div className="text-xs text-slate-500">General call times for this schedule.</div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (!dayDetails) return;
                setDraft({
                  crewCallTime: dayDetails.crewCallTime || "",
                  shootingCallTime: dayDetails.shootingCallTime || "",
                  estimatedWrap: dayDetails.estimatedWrap || "",
                });
              }}
              disabled={readOnly}
            >
              Reset
            </Button>
            <Button
              onClick={() => {
                updateDayDetails.mutate({
                  crewCallTime: draft.crewCallTime,
                  shootingCallTime: draft.shootingCallTime,
                  estimatedWrap: draft.estimatedWrap,
                });
              }}
              disabled={readOnly || updateDayDetails.isPending}
            >
              {readOnly ? "Read-only" : updateDayDetails.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-slate-500">Crew call</span>
            <input
              value={draft.crewCallTime}
              onChange={(e) => setDraft((prev) => ({ ...prev, crewCallTime: e.target.value }))}
              placeholder="e.g. 06:00"
              className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-slate-500">Shooting call</span>
            <input
              value={draft.shootingCallTime}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  shootingCallTime: e.target.value,
                }))
              }
              placeholder="e.g. 07:00"
              className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-slate-500">Estimated wrap</span>
            <input
              value={draft.estimatedWrap}
              onChange={(e) => setDraft((prev) => ({ ...prev, estimatedWrap: e.target.value }))}
              placeholder="e.g. 18:00"
              className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2"
            />
          </label>
        </div>
      </CardContent>
    </Card>
  );
}
