import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { Modal } from "../ui/modal";
import { useDepartments } from "../../hooks/useDepartments";
import { useOrganizationCrew } from "../../hooks/useOrganizationCrew";
import { useProjectCrew } from "../../hooks/useProjectCrew";
import { useCrewCalls } from "../../hooks/useCrewCalls";
import { useProjectDepartments } from "../../hooks/useProjectDepartments";
import { parseTimeToMinutes } from "../../lib/timeUtils";

function isTimeString(value) {
  if (!value) return false;
  return /^\d{1,2}:\d{2}$/.test(String(value).trim());
}

function getTimeDeltaMinutes(baseTime, overrideTime) {
  if (!isTimeString(baseTime) || !isTimeString(overrideTime)) return null;
  const base = parseTimeToMinutes(baseTime);
  const next = parseTimeToMinutes(overrideTime);
  if (!Number.isFinite(base) || !Number.isFinite(next)) return null;
  return next - base;
}

function formatDelta(deltaMinutes) {
  if (!Number.isFinite(deltaMinutes) || deltaMinutes === 0) return null;
  const sign = deltaMinutes > 0 ? "+" : "-";
  const abs = Math.abs(deltaMinutes);
  return `${sign}${abs}m`;
}

function getDeltaTag(deltaMinutes) {
  if (!Number.isFinite(deltaMinutes)) return null;
  if (deltaMinutes === 0) return { label: "ON TIME", tone: "muted" };
  if (deltaMinutes < 0) return { label: `EARLY ${Math.abs(deltaMinutes)}m`, tone: "blue" };
  return { label: `DELAY ${Math.abs(deltaMinutes)}m`, tone: "amber" };
}

export default function CrewCallsCard({ clientId, projectId, scheduleId, generalCrewCallTime }) {
  const { departments } = useDepartments(clientId);
  const { departments: projectDepartments } = useProjectDepartments(clientId, projectId);
  const { crewById } = useOrganizationCrew(clientId);
  const { assignments, loading: loadingAssignments, error: assignmentsError } = useProjectCrew(
    clientId,
    projectId
  );
  const { callsByCrewMemberId, upsertCrewCall, deleteCrewCall } = useCrewCalls(
    clientId,
    projectId,
    scheduleId
  );

  const [draftByCrewMemberId, setDraftByCrewMemberId] = useState({});
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [showEmails, setShowEmails] = useState(() => {
    try {
      const stored = localStorage.getItem("callSheetCrew.showEmails");
      if (stored == null) return false;
      return stored === "true";
    } catch {
      return false;
    }
  });
  const [showPhones, setShowPhones] = useState(() => {
    try {
      const stored = localStorage.getItem("callSheetCrew.showPhones");
      if (stored == null) return false;
      return stored === "true";
    } catch {
      return false;
    }
  });

  const assignedCrew = useMemo(() => {
    return assignments
      .map((a) => {
        const member = crewById.get(a.crewMemberId) || null;
        return { assignment: a, member };
      })
      .filter((row) => row.assignment?.crewMemberId);
  }, [assignments, crewById]);

  const grouped = useMemo(() => {
    const groups = new Map();
    assignedCrew.forEach(({ assignment, member }) => {
      const resolvedScope = assignment.departmentScope || (assignment.departmentId ? "org" : null);
      const resolvedId = assignment.departmentId || member?.departmentId || null;
      const key = resolvedScope && resolvedId ? `${resolvedScope}:${resolvedId}` : "__unassigned__";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ assignment, member });
    });

    groups.forEach((rows) => {
      rows.sort((a, b) => {
        const aKey = `${a.member?.lastName || ""} ${a.member?.firstName || ""}`.trim().toLowerCase();
        const bKey = `${b.member?.lastName || ""} ${b.member?.firstName || ""}`.trim().toLowerCase();
        return aKey.localeCompare(bKey);
      });
    });

    return groups;
  }, [assignedCrew]);

  const orderedGroupIds = useMemo(() => {
    const orgIds = departments.map((d) => `org:${d.id}`);
    const projectIds = projectDepartments.map((d) => `project:${d.id}`);
    const existing = Array.from(grouped.keys()).filter((id) => id !== "__unassigned__");
    const ordered = [...orgIds, ...projectIds].filter((id) => existing.includes(id));
    const leftovers = existing.filter((id) => !ordered.includes(id));
    const hasUnassigned = grouped.has("__unassigned__");
    return [...ordered, ...leftovers, ...(hasUnassigned ? ["__unassigned__"] : [])];
  }, [departments, grouped, projectDepartments]);

  const departmentNameById = useMemo(() => {
    const map = new Map();
    departments.forEach((d) => map.set(`org:${d.id}`, d.name));
    projectDepartments.forEach((d) => map.set(`project:${d.id}`, d.name));
    return map;
  }, [departments, projectDepartments]);

  useEffect(() => {
    const next = {};
    assignedCrew.forEach(({ assignment }) => {
      const call = callsByCrewMemberId.get(assignment.crewMemberId);
      const value = (call?.callTime || call?.callText || "").trim();
      next[assignment.crewMemberId] = value;
    });
    setDraftByCrewMemberId(next);
  }, [assignedCrew, callsByCrewMemberId]);

  const applyCrewCall = (crewMemberId) => {
    const raw = (draftByCrewMemberId[crewMemberId] || "").trim();
    if (!raw) {
      deleteCrewCall.mutate(crewMemberId);
      return;
    }

    if (isTimeString(raw)) {
      upsertCrewCall.mutate({ crewMemberId, updates: { callTime: raw, callText: null } });
      return;
    }

    upsertCrewCall.mutate({ crewMemberId, updates: { callTime: null, callText: raw } });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
              Crew call overrides
            </div>
            <div className="text-xs text-slate-500">
              Leave blank to use general crew call. Enter a time (HH:MM) or text like “OFF” / “O/C”.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={showEmails ? "secondary" : "outline"}
              size="sm"
              onClick={() =>
                setShowEmails((prev) => {
                  const next = !prev;
                  try {
                    localStorage.setItem("callSheetCrew.showEmails", String(next));
                  } catch {}
                  return next;
                })
              }
            >
              Emails
            </Button>
            <Button
              variant={showPhones ? "secondary" : "outline"}
              size="sm"
              onClick={() =>
                setShowPhones((prev) => {
                  const next = !prev;
                  try {
                    localStorage.setItem("callSheetCrew.showPhones", String(next));
                  } catch {}
                  return next;
                })
              }
            >
              Phones
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsClearModalOpen(true)}>
              Clear overrides
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loadingAssignments ? (
          <div className="text-sm text-slate-500">Loading…</div>
        ) : assignmentsError ? (
          <div className="text-sm text-red-600">Failed to load project crew: {assignmentsError.message}</div>
        ) : assignedCrew.length === 0 ? (
          <div className="text-sm text-slate-500">
            No crew assigned to this project yet. Add crew in <span className="font-medium">Project Assets</span>.
          </div>
        ) : (
          <div className="space-y-6">
            {orderedGroupIds.map((deptId) => {
              const rows = grouped.get(deptId) || [];
              const title =
                deptId === "__unassigned__"
                  ? "Unassigned"
                  : departmentNameById.get(deptId) || "Unknown department";
              return (
                <div key={deptId} className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {title}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-900 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <tr>
                          <th className="px-3 py-2 text-left">Crew</th>
                          {showEmails ? <th className="px-3 py-2 text-left">Email</th> : null}
                          {showPhones ? <th className="px-3 py-2 text-left">Phone</th> : null}
                          <th className="px-3 py-2 text-left">Call</th>
                          <th className="px-3 py-2 text-left">Delta</th>
                          <th className="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {rows.map(({ assignment, member }) => {
                          const name = member
                            ? `${member.firstName || ""} ${member.lastName || ""}`.trim() || "Unnamed"
                            : `Missing (${assignment.crewMemberId})`;
                          const draft = draftByCrewMemberId[assignment.crewMemberId] || "";
                          const inherited =
                            draft.trim() || (generalCrewCallTime ? String(generalCrewCallTime).trim() : "");
                          const delta = getTimeDeltaMinutes(generalCrewCallTime, inherited);
                          const deltaLabel = formatDelta(delta);
                          const deltaTag = getDeltaTag(delta);

                          return (
                            <tr key={assignment.crewMemberId}>
                              <td className="px-3 py-2">{name}</td>
                              {showEmails ? (
                                <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                                  {member?.email ? String(member.email) : "—"}
                                </td>
                              ) : null}
                              {showPhones ? (
                                <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                                  {member?.phone ? String(member.phone) : "—"}
                                </td>
                              ) : null}
                              <td className="px-3 py-2">
                                <input
                                  value={draft}
                                  onChange={(e) =>
                                    setDraftByCrewMemberId((prev) => ({
                                      ...prev,
                                      [assignment.crewMemberId]: e.target.value,
                                    }))
                                  }
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.currentTarget.blur();
                                    }
                                  }}
                                  onBlur={() => applyCrewCall(assignment.crewMemberId)}
                                  placeholder={generalCrewCallTime ? `Default: ${generalCrewCallTime}` : "HH:MM or text"}
                                  className="w-48 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                                />
                              </td>
                              <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                                {deltaTag ? (
                                  <span
                                    className={[
                                      "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                      deltaTag.tone === "blue"
                                        ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200"
                                        : deltaTag.tone === "amber"
                                          ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200"
                                          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
                                    ].join(" ")}
                                    title={deltaLabel || undefined}
                                  >
                                    {deltaTag.label}
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <Button
                                  variant="ghost"
                                  onClick={() => {
                                    setDraftByCrewMemberId((prev) => ({
                                      ...prev,
                                      [assignment.crewMemberId]: "",
                                    }));
                                    deleteCrewCall.mutate(assignment.crewMemberId);
                                  }}
                                >
                                  Clear
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Modal
        open={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        labelledBy="callsheet-clear-crew-overrides-title"
        describedBy="callsheet-clear-crew-overrides-desc"
        contentClassName="!max-w-md !min-h-0"
        closeOnOverlay={false}
      >
        <div className="p-6">
          <div className="space-y-2">
            <div
              id="callsheet-clear-crew-overrides-title"
              className="text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              Clear crew call overrides?
            </div>
            <div
              id="callsheet-clear-crew-overrides-desc"
              className="text-sm text-slate-600 dark:text-slate-400"
            >
              This removes all per-person crew call overrides for this schedule.
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsClearModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                assignedCrew.forEach(({ assignment }) => deleteCrewCall.mutate(assignment.crewMemberId));
                setIsClearModalOpen(false);
              }}
            >
              Clear
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
