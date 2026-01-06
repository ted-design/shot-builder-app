import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { Modal } from "../ui/modal";
import { useTalent } from "../../hooks/useFirestoreQuery";
import { useTalentCalls } from "../../hooks/useTalentCalls";

function isTimeString(value) {
  if (!value) return false;
  return /^\d{1,2}:\d{2}$/.test(String(value).trim());
}

export default function TalentCallsCard({ clientId, projectId, scheduleId }) {
  const { data: allTalent = [], isLoading: loadingTalent, error: talentError } = useTalent(clientId);
  const { callsByTalentId, upsertTalentCall, deleteTalentCall } = useTalentCalls(
    clientId,
    projectId,
    scheduleId
  );

  const [draftByTalentId, setDraftByTalentId] = useState({});
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

  const projectTalent = useMemo(() => {
    if (!projectId) return [];
    return allTalent
      .filter((t) => Array.isArray(t.projectIds) && t.projectIds.includes(projectId))
      .slice()
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }, [allTalent, projectId]);

  useEffect(() => {
    const next = {};
    projectTalent.forEach((t) => {
      const call = callsByTalentId.get(t.id);
      const callValue = (call?.callTime || call?.callText || "").trim();
      next[t.id] = {
        call: callValue,
        set: (call?.setTime || "").trim(),
        wrap: (call?.wrapTime || "").trim(),
        status: (call?.status || "").trim(),
        transportation: (call?.transportation || "").trim(),
      };
    });
    setDraftByTalentId(next);
  }, [callsByTalentId, projectTalent]);

  const applyTalentCall = (talentId) => {
    const draft = draftByTalentId[talentId] || {};
    const rawCall = (draft.call || "").trim();
    const rawSet = (draft.set || "").trim();
    const rawWrap = (draft.wrap || "").trim();
    const rawStatus = (draft.status || "").trim();
    const rawTransportation = (draft.transportation || "").trim();

    if (!rawCall && !rawSet && !rawWrap && !rawStatus && !rawTransportation) {
      deleteTalentCall.mutate(talentId);
      return;
    }

    const updates = {};

    if (!rawCall) {
      updates.callTime = null;
      updates.callText = null;
    } else if (isTimeString(rawCall)) {
      updates.callTime = rawCall;
      updates.callText = null;
    } else {
      updates.callTime = null;
      updates.callText = rawCall;
    }

    updates.setTime = rawSet && isTimeString(rawSet) ? rawSet : null;
    updates.wrapTime = rawWrap && isTimeString(rawWrap) ? rawWrap : null;
    updates.status = rawStatus ? rawStatus : null;
    updates.transportation = rawTransportation ? rawTransportation : null;

    upsertTalentCall.mutate({ talentId, updates });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
              Talent call overrides
            </div>
            <div className="text-xs text-slate-500">Set call times per person (time or text).</div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsClearModalOpen(true)}
          >
            Clear overrides
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loadingTalent ? (
          <div className="text-sm text-slate-500">Loading…</div>
        ) : talentError ? (
          <div className="text-sm text-red-600">Failed to load talent: {talentError.message}</div>
        ) : projectTalent.length === 0 ? (
          <div className="text-sm text-slate-500">
            No talent assigned to this project yet. Add talent in <span className="font-medium">Project Assets</span>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2 text-left">Talent</th>
                  <th className="px-3 py-2 text-left">Call</th>
                  <th className="px-3 py-2 text-left">Set</th>
                  <th className="px-3 py-2 text-left">Wrap</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Transpo</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {projectTalent.map((talent) => {
                  const talentId = talent.id;
                  const name = talent.name || "Unnamed";
                  const draft = draftByTalentId[talentId] || {};

                  return (
                    <tr key={talentId}>
                      <td className="px-3 py-2">{name}</td>
                      <td className="px-3 py-2">
                        <input
                          value={draft.call || ""}
                          onChange={(e) =>
                            setDraftByTalentId((prev) => ({
                              ...prev,
                              [talentId]: { ...(prev[talentId] || {}), call: e.target.value },
                            }))
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.currentTarget.blur();
                            }
                          }}
                          onBlur={() => applyTalentCall(talentId)}
                          placeholder="HH:MM or text (OFF / O/C)"
                          className="w-40 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="time"
                          value={draft.set || ""}
                          onChange={(e) =>
                            setDraftByTalentId((prev) => ({
                              ...prev,
                              [talentId]: { ...(prev[talentId] || {}), set: e.target.value },
                            }))
                          }
                          onBlur={() => applyTalentCall(talentId)}
                          className="w-36 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="time"
                          value={draft.wrap || ""}
                          onChange={(e) =>
                            setDraftByTalentId((prev) => ({
                              ...prev,
                              [talentId]: { ...(prev[talentId] || {}), wrap: e.target.value },
                            }))
                          }
                          onBlur={() => applyTalentCall(talentId)}
                          className="w-36 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={draft.status || ""}
                          onChange={(e) =>
                            setDraftByTalentId((prev) => ({
                              ...prev,
                              [talentId]: { ...(prev[talentId] || {}), status: e.target.value },
                            }))
                          }
                          onBlur={() => applyTalentCall(talentId)}
                          className="h-10 w-36 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                        >
                          <option value="">—</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="pending">Pending</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={draft.transportation || ""}
                          onChange={(e) =>
                            setDraftByTalentId((prev) => ({
                              ...prev,
                              [talentId]: { ...(prev[talentId] || {}), transportation: e.target.value },
                            }))
                          }
                          onBlur={() => applyTalentCall(talentId)}
                          placeholder="Transpo"
                          className="w-40 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setDraftByTalentId((prev) => ({
                              ...prev,
                              [talentId]: { call: "", set: "", wrap: "", status: "", transportation: "" },
                            }));
                            deleteTalentCall.mutate(talentId);
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
        )}
      </CardContent>

      <Modal
        open={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        labelledBy="callsheet-clear-talent-overrides-title"
        describedBy="callsheet-clear-talent-overrides-desc"
        contentClassName="!max-w-md !min-h-0"
        closeOnOverlay={false}
      >
        <div className="p-6">
          <div className="space-y-2">
            <div
              id="callsheet-clear-talent-overrides-title"
              className="text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              Clear talent call overrides?
            </div>
            <div
              id="callsheet-clear-talent-overrides-desc"
              className="text-sm text-slate-600 dark:text-slate-400"
            >
              This removes all per-talent call overrides for this schedule.
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsClearModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                projectTalent.forEach((t) => deleteTalentCall.mutate(t.id));
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
