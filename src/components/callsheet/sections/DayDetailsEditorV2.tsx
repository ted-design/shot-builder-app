import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "../../ui/card";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import RichTextEditor from "../../shots/RichTextEditor";
import { useDayDetails } from "../../../hooks/useDayDetails";
import { shiftTimeString } from "../../../lib/callsheet/shiftTimes";
import { toast } from "../../../lib/toast";
import { Plus, Trash2, Wand2 } from "lucide-react";
import type {
  DayDetails,
  DayDetailsCustomLocation,
  DayDetailsNotesStyle,
  LocationReference,
} from "../../../types/callsheet";

type TabKey = "people" | "locations" | "times";

function TabButton({ active, children, ...props }: any) {
  return (
    <button
      type="button"
      className={[
        "relative px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "text-slate-900 dark:text-slate-100"
          : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
      ].join(" ")}
      {...props}
    >
      {children}
      {active ? (
        <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-blue-600" />
      ) : null}
    </button>
  );
}

function normalizeText(value: unknown) {
  if (value == null) return "";
  return String(value);
}

function toNullableText(value: unknown) {
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed : null;
}

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

function normalizeLocation(ref: LocationReference | null | undefined) {
  return {
    label: ref?.label ? String(ref.label) : "",
    notes: ref?.notes ? String(ref.notes) : "",
  };
}

function buildLocationRef(label: string, notes: string): LocationReference | null {
  const trimmed = String(label || "").trim();
  const notesTrimmed = String(notes || "").trim();
  if (!trimmed && !notesTrimmed) return null;
  return {
    locationId: null,
    label: trimmed || null,
    notes: notesTrimmed || null,
  };
}

function normalizeCustomLocations(rows: unknown): Array<DayDetailsCustomLocation> {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const obj = row && typeof row === "object" ? (row as any) : {};
      const id = obj.id ? String(obj.id) : randomId();
      const title = obj.title != null ? String(obj.title) : "";
      const label = obj.label != null ? String(obj.label) : "";
      const notes = obj.notes != null ? String(obj.notes) : "";
      return {
        id,
        title,
        locationId: obj.locationId ?? null,
        label,
        notes,
      } as DayDetailsCustomLocation;
    })
    .filter((row) => row.id);
}

function buildCustomLocationRow(row: DayDetailsCustomLocation): DayDetailsCustomLocation | null {
  const title = String(row.title || "").trim();
  const label = String(row.label || "").trim();
  const notes = String(row.notes || "").trim();
  if (!title && !label && !notes) return null;
  return {
    id: row.id || randomId(),
    title: title || null,
    locationId: row.locationId ?? null,
    label: label || null,
    notes: notes || null,
  };
}

function normalizeNotesStyle(style: unknown): { placement: "top" | "bottom"; color: string; icon: string } {
  const obj = style && typeof style === "object" ? (style as any) : {};
  const placement = obj.placement === "top" ? "top" : "bottom";
  const color = obj.color ? String(obj.color) : "";
  const icon = obj.icon ? String(obj.icon) : "";
  return { placement, color, icon };
}

function buildNotesStyleFromDraft(draft: {
  notesPlacement: "top" | "bottom";
  notesColor: string;
  notesIcon: string;
}): DayDetailsNotesStyle | null {
  const placement = draft.notesPlacement === "top" ? "top" : "bottom";
  const color = toNullableText(draft.notesColor);
  const icon = (draft.notesIcon || "").trim() as any;
  const resolvedIcon = icon === "note" || icon === "info" || icon === "alert" ? icon : null;
  if (placement !== "bottom" || color || resolvedIcon) {
    return { placement, color, icon: resolvedIcon };
  }
  return null;
}

function coerceUpdatedAtMs(value: any): number | null {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toDate === "function") {
    const dt = value.toDate();
    return dt instanceof Date ? dt.getTime() : null;
  }
  return null;
}

function buildComparableUpdatesFromDayDetails(dayDetails: DayDetails | null): Partial<Omit<DayDetails, "scheduleId">> {
  if (!dayDetails) return {};
  const customLocations = Array.isArray(dayDetails.customLocations) ? dayDetails.customLocations : [];
  return {
    keyPeople: dayDetails.keyPeople ?? null,
    setMedic: dayDetails.setMedic ?? null,
    scriptVersion: dayDetails.scriptVersion ?? null,
    scheduleVersion: dayDetails.scheduleVersion ?? null,
    productionOffice: dayDetails.productionOffice ?? null,
    nearestHospital: dayDetails.nearestHospital ?? null,
    parking: dayDetails.parking ?? null,
    basecamp: dayDetails.basecamp ?? null,
    customLocations,
    notes: dayDetails.notes ?? null,
    notesStyle: dayDetails.notesStyle ?? null,
    crewCallTime: String(dayDetails.crewCallTime || ""),
    shootingCallTime: String(dayDetails.shootingCallTime || ""),
    estimatedWrap: String(dayDetails.estimatedWrap || ""),
    breakfastTime: dayDetails.breakfastTime ?? null,
    firstMealTime: dayDetails.firstMealTime ?? null,
    secondMealTime: dayDetails.secondMealTime ?? null,
    weather: dayDetails.weather ?? null,
  };
}

export default function DayDetailsEditorV2({
  clientId,
  projectId,
  scheduleId,
  readOnly = false,
}: {
  clientId: string | null;
  projectId: string | null;
  scheduleId: string | null;
  readOnly?: boolean;
}) {
  const { dayDetails, hasRemoteDayDetails, ensureDayDetails, updateDayDetails } = useDayDetails(
    clientId,
    projectId,
    scheduleId
  );

  const [tab, setTab] = useState<TabKey>("people");
  const [shiftMinutes, setShiftMinutes] = useState(15);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState("");

  const [draft, setDraft] = useState(() => ({
    keyPeople: "",
    setMedic: "",
    scriptVersion: "",
    scheduleVersion: "",
    productionOffice: { label: "", notes: "" },
    nearestHospital: { label: "", notes: "" },
    parking: { label: "", notes: "" },
    basecamp: { label: "", notes: "" },
    customLocations: [] as Array<DayDetailsCustomLocation>,
    notes: "",
    notesPlacement: "bottom" as "top" | "bottom",
    notesColor: "",
    notesIcon: "",
    crewCallTime: "",
    shootingCallTime: "",
    estimatedWrap: "",
    breakfastTime: "",
    firstMealTime: "",
    secondMealTime: "",
    weatherSummary: "",
    lowTemp: "",
    highTemp: "",
    sunrise: "",
    sunset: "",
  }));

  useEffect(() => {
    if (!scheduleId) return;
    if (hasRemoteDayDetails) return;
    if (readOnly) return;
    ensureDayDetails.mutate();
  }, [ensureDayDetails, hasRemoteDayDetails, readOnly, scheduleId]);

  useEffect(() => {
    if (!dayDetails) return;
    const notesStyle = normalizeNotesStyle(dayDetails.notesStyle);
    const customLocations = normalizeCustomLocations(dayDetails.customLocations);
    setDraft({
      keyPeople: normalizeText(dayDetails.keyPeople),
      setMedic: normalizeText(dayDetails.setMedic),
      scriptVersion: normalizeText(dayDetails.scriptVersion),
      scheduleVersion: normalizeText(dayDetails.scheduleVersion),
      productionOffice: normalizeLocation(dayDetails.productionOffice),
      nearestHospital: normalizeLocation(dayDetails.nearestHospital),
      parking: normalizeLocation(dayDetails.parking),
      basecamp: normalizeLocation(dayDetails.basecamp),
      customLocations,
      notes: normalizeText(dayDetails.notes),
      notesPlacement: notesStyle.placement,
      notesColor: notesStyle.color,
      notesIcon: notesStyle.icon,
      crewCallTime: normalizeText(dayDetails.crewCallTime),
      shootingCallTime: normalizeText(dayDetails.shootingCallTime),
      estimatedWrap: normalizeText(dayDetails.estimatedWrap),
      breakfastTime: normalizeText(dayDetails.breakfastTime),
      firstMealTime: normalizeText(dayDetails.firstMealTime),
      secondMealTime: normalizeText(dayDetails.secondMealTime),
      weatherSummary: normalizeText(dayDetails.weather?.summary),
      lowTemp: dayDetails.weather?.lowTemp != null ? String(dayDetails.weather.lowTemp) : "",
      highTemp: dayDetails.weather?.highTemp != null ? String(dayDetails.weather.highTemp) : "",
      sunrise: normalizeText(dayDetails.weather?.sunrise),
      sunset: normalizeText(dayDetails.weather?.sunset),
    });
    const updatedAtMs = coerceUpdatedAtMs(dayDetails.updatedAt);
    setLastSavedAt(updatedAtMs);
    setLastSavedSnapshot(JSON.stringify(buildComparableUpdatesFromDayDetails(dayDetails)));
  }, [dayDetails]);

  const updates = useMemo(() => {
    const weather =
      draft.weatherSummary ||
      draft.lowTemp ||
      draft.highTemp ||
      draft.sunrise ||
      draft.sunset
        ? {
            summary: toNullableText(draft.weatherSummary),
            lowTemp: draft.lowTemp.trim() ? Number(draft.lowTemp) : null,
            highTemp: draft.highTemp.trim() ? Number(draft.highTemp) : null,
            sunrise: toNullableText(draft.sunrise),
            sunset: toNullableText(draft.sunset),
          }
        : null;

    const notesStyle = buildNotesStyleFromDraft({
      notesPlacement: draft.notesPlacement,
      notesColor: draft.notesColor,
      notesIcon: draft.notesIcon,
    });

    const customLocations = (draft.customLocations || [])
      .map((row) => buildCustomLocationRow(row))
      .filter(Boolean) as Array<DayDetailsCustomLocation>;

    const next: Partial<Omit<DayDetails, "scheduleId">> = {
      keyPeople: toNullableText(draft.keyPeople),
      setMedic: toNullableText(draft.setMedic),
      scriptVersion: toNullableText(draft.scriptVersion),
      scheduleVersion: toNullableText(draft.scheduleVersion),
      productionOffice: buildLocationRef(draft.productionOffice.label, draft.productionOffice.notes),
      nearestHospital: buildLocationRef(draft.nearestHospital.label, draft.nearestHospital.notes),
      parking: buildLocationRef(draft.parking.label, draft.parking.notes),
      basecamp: buildLocationRef(draft.basecamp.label, draft.basecamp.notes),
      customLocations: customLocations.length ? customLocations : null,
      notes: toNullableText(draft.notes),
      notesStyle,
      crewCallTime: String(draft.crewCallTime || ""),
      shootingCallTime: String(draft.shootingCallTime || ""),
      estimatedWrap: String(draft.estimatedWrap || ""),
      breakfastTime: toNullableText(draft.breakfastTime),
      firstMealTime: toNullableText(draft.firstMealTime),
      secondMealTime: toNullableText(draft.secondMealTime),
      weather,
    };

    return next;
  }, [draft]);

  useEffect(() => {
    setLastSavedAt(null);
    setLastSavedSnapshot("");
  }, [scheduleId]);

  const serializedUpdates = useMemo(() => JSON.stringify(updates), [updates]);
  const isDirty = useMemo(
    () => Boolean(lastSavedSnapshot) && serializedUpdates !== lastSavedSnapshot,
    [lastSavedSnapshot, serializedUpdates]
  );

  const handleSave = useCallback(() => {
    if (readOnly) return;
    updateDayDetails.mutate(updates, {
      onSuccess: () => {
        setLastSavedAt(Date.now());
        setLastSavedSnapshot(serializedUpdates);
      },
    } as any);
  }, [readOnly, serializedUpdates, updateDayDetails, updates]);

  const handleReset = useCallback(() => {
    if (!dayDetails) return;
    const notesStyle = normalizeNotesStyle(dayDetails.notesStyle);
    const customLocations = normalizeCustomLocations(dayDetails.customLocations);
    setDraft({
      keyPeople: normalizeText(dayDetails.keyPeople),
      setMedic: normalizeText(dayDetails.setMedic),
      scriptVersion: normalizeText(dayDetails.scriptVersion),
      scheduleVersion: normalizeText(dayDetails.scheduleVersion),
      productionOffice: normalizeLocation(dayDetails.productionOffice),
      nearestHospital: normalizeLocation(dayDetails.nearestHospital),
      parking: normalizeLocation(dayDetails.parking),
      basecamp: normalizeLocation(dayDetails.basecamp),
      customLocations,
      notes: normalizeText(dayDetails.notes),
      notesPlacement: notesStyle.placement,
      notesColor: notesStyle.color,
      notesIcon: notesStyle.icon,
      crewCallTime: normalizeText(dayDetails.crewCallTime),
      shootingCallTime: normalizeText(dayDetails.shootingCallTime),
      estimatedWrap: normalizeText(dayDetails.estimatedWrap),
      breakfastTime: normalizeText(dayDetails.breakfastTime),
      firstMealTime: normalizeText(dayDetails.firstMealTime),
      secondMealTime: normalizeText(dayDetails.secondMealTime),
      weatherSummary: normalizeText(dayDetails.weather?.summary),
      lowTemp: dayDetails.weather?.lowTemp != null ? String(dayDetails.weather.lowTemp) : "",
      highTemp: dayDetails.weather?.highTemp != null ? String(dayDetails.weather.highTemp) : "",
      sunrise: normalizeText(dayDetails.weather?.sunrise),
      sunset: normalizeText(dayDetails.weather?.sunset),
    });
  }, [dayDetails]);

  const applyShiftAll = useCallback(() => {
    const delta = Number(shiftMinutes);
    if (!Number.isFinite(delta) || delta === 0) return;
    setDraft((prev) => ({
      ...prev,
      crewCallTime: shiftTimeString(prev.crewCallTime, delta) ?? prev.crewCallTime,
      shootingCallTime: shiftTimeString(prev.shootingCallTime, delta) ?? prev.shootingCallTime,
      estimatedWrap: shiftTimeString(prev.estimatedWrap, delta) ?? prev.estimatedWrap,
      breakfastTime: shiftTimeString(prev.breakfastTime, delta) ?? prev.breakfastTime,
      firstMealTime: shiftTimeString(prev.firstMealTime, delta) ?? prev.firstMealTime,
      secondMealTime: shiftTimeString(prev.secondMealTime, delta) ?? prev.secondMealTime,
    }));
  }, [shiftMinutes]);

  useEffect(() => {
    if (readOnly) return;
    if (!scheduleId) return;
    if (updateDayDetails.isPending) return;
    if (!(hasRemoteDayDetails || ensureDayDetails.isSuccess)) return;
    if (!isDirty) return;

    const timer = window.setTimeout(() => {
      updateDayDetails.mutate(updates, {
        onSuccess: () => {
          setLastSavedAt(Date.now());
          setLastSavedSnapshot(serializedUpdates);
        },
      } as any);
    }, 900);

    return () => window.clearTimeout(timer);
  }, [
    ensureDayDetails.isSuccess,
    hasRemoteDayDetails,
    isDirty,
    readOnly,
    scheduleId,
    serializedUpdates,
    updateDayDetails,
    updates,
  ]);

  const addCustomLocation = useCallback(() => {
    setDraft((prev) => ({
      ...prev,
      customLocations: [
        ...(prev.customLocations || []),
        { id: randomId(), title: "", locationId: null, label: "", notes: "" },
      ],
    }));
  }, []);

  const removeCustomLocation = useCallback((id: string) => {
    setDraft((prev) => ({
      ...prev,
      customLocations: (prev.customLocations || []).filter((row) => row.id !== id),
    }));
  }, []);

  const updateCustomLocation = useCallback((id: string, updates: Partial<DayDetailsCustomLocation>) => {
    setDraft((prev) => ({
      ...prev,
      customLocations: (prev.customLocations || []).map((row) => (row.id === id ? { ...row, ...updates } : row)),
    }));
  }, []);

  const handleAutoFillWeather = useCallback(() => {
    toast.info({
      title: "Weather auto-fill isn’t wired yet",
      description: "We’ll add this once we have a location → forecast source.",
    });
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
              Day details
            </div>
            <div className="text-xs text-slate-500">Times, locations, notes, and weather.</div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleReset} disabled={readOnly}>
              Reset
            </Button>
            <Button size="sm" onClick={handleSave} disabled={readOnly || updateDayDetails.isPending}>
              {readOnly ? "Read-only" : updateDayDetails.isPending ? "Saving..." : "Save now"}
            </Button>
          </div>
        </div>

        <div className="mt-2 text-xs text-slate-500">
          {readOnly
            ? "Read-only"
            : updateDayDetails.isPending
            ? "Saving…"
            : isDirty
            ? "Unsaved changes"
            : lastSavedAt
            ? `Saved ${new Date(lastSavedAt).toLocaleTimeString()}`
            : null}
        </div>

        <div className="mt-3 flex items-center gap-1 border-b border-slate-200 dark:border-slate-700">
          <TabButton active={tab === "people"} onClick={() => setTab("people")}>
            Key People & More
          </TabButton>
          <TabButton active={tab === "locations"} onClick={() => setTab("locations")}>
            Location & Notes
          </TabButton>
          <TabButton active={tab === "times"} onClick={() => setTab("times")}>
            Times & Weather
          </TabButton>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {tab === "people" ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="text-xs font-medium text-slate-500">Key people</span>
              <textarea
                value={draft.keyPeople}
                onChange={(e) => setDraft((prev) => ({ ...prev, keyPeople: e.target.value }))}
                className="min-h-[120px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                placeholder={"Producer: …\nDirector: …\nDP: …"}
                disabled={readOnly}
              />
            </label>

            <div className="grid gap-3">
              <label className="grid gap-1 text-sm">
                <span className="text-xs font-medium text-slate-500">Set medic</span>
                <Input
                  value={draft.setMedic}
                  onChange={(e) => setDraft((prev) => ({ ...prev, setMedic: e.target.value }))}
                  placeholder="Name / contact"
                  disabled={readOnly}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-xs font-medium text-slate-500">Script version</span>
                <Input
                  value={draft.scriptVersion}
                  onChange={(e) => setDraft((prev) => ({ ...prev, scriptVersion: e.target.value }))}
                  placeholder="e.g. v12"
                  disabled={readOnly}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-xs font-medium text-slate-500">Schedule version</span>
                <Input
                  value={draft.scheduleVersion}
                  onChange={(e) => setDraft((prev) => ({ ...prev, scheduleVersion: e.target.value }))}
                  placeholder="e.g. rev C"
                  disabled={readOnly}
                />
              </label>
            </div>
          </div>
        ) : null}

        {tab === "locations" ? (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              {(
                [
                  ["productionOffice", "Production office"],
                  ["basecamp", "Basecamp"],
                  ["parking", "Parking"],
                  ["nearestHospital", "Nearest hospital"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{label}</div>
                  <div className="mt-3 grid gap-3">
                    <label className="grid gap-1 text-sm">
                      <span className="text-xs font-medium text-slate-500">Label</span>
                      <Input
                        value={(draft as any)[key].label}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            [key]: { ...(prev as any)[key], label: e.target.value },
                          }))
                        }
                        placeholder="Address / name"
                        disabled={readOnly}
                      />
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className="text-xs font-medium text-slate-500">Notes</span>
                      <Input
                        value={(draft as any)[key].notes}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            [key]: { ...(prev as any)[key], notes: e.target.value },
                          }))
                        }
                        placeholder="Optional notes"
                        disabled={readOnly}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">Additional locations</div>
                  <div className="text-xs text-slate-500">Add extra location cards for this day.</div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={addCustomLocation}
                  disabled={readOnly}
                >
                  <Plus className="h-4 w-4" />
                  Add New Row
                </Button>
              </div>

              {draft.customLocations?.length ? (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {draft.customLocations.map((row) => (
                    <div
                      key={row.id}
                      className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {row.title?.trim() ? row.title : "Custom location"}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => removeCustomLocation(row.id)}
                          disabled={readOnly}
                          aria-label="Remove location row"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="mt-3 grid gap-3">
                        <label className="grid gap-1 text-sm">
                          <span className="text-xs font-medium text-slate-500">Title</span>
                          <Input
                            value={row.title || ""}
                            onChange={(e) => updateCustomLocation(row.id, { title: e.target.value })}
                            placeholder="e.g. Production office"
                            disabled={readOnly}
                          />
                        </label>
                        <label className="grid gap-1 text-sm">
                          <span className="text-xs font-medium text-slate-500">Label</span>
                          <Input
                            value={row.label || ""}
                            onChange={(e) => updateCustomLocation(row.id, { label: e.target.value })}
                            placeholder="Address / name"
                            disabled={readOnly}
                          />
                        </label>
                        <label className="grid gap-1 text-sm">
                          <span className="text-xs font-medium text-slate-500">Notes</span>
                          <Input
                            value={row.notes || ""}
                            onChange={(e) => updateCustomLocation(row.id, { notes: e.target.value })}
                            placeholder="Optional notes"
                            disabled={readOnly}
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 text-xs text-slate-500">No custom locations.</div>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">Main notes</div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <label className="grid gap-1 text-sm">
                    <span className="text-[11px] font-medium text-slate-500">Placement</span>
                    <select
                      className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                      value={draft.notesPlacement}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, notesPlacement: e.target.value === "top" ? "top" : "bottom" }))
                      }
                      disabled={readOnly}
                    >
                      <option value="bottom">Bottom</option>
                      <option value="top">Top</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="text-[11px] font-medium text-slate-500">Icon</span>
                    <select
                      className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                      value={draft.notesIcon}
                      onChange={(e) => setDraft((prev) => ({ ...prev, notesIcon: e.target.value }))}
                      disabled={readOnly}
                    >
                      <option value="">None</option>
                      <option value="note">Note</option>
                      <option value="info">Info</option>
                      <option value="alert">Alert</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="text-[11px] font-medium text-slate-500">Color</span>
                    <Input
                      type="color"
                      value={draft.notesColor || "#FFFFFF"}
                      onChange={(e) => setDraft((prev) => ({ ...prev, notesColor: e.target.value }))}
                      className="h-9 w-16 p-1"
                      disabled={readOnly}
                    />
                  </label>
                </div>
              </div>
              <div className="mt-3">
                <RichTextEditor
                  value={draft.notes}
                  onChange={(value: string) => setDraft((prev) => ({ ...prev, notes: value }))}
                  disabled={readOnly}
                  minHeight="180px"
                  maxHeight="420px"
                />
              </div>
            </div>
          </div>
        ) : null}

        {tab === "times" ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="grid gap-1 text-sm">
                <span className="text-xs font-medium text-slate-500">Crew call</span>
                <Input
                  value={draft.crewCallTime}
                  onChange={(e) => setDraft((prev) => ({ ...prev, crewCallTime: e.target.value }))}
                  placeholder="06:00"
                  disabled={readOnly}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-xs font-medium text-slate-500">Shooting call</span>
                <Input
                  value={draft.shootingCallTime}
                  onChange={(e) => setDraft((prev) => ({ ...prev, shootingCallTime: e.target.value }))}
                  placeholder="07:00"
                  disabled={readOnly}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-xs font-medium text-slate-500">Est. wrap</span>
                <Input
                  value={draft.estimatedWrap}
                  onChange={(e) => setDraft((prev) => ({ ...prev, estimatedWrap: e.target.value }))}
                  placeholder="18:00"
                  disabled={readOnly}
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <label className="grid gap-1 text-sm">
                <span className="text-xs font-medium text-slate-500">Breakfast</span>
                <Input
                  value={draft.breakfastTime}
                  onChange={(e) => setDraft((prev) => ({ ...prev, breakfastTime: e.target.value }))}
                  placeholder="08:00"
                  disabled={readOnly}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-xs font-medium text-slate-500">1st meal</span>
                <Input
                  value={draft.firstMealTime}
                  onChange={(e) => setDraft((prev) => ({ ...prev, firstMealTime: e.target.value }))}
                  placeholder="13:00"
                  disabled={readOnly}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-xs font-medium text-slate-500">2nd meal</span>
                <Input
                  value={draft.secondMealTime}
                  onChange={(e) => setDraft((prev) => ({ ...prev, secondMealTime: e.target.value }))}
                  placeholder="—"
                  disabled={readOnly}
                />
              </label>
            </div>

            <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">Shift all times</div>
                <div className="text-xs text-slate-500">Adjust call/meal times by a fixed offset.</div>
              </div>
              <div className="flex items-center gap-2">
                <label className="grid gap-1 text-sm">
                  <span className="text-[11px] font-medium text-slate-500">Minutes</span>
                  <Input
                    type="number"
                    value={shiftMinutes}
                    onChange={(e) => setShiftMinutes(Number(e.target.value || 0))}
                    className="w-28"
                    disabled={readOnly}
                  />
                </label>
                <Button type="button" variant="outline" onClick={applyShiftAll} disabled={readOnly}>
                  Shift
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">Weather</div>
                  <div className="text-xs text-slate-500">Auto-fill will be added later; manual entry for now.</div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleAutoFillWeather}
                  disabled={readOnly}
                  title="Auto-fill (coming soon)"
                >
                  <Wand2 className="h-4 w-4" />
                  Auto-fill
                </Button>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-sm md:col-span-2">
                  <span className="text-xs font-medium text-slate-500">Summary</span>
                  <Input
                    value={draft.weatherSummary}
                    onChange={(e) => setDraft((prev) => ({ ...prev, weatherSummary: e.target.value }))}
                    placeholder="Sunny / Overcast / Rain…"
                    disabled={readOnly}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-xs font-medium text-slate-500">Low temp</span>
                  <Input
                    value={draft.lowTemp}
                    onChange={(e) => setDraft((prev) => ({ ...prev, lowTemp: e.target.value }))}
                    placeholder="e.g. 55"
                    disabled={readOnly}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-xs font-medium text-slate-500">High temp</span>
                  <Input
                    value={draft.highTemp}
                    onChange={(e) => setDraft((prev) => ({ ...prev, highTemp: e.target.value }))}
                    placeholder="e.g. 72"
                    disabled={readOnly}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-xs font-medium text-slate-500">Sunrise</span>
                  <Input
                    value={draft.sunrise}
                    onChange={(e) => setDraft((prev) => ({ ...prev, sunrise: e.target.value }))}
                    placeholder="06:45"
                    disabled={readOnly}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-xs font-medium text-slate-500">Sunset</span>
                  <Input
                    value={draft.sunset}
                    onChange={(e) => setDraft((prev) => ({ ...prev, sunset: e.target.value }))}
                    placeholder="16:55"
                    disabled={readOnly}
                  />
                </label>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
