import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { Modal } from "../ui/modal";
import { useClientCalls } from "../../hooks/useClientCalls";
import { toast } from "../../lib/toast";
import PeopleFieldsModal from "./people/PeopleFieldsModal";
import { DEFAULT_CLIENT_ROSTER_COLUMNS, normalizeRosterColumns } from "../../lib/callsheet/peopleColumns";
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

export default function ClientsCallsCard({
  clientId,
  projectId,
  scheduleId,
  section = null,
  onUpdateSectionConfig,
  readOnly = false,
}) {
  const { calls, callsById, createClientCall, upsertClientCall, deleteClientCall, loading, error } = useClientCalls(
    clientId,
    projectId,
    scheduleId
  );

  const [draftById, setDraftById] = useState({});
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [isFieldsModalOpen, setIsFieldsModalOpen] = useState(false);

  const sectionTitle = useMemo(() => {
    const raw = section?.config?.title;
    const title = raw != null ? String(raw) : "";
    return title.trim() ? title : "Clients";
  }, [section?.config?.title]);

  const columnConfig = useMemo(() => {
    return normalizeRosterColumns(section?.config?.columnConfig, DEFAULT_CLIENT_ROSTER_COLUMNS);
  }, [section?.config?.columnConfig]);

  const visibleColumns = useMemo(() => {
    return columnConfig
      .filter((col) => col.visible !== false && col.width !== "hidden")
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [columnConfig]);

  useEffect(() => {
    const next = {};
    (calls || []).forEach((call) => {
      const callValue = (call?.callTime || call?.callText || "").trim();
      next[call.id] = {
        name: (call?.name || "").trim(),
        role: (call?.role || "").trim(),
        status: (call?.status || "").trim(),
        transportation: (call?.transportation || "").trim(),
        call: callValue,
        blockRhs: (call?.blockRhs || "").trim(),
        muWard: (call?.muWard || "").trim(),
        set: (call?.setTime || "").trim(),
        remarks: (call?.notes || "").trim(),
      };
    });
    setDraftById(next);
  }, [calls]);

  const applyClientCall = (id) => {
    if (readOnly) return;
    const draft = draftById[id] || {};
    const persistedCall = callsById.get(id);
    const rawName = (draft.name || "").trim();
    const rawRole = (draft.role || "").trim();
    const rawStatus = (draft.status || "").trim();
    const rawTransportation = (draft.transportation || "").trim();
    const rawCall = (draft.call || "").trim();
    const rawBlockRhs = (draft.blockRhs || "").trim();
    const rawMuWard = (draft.muWard || "").trim();
    const rawSet = (draft.set || "").trim();
    const rawRemarks = (draft.remarks || "").trim();

    if (!rawName) {
      toast.error({ title: "Client name required", description: "Enter a name or delete the row." });
      return;
    }

    if (
      !rawRole &&
      !rawStatus &&
      !rawTransportation &&
      !rawCall &&
      !rawBlockRhs &&
      !rawMuWard &&
      !rawSet &&
      !rawRemarks
    ) {
      upsertClientCall.mutate({ id, updates: { name: rawName } });
      return;
    }

    const restoreFieldFromPersisted = (fieldKey) => {
      const persistedValue =
        fieldKey === "call"
          ? (persistedCall?.callTime || persistedCall?.callText || "").trim()
          : (persistedCall?.setTime || "").trim();
      setDraftById((prev) => ({
        ...prev,
        [id]: {
          ...(prev[id] || {}),
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

    const updates = { name: rawName };

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

    updates.role = rawRole ? rawRole : null;
    updates.status = rawStatus ? rawStatus : null;
    updates.transportation = rawTransportation ? rawTransportation : null;
    updates.blockRhs = rawBlockRhs ? rawBlockRhs : null;
    updates.muWard = rawMuWard ? rawMuWard : null;
    updates.setTime = setResult.kind === "time" ? setResult.canonical : null;
    updates.notes = rawRemarks ? rawRemarks : null;

    upsertClientCall.mutate({ id, updates });
  };

  const handleCreate = async () => {
    if (readOnly) return;
    const trimmed = newName.trim();
    if (!trimmed) return;
    try {
      await createClientCall.mutateAsync({ name: trimmed });
      toast.success({ title: "Client added" });
      setNewName("");
      setIsAddModalOpen(false);
    } catch (error) {
      toast.error({ title: "Failed to add client", description: error?.message });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{sectionTitle}</div>
            <div className="text-xs text-slate-500">Client contacts included in this call sheet.</div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsFieldsModalOpen(true)}>
              Edit Fields
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsAddModalOpen(true)} disabled={readOnly}>
              + Add Client
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsClearModalOpen(true)} disabled={readOnly}>
              Clear
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-slate-500">Loading…</div>
        ) : error ? (
          <div className="text-sm text-red-600">Failed to load clients: {error.message}</div>
        ) : (calls || []).length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900">
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">No clients in callsheet</div>
            <div className="mt-1 text-sm text-slate-500">Add client contacts to include them on the call sheet.</div>
            <div className="mt-4 flex justify-center">
              <Button variant="outline" onClick={() => setIsAddModalOpen(true)} disabled={readOnly}>
                + Add Client
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
                {(calls || []).map((call, idx) => {
                  const id = call.id;
                  const draft = draftById[id] || {
                    name: call.name || "",
                    role: "",
                    status: "",
                    transportation: "",
                    call: "",
                    blockRhs: "",
                    muWard: "",
                    set: "",
                    remarks: "",
                  };

                  return (
                    <tr key={id}>
                      {visibleColumns.map((col) => {
                        if (col.key === "id") {
                          return (
                            <td key="id" className="px-3 py-2 font-mono text-xs text-slate-500">
                              {idx + 1}
                            </td>
                          );
                        }

                        if (col.key === "status") {
                          return (
                            <td key="status" className="px-3 py-2">
                              <select
                                value={draft.status || ""}
                                onChange={(e) =>
                                  setDraftById((prev) => ({
                                    ...prev,
                                    [id]: { ...(prev[id] || {}), status: e.target.value },
                                  }))
                                }
                                onBlur={() => applyClientCall(id)}
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
                          key === "name"
                            ? draft.name || ""
                            : key === "role"
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
                                        : key === "remarks"
                                          ? draft.remarks || ""
                                          : "";

                        const isCallField = key === "call";
                        const isSetField = key === "set";
                        const placeholder = isCallField
                          ? "6:17 AM or text (OFF / O/C)"
                          : isSetField
                            ? "e.g. 6:17 AM"
                            : col.label;

                        return (
                          <td key={key} className="px-3 py-2">
                            <input
                              type="text"
                              value={value}
                              onChange={(e) =>
                                setDraftById((prev) => ({
                                  ...prev,
                                  [id]: { ...(prev[id] || {}), [key]: e.target.value },
                                }))
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter") event.currentTarget.blur();
                              }}
                              onBlur={() => applyClientCall(id)}
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
                          onClick={() => deleteClientCall.mutate(id)}
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
      </CardContent>

      <Modal
        open={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setNewName("");
        }}
        labelledBy="callsheet-add-client-title"
        describedBy="callsheet-add-client-desc"
        contentClassName="!max-w-lg !min-h-0"
      >
        <div className="p-4">
          <div id="callsheet-add-client-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Add client to callsheet
          </div>
          <div id="callsheet-add-client-desc" className="mt-1 text-sm text-slate-500">
            Adds a client contact row to this schedule’s call sheet.
          </div>

          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Client name…"
            className="mt-4 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={readOnly || !newName.trim() || createClientCall.isPending}>
              Add
            </Button>
          </div>
        </div>
      </Modal>

      <PeopleFieldsModal
        isOpen={isFieldsModalOpen}
        onClose={() => setIsFieldsModalOpen(false)}
        columns={columnConfig}
        defaultColumns={DEFAULT_CLIENT_ROSTER_COLUMNS}
        title="Edit Client Fields"
        sectionTitle={sectionTitle}
        onSectionTitleChange={(nextTitle) => onUpdateSectionConfig?.(section?.id, { title: String(nextTitle || "") })}
        onSave={(nextColumns) => onUpdateSectionConfig?.(section?.id, { columnConfig: nextColumns })}
      />

      <Modal
        open={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        labelledBy="callsheet-clear-client-rows-title"
        describedBy="callsheet-clear-client-rows-desc"
        contentClassName="!max-w-md !min-h-0"
        closeOnOverlay={false}
      >
        <div className="p-6">
          <div className="space-y-2">
            <div id="callsheet-clear-client-rows-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Clear callsheet clients?
            </div>
            <div id="callsheet-clear-client-rows-desc" className="text-sm text-slate-600 dark:text-slate-400">
              This removes all client contact rows from this schedule’s call sheet.
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsClearModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                (calls || []).forEach((row) => deleteClientCall.mutate(row.id));
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
