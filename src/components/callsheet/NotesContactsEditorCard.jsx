import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useDayDetails } from "../../hooks/useDayDetails";

function normalizeText(value) {
  if (value == null) return "";
  return String(value);
}

function toNullableText(value) {
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed : null;
}

function normalizeLocationLabel(ref) {
  if (!ref) return "";
  if (ref.label != null && String(ref.label).trim()) return String(ref.label);
  return "";
}

function buildLocationRef(label) {
  const trimmed = String(label || "").trim();
  if (!trimmed) return null;
  return { locationId: null, label: trimmed, notes: null };
}

export default function NotesContactsEditorCard({ clientId, projectId, scheduleId }) {
  const { dayDetails, hasRemoteDayDetails, ensureDayDetails, updateDayDetails } = useDayDetails(
    clientId,
    projectId,
    scheduleId
  );

  const [draft, setDraft] = useState({
    keyPeople: "",
    setMedic: "",
    scriptVersion: "",
    scheduleVersion: "",
    productionOffice: "",
    basecamp: "",
    parking: "",
    nearestHospital: "",
    notes: "",
  });

  useEffect(() => {
    if (!scheduleId) return;
    if (hasRemoteDayDetails) return;
    ensureDayDetails.mutate();
  }, [ensureDayDetails, hasRemoteDayDetails, scheduleId]);

  useEffect(() => {
    if (!dayDetails) return;
    setDraft({
      keyPeople: normalizeText(dayDetails.keyPeople),
      setMedic: normalizeText(dayDetails.setMedic),
      scriptVersion: normalizeText(dayDetails.scriptVersion),
      scheduleVersion: normalizeText(dayDetails.scheduleVersion),
      productionOffice: normalizeLocationLabel(dayDetails.productionOffice),
      basecamp: normalizeLocationLabel(dayDetails.basecamp),
      parking: normalizeLocationLabel(dayDetails.parking),
      nearestHospital: normalizeLocationLabel(dayDetails.nearestHospital),
      notes: normalizeText(dayDetails.notes),
    });
  }, [dayDetails]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
              Notes / Contacts
            </div>
            <div className="text-xs text-slate-500">Key info shown on the call sheet.</div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (!dayDetails) return;
                setDraft({
                  keyPeople: normalizeText(dayDetails.keyPeople),
                  setMedic: normalizeText(dayDetails.setMedic),
                  scriptVersion: normalizeText(dayDetails.scriptVersion),
                  scheduleVersion: normalizeText(dayDetails.scheduleVersion),
                  productionOffice: normalizeLocationLabel(dayDetails.productionOffice),
                  basecamp: normalizeLocationLabel(dayDetails.basecamp),
                  parking: normalizeLocationLabel(dayDetails.parking),
                  nearestHospital: normalizeLocationLabel(dayDetails.nearestHospital),
                  notes: normalizeText(dayDetails.notes),
                });
              }}
            >
              Reset
            </Button>
            <Button
              onClick={() => {
                updateDayDetails.mutate({
                  keyPeople: toNullableText(draft.keyPeople),
                  setMedic: toNullableText(draft.setMedic),
                  scriptVersion: toNullableText(draft.scriptVersion),
                  scheduleVersion: toNullableText(draft.scheduleVersion),
                  productionOffice: buildLocationRef(draft.productionOffice),
                  basecamp: buildLocationRef(draft.basecamp),
                  parking: buildLocationRef(draft.parking),
                  nearestHospital: buildLocationRef(draft.nearestHospital),
                  notes: toNullableText(draft.notes),
                });
              }}
              disabled={updateDayDetails.isPending}
            >
              {updateDayDetails.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="text-xs font-medium text-slate-500">Set medic</span>
              <Input
                value={draft.setMedic}
                onChange={(e) => setDraft((prev) => ({ ...prev, setMedic: e.target.value }))}
                placeholder="Name / contact"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-xs font-medium text-slate-500">Key people</span>
              <Input
                value={draft.keyPeople}
                onChange={(e) => setDraft((prev) => ({ ...prev, keyPeople: e.target.value }))}
                placeholder="Producer, Director, etc."
              />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="text-xs font-medium text-slate-500">Script version</span>
              <Input
                value={draft.scriptVersion}
                onChange={(e) => setDraft((prev) => ({ ...prev, scriptVersion: e.target.value }))}
                placeholder="e.g. v3"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-xs font-medium text-slate-500">Schedule version</span>
              <Input
                value={draft.scheduleVersion}
                onChange={(e) => setDraft((prev) => ({ ...prev, scheduleVersion: e.target.value }))}
                placeholder="e.g. v1"
              />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="text-xs font-medium text-slate-500">Production office</span>
              <Input
                value={draft.productionOffice}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, productionOffice: e.target.value }))
                }
                placeholder="Address / notes"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-xs font-medium text-slate-500">Basecamp</span>
              <Input
                value={draft.basecamp}
                onChange={(e) => setDraft((prev) => ({ ...prev, basecamp: e.target.value }))}
                placeholder="Address / notes"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-xs font-medium text-slate-500">Parking</span>
              <Input
                value={draft.parking}
                onChange={(e) => setDraft((prev) => ({ ...prev, parking: e.target.value }))}
                placeholder="Address / notes"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-xs font-medium text-slate-500">Nearest hospital</span>
              <Input
                value={draft.nearestHospital}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, nearestHospital: e.target.value }))
                }
                placeholder="Address / notes"
              />
            </label>
          </div>

          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-slate-500">Notes</span>
            <textarea
              value={draft.notes}
              onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))}
              rows={6}
              placeholder="General notes..."
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </label>
        </div>
      </CardContent>
    </Card>
  );
}

