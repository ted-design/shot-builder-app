import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { Modal } from "../ui/modal";
import { useTalent } from "../../hooks/useFirestoreQuery";
import { useTalentCalls } from "../../hooks/useTalentCalls";
import { toast } from "../../lib/toast";
import PeopleFieldsModal from "./people/PeopleFieldsModal";
import { DEFAULT_TALENT_ROSTER_COLUMNS, normalizeRosterColumns } from "../../lib/callsheet/peopleColumns";
import { classifyCallsheetTimeInput } from "../../lib/time/callsheetTimeEntry";

function getWidthClass(width) {
  const widthMap = {
    xs: "w-16 min-w-[64px]",
    sm: "w-24 min-w-[96px]",
    md: "w-32 min-w-[128px]",
    lg: "w-48 min-w-[192px]",
    xl: "min-w-[240px]",
    hidden: "hidden",
  };
  return widthMap[width] || "w-32 min-w-[128px]";
}

export default function TalentCallsCard({
  clientId,
  projectId,
  scheduleId,
  scheduledTalentIds = [],
  section = null,
  onUpdateSectionConfig,
  readOnly = false,
}) {
  const { data: allTalent = [], isLoading: loadingTalent, error: talentError } = useTalent(clientId);
  const { callsByTalentId, upsertTalentCall, deleteTalentCall } = useTalentCalls(clientId, projectId, scheduleId);

  const [draftByTalentId, setDraftByTalentId] = useState({});
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addQuery, setAddQuery] = useState("");
  const [isFieldsModalOpen, setIsFieldsModalOpen] = useState(false);

  const sectionTitle = useMemo(() => {
    const raw = section?.config?.title;
    const title = raw != null ? String(raw) : "";
    return title.trim() ? title : "Talent";
  }, [section?.config?.title]);

  const columnConfig = useMemo(() => {
    return normalizeRosterColumns(section?.config?.columnConfig, DEFAULT_TALENT_ROSTER_COLUMNS);
  }, [section?.config?.columnConfig]);

  const visibleColumns = useMemo(() => {
    return columnConfig
      .filter((col) => col.visible !== false && col.width !== "hidden")
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [columnConfig]);

  const projectTalent = useMemo(() => {
    if (!projectId) return [];
    return allTalent
      .filter((t) => Array.isArray(t.projectIds) && t.projectIds.includes(projectId))
      .slice()
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }, [allTalent, projectId]);

  const scheduledTalentIdSet = useMemo(() => new Set(scheduledTalentIds.filter(Boolean)), [scheduledTalentIds]);

  const callSheetTalent = useMemo(() => {
    return projectTalent.filter((t) => callsByTalentId.has(t.id));
  }, [callsByTalentId, projectTalent]);

  const suggestedTalent = useMemo(() => {
    return projectTalent
      .filter((t) => scheduledTalentIdSet.has(t.id) && !callsByTalentId.has(t.id))
      .slice()
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }, [callsByTalentId, projectTalent, scheduledTalentIdSet]);

  const addableTalent = useMemo(() => {
    const query = addQuery.trim().toLowerCase();
    return projectTalent
      .filter((t) => !callsByTalentId.has(t.id))
      .filter((t) => (query ? String(t.name || "").toLowerCase().includes(query) : true))
      .slice()
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }, [addQuery, callsByTalentId, projectTalent]);

  useEffect(() => {
    const next = {};
    callSheetTalent.forEach((t) => {
      const call = callsByTalentId.get(t.id);
      const callValue = (call?.callTime || call?.callText || "").trim();
      next[t.id] = {
        call: callValue,
        set: (call?.setTime || "").trim(),
        wrap: (call?.wrapTime || "").trim(),
        role: (call?.role || "").trim(),
        blockRhs: (call?.blockRhs || "").trim(),
        muWard: (call?.muWard || "").trim(),
        status: (call?.status || "").trim(),
        transportation: (call?.transportation || "").trim(),
        remarks: (call?.notes || "").trim(),
      };
    });
    setDraftByTalentId(next);
  }, [callsByTalentId, callSheetTalent]);

  const applyTalentCall = (talentId) => {
    if (readOnly) return;
    const draft = draftByTalentId[talentId] || {};
    const persistedCall = callsByTalentId.get(talentId);
    const rawCall = (draft.call || "").trim();
    const rawSet = (draft.set || "").trim();
    const rawWrap = (draft.wrap || "").trim();
    const rawRole = (draft.role || "").trim();
    const rawBlockRhs = (draft.blockRhs || "").trim();
    const rawMuWard = (draft.muWard || "").trim();
    const rawStatus = (draft.status || "").trim();
    const rawTransportation = (draft.transportation || "").trim();
    const rawRemarks = (draft.remarks || "").trim();

    if (
      !rawCall &&
      !rawSet &&
      !rawWrap &&
      !rawRole &&
      !rawBlockRhs &&
      !rawMuWard &&
      !rawStatus &&
      !rawTransportation &&
      !rawRemarks
    ) {
      deleteTalentCall.mutate(talentId);
      return;
    }

    const restoreFieldFromPersisted = (fieldKey) => {
      const persistedValue =
        fieldKey === "call"
          ? (persistedCall?.callTime || persistedCall?.callText || "").trim()
          : fieldKey === "set"
            ? (persistedCall?.setTime || "").trim()
            : (persistedCall?.wrapTime || "").trim();
      setDraftByTalentId((prev) => ({
        ...prev,
        [talentId]: {
          ...(prev[talentId] || {}),
          [fieldKey]: persistedValue,
        },
      }));
    };

    const callResult = classifyCallsheetTimeInput(rawCall, { allowText: true });
    if (callResult.kind === "invalid-time") {
      restoreFieldFromPersisted("call");
      toast.error({
        title: "Invalid call time",
        description: "Use AM/PM (e.g. 6:17 AM), 24h (e.g. 14:30), or text like OFF.",
      });
      return;
    }

    const setResult = classifyCallsheetTimeInput(rawSet);
    if (setResult.kind === "invalid-time") {
      restoreFieldFromPersisted("set");
      toast.error({
        title: "Invalid set time",
        description: "Use AM/PM (e.g. 6:17 AM) or unambiguous 24h time (e.g. 14:30).",
      });
      return;
    }

    const wrapResult = classifyCallsheetTimeInput(rawWrap);
    if (wrapResult.kind === "invalid-time") {
      restoreFieldFromPersisted("wrap");
      toast.error({
        title: "Invalid wrap time",
        description: "Use AM/PM (e.g. 6:17 AM) or unambiguous 24h time (e.g. 14:30).",
      });
      return;
    }

    const updates = {};

    if (callResult.kind === "empty") {
      updates.callTime = null;
      updates.callText = null;
    } else if (callResult.kind === "time") {
      updates.callTime = callResult.canonical;
      updates.callText = null;
    } else {
      updates.callTime = null;
      updates.callText = callResult.text;
    }

    updates.setTime = setResult.kind === "time" ? setResult.canonical : null;
    updates.wrapTime = wrapResult.kind === "time" ? wrapResult.canonical : null;
    updates.role = rawRole ? rawRole : null;
    updates.blockRhs = rawBlockRhs ? rawBlockRhs : null;
    updates.muWard = rawMuWard ? rawMuWard : null;
    updates.status = rawStatus ? rawStatus : null;
    updates.transportation = rawTransportation ? rawTransportation : null;
    updates.notes = rawRemarks ? rawRemarks : null;

    upsertTalentCall.mutate({ talentId, updates });
  };

  const handleAddTalent = async (talentId) => {
    if (readOnly) return;
    try {
      await upsertTalentCall.mutateAsync({ talentId, updates: {} });
      toast.success({ title: "Added to call sheet" });
    } catch (error) {
      toast.error({ title: "Failed to add talent", description: error?.message });
    }
  };

  const handleAddAllSuggested = async () => {
    if (readOnly) return;
    if (suggestedTalent.length === 0) return;
    try {
      await Promise.all(suggestedTalent.map((t) => upsertTalentCall.mutateAsync({ talentId: t.id, updates: {} })));
      toast.success({ title: `Added ${suggestedTalent.length} talent to call sheet` });
    } catch (error) {
      toast.error({ title: "Failed to add talent", description: error?.message });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{sectionTitle}</div>
            <div className="text-xs text-slate-500">Call sheet talent roster and per-person times.</div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsFieldsModalOpen(true)}>
              Edit Fields
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsAddModalOpen(true)} disabled={readOnly}>
              + Add Talent
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsClearModalOpen(true)} disabled={readOnly}>
              Clear
            </Button>
          </div>
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
          <>
            {suggestedTalent.length > 0 ? (
              <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold">{suggestedTalent.length}</span> new talent found tagged in the scene
                    schedule.
                  </div>
                  <button
                    type="button"
                    className="text-sm font-semibold underline underline-offset-2"
                    onClick={handleAddAllSuggested}
                    disabled={readOnly}
                  >
                    Add all to callsheet
                  </button>
                </div>
              </div>
            ) : null}

            {callSheetTalent.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">No talents in callsheet</div>
                <div className="mt-1 text-sm text-slate-500">
                  Add talent manually, or use the suggestion banner when scenes include tagged talent.
                </div>
                <div className="mt-4 flex justify-center">
                  <Button variant="outline" onClick={() => setIsAddModalOpen(true)} disabled={readOnly}>
                    + Add Talent
                  </Button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <tr>
                      {visibleColumns.map((col) => (
                        <th key={col.key} className={`px-3 py-2 text-left ${getWidthClass(col.width)}`}>
                          {col.label}
                        </th>
                      ))}
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {callSheetTalent.map((talent, idx) => {
                      const talentId = talent.id;
                      const name = talent.name || "Unnamed";
                      const draft = draftByTalentId[talentId] || {
                        call: "",
                        set: "",
                        wrap: "",
                        role: "",
                        blockRhs: "",
                        muWard: "",
                        status: "",
                        transportation: "",
                        remarks: "",
                      };

                      return (
                        <tr key={talentId}>
                          {visibleColumns.map((col) => {
                            if (col.key === "id") {
                              return (
                                <td key="id" className="px-3 py-2 font-mono text-xs text-slate-500">
                                  {idx + 1}
                                </td>
                              );
                            }
                            if (col.key === "name") {
                              return (
                                <td key="name" className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
                                  {name}
                                </td>
                              );
                            }
                            if (col.key === "status") {
                              return (
                                <td key="status" className="px-3 py-2">
                                  <select
                                    value={draft.status || ""}
                                    onChange={(e) =>
                                      setDraftByTalentId((prev) => ({
                                        ...prev,
                                        [talentId]: { ...(prev[talentId] || {}), status: e.target.value },
                                      }))
                                    }
                                    onBlur={() => applyTalentCall(talentId)}
                                    disabled={readOnly}
                                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                                  >
                                    <option value="">—</option>
                                    <option value="confirmed">Confirmed</option>
                                    <option value="pending">Pending</option>
                                    <option value="cancelled">Cancelled</option>
                                  </select>
                                </td>
                              );
                            }

                            const key = col.key;
                            const value =
                              key === "role"
                                ? draft.role || ""
                                : key === "transportation"
                                  ? draft.transportation || ""
                                  : key === "call"
                                    ? draft.call || ""
                                    : key === "blockRhs"
                                      ? draft.blockRhs || ""
                                      : key === "muWard"
                                        ? draft.muWard || ""
                                : key === "set"
                                  ? draft.set || ""
                                  : key === "wrap"
                                    ? draft.wrap || ""
                                  : key === "remarks"
                                    ? draft.remarks || ""
                                    : "";

                            const isCallField = key === "call";
                            const isTimeOnlyField = key === "set" || key === "wrap";
                            const placeholder = isCallField
                              ? "6:17 AM or text (OFF / O/C)"
                              : isTimeOnlyField
                                ? "e.g. 6:17 AM"
                                : col.label;

                            return (
                              <td key={key} className="px-3 py-2">
                                <input
                                  type="text"
                                  value={value}
                                  onChange={(e) =>
                                    setDraftByTalentId((prev) => ({
                                      ...prev,
                                      [talentId]: { ...(prev[talentId] || {}), [key]: e.target.value },
                                    }))
                                  }
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") event.currentTarget.blur();
                                  }}
                                  onBlur={() => applyTalentCall(talentId)}
                                  placeholder={placeholder}
                                  disabled={readOnly}
                                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                                />
                              </td>
                            );
                          })}
                          <td className="px-3 py-2 text-right">
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setDraftByTalentId((prev) => ({
                                  ...prev,
                                  [talentId]: {
                                    call: "",
                                    set: "",
                                    wrap: "",
                                    role: "",
                                    blockRhs: "",
                                    muWard: "",
                                    status: "",
                                    transportation: "",
                                    remarks: "",
                                  },
                                }));
                                deleteTalentCall.mutate(talentId);
                              }}
                              disabled={readOnly}
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
          </>
        )}
      </CardContent>

      <Modal
        open={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setAddQuery("");
        }}
        labelledBy="callsheet-add-talent-title"
        describedBy="callsheet-add-talent-desc"
        contentClassName="!max-w-lg !min-h-0"
      >
        <div className="p-4">
          <div id="callsheet-add-talent-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Add talent to callsheet
          </div>
          <div id="callsheet-add-talent-desc" className="mt-1 text-sm text-slate-500">
            Adds a talent row to the callsheet roster (doesn’t change project assets).
          </div>

          <input
            value={addQuery}
            onChange={(e) => setAddQuery(e.target.value)}
            placeholder="Search talent…"
            className="mt-4 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />

          <div className="mt-4 max-h-[50vh] overflow-auto rounded-md border border-slate-200 dark:border-slate-700">
            {addableTalent.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">No talent available to add.</div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {addableTalent.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                    onClick={async () => {
                      await handleAddTalent(t.id);
                    }}
                    disabled={readOnly}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {t.name || "Unnamed talent"}
                      </div>
                      <div className="truncate text-xs text-slate-500">{t.id}</div>
                    </div>
                    <span className="text-sm font-semibold text-slate-500">Add</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </Modal>

      <PeopleFieldsModal
        isOpen={isFieldsModalOpen}
        onClose={() => setIsFieldsModalOpen(false)}
        columns={columnConfig}
        defaultColumns={DEFAULT_TALENT_ROSTER_COLUMNS}
        title="Edit Talent Fields"
        sectionTitle={sectionTitle}
        onSectionTitleChange={(nextTitle) => onUpdateSectionConfig?.(section?.id, { title: String(nextTitle || "") })}
        onSave={(nextColumns) => onUpdateSectionConfig?.(section?.id, { columnConfig: nextColumns })}
      />

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
              Clear callsheet talent rows?
            </div>
            <div id="callsheet-clear-talent-overrides-desc" className="text-sm text-slate-600 dark:text-slate-400">
              This removes all talent rows from this schedule’s call sheet.
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsClearModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                callSheetTalent.forEach((t) => deleteTalentCall.mutate(t.id));
                setIsClearModalOpen(false);
              }}
              disabled={readOnly}
            >
              Clear
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
