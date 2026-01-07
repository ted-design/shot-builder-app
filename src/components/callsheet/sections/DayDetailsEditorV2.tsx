import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader } from "../../ui/card";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { TimePicker } from "../../ui/TimePicker";
import RichTextEditor from "../../shots/RichTextEditor";
import { useDayDetails } from "../../../hooks/useDayDetails";
import { useLocations } from "../../../hooks/useFirestoreQuery";
import { useAuth } from "../../../context/AuthContext";
import { canManageLocations, resolveEffectiveRole } from "../../../lib/rbac";
import { db, uploadImageFile } from "../../../lib/firebase";
import { writeDoc } from "../../../lib/firestoreWrites";
import { describeFirebaseError } from "../../../lib/firebaseErrors";
import LocationCreateModal from "../../locations/LocationCreateModal";
import ProjectLocationSelect from "../../locations/ProjectLocationSelect";
import { shiftTimeString } from "../../../lib/callsheet/shiftTimes";
import { toast } from "../../../lib/toast";
import { Loader2, Plus, Trash2, Wand2 } from "lucide-react";
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { DEFAULT_LOCATION_TYPES } from "../../../constants/defaultLocationTypes";
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
    locationId: ref?.locationId ? String(ref.locationId) : "",
    label: ref?.label ? String(ref.label) : "",
    notes: ref?.notes ? String(ref.notes) : "",
  };
}

function buildLocationRef(locationId: string, label: string, notes: string): LocationReference | null {
  const locationIdTrimmed = String(locationId || "").trim();
  const trimmed = String(label || "").trim();
  const notesTrimmed = String(notes || "").trim();
  if (!locationIdTrimmed && !trimmed && !notesTrimmed) return null;
  return {
    locationId: locationIdTrimmed || null,
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

type DayDetailsDraft = {
  keyPeople: string;
  setMedic: string;
  scriptVersion: string;
  scheduleVersion: string;
  productionOffice: { locationId: string; label: string; notes: string };
  nearestHospital: { locationId: string; label: string; notes: string };
  parking: { locationId: string; label: string; notes: string };
  basecamp: { locationId: string; label: string; notes: string };
  customLocations: Array<DayDetailsCustomLocation>;
  notes: string;
  notesPlacement: "top" | "bottom";
  notesColor: string;
  notesIcon: string;
  crewCallTime: string;
  shootingCallTime: string;
  estimatedWrap: string;
  breakfastTime: string;
  firstMealTime: string;
  secondMealTime: string;
  weatherSummary: string;
  lowTemp: string;
  highTemp: string;
  sunrise: string;
  sunset: string;
};

function buildUpdatesFromDraft(draft: DayDetailsDraft): Partial<Omit<DayDetails, "scheduleId">> {
  const weather =
    draft.weatherSummary || draft.lowTemp || draft.highTemp || draft.sunrise || draft.sunset
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
    productionOffice: buildLocationRef(draft.productionOffice.locationId, draft.productionOffice.label, draft.productionOffice.notes),
    nearestHospital: buildLocationRef(draft.nearestHospital.locationId, draft.nearestHospital.label, draft.nearestHospital.notes),
    parking: buildLocationRef(draft.parking.locationId, draft.parking.label, draft.parking.notes),
    basecamp: buildLocationRef(draft.basecamp.locationId, draft.basecamp.label, draft.basecamp.notes),
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
  const [baselineSnapshot, setBaselineSnapshot] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const autoSaveTimerRef = useRef<number | null>(null);

  const { user, role: globalRole, projectRoles } = useAuth();
  const effectiveRole = useMemo(
    () => resolveEffectiveRole(globalRole, projectRoles, projectId),
    [globalRole, projectId, projectRoles]
  );
  const canCreateLocations = useMemo(() => canManageLocations(effectiveRole), [effectiveRole]);

  const { data: projectLocationsRaw = [] } = useLocations(clientId, {
    enabled: Boolean(clientId && projectId),
    projectId,
    scope: "project",
  } as any);

  const projectLocations = useMemo(() => {
    return [...(projectLocationsRaw || [])].sort((a: any, b: any) => String(a?.name || "").localeCompare(String(b?.name || "")));
  }, [projectLocationsRaw]);

  const projectLocationsById = useMemo(() => {
    return new Map<string, any>((projectLocations || []).map((loc: any) => [String(loc.id), loc]));
  }, [projectLocations]);

  const formatProjectLocationAddress = useCallback((loc: any) => {
    const explicit = String(loc?.address || "").trim();
    if (explicit) return explicit;
    const line1 = [loc?.street, loc?.unit].filter(Boolean).join(" ").trim();
    const line2 = [loc?.city, loc?.province].filter(Boolean).join(", ").trim();
    const parts = [line1, line2, loc?.postal].map((value) => String(value || "").trim()).filter(Boolean);
    return parts.join(" · ");
  }, []);

  type FixedLocationKey = "productionOffice" | "nearestHospital" | "parking" | "basecamp";

  type LocationCreateTarget = { kind: "fixed"; key: FixedLocationKey } | { kind: "custom"; id: string };

  const defaultLocationFieldByTypeId = useMemo<Record<string, FixedLocationKey>>(
    () => ({
      "production-office": "productionOffice",
      "nearest-hospital": "nearestHospital",
      basecamp: "basecamp",
      parking: "parking",
    }),
    []
  );

  const [createLocationOpen, setCreateLocationOpen] = useState(false);
  const [createLocationBusy, setCreateLocationBusy] = useState(false);
  const [createLocationTarget, setCreateLocationTarget] = useState<LocationCreateTarget | null>(null);

  const [draft, setDraft] = useState<DayDetailsDraft>(() => ({
    keyPeople: "",
    setMedic: "",
    scriptVersion: "",
    scheduleVersion: "",
    productionOffice: { locationId: "", label: "", notes: "" },
    nearestHospital: { locationId: "", label: "", notes: "" },
    parking: { locationId: "", label: "", notes: "" },
    basecamp: { locationId: "", label: "", notes: "" },
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

  const updates = useMemo(() => buildUpdatesFromDraft(draft), [draft]);

  const serializedUpdates = useMemo(() => JSON.stringify(updates), [updates]);
  const isDirty = useMemo(() => Boolean(baselineSnapshot) && serializedUpdates !== baselineSnapshot, [
    baselineSnapshot,
    serializedUpdates,
  ]);

  useEffect(() => {
    if (!dayDetails) return;
    const notesStyle = normalizeNotesStyle(dayDetails.notesStyle);
    const customLocations = normalizeCustomLocations(dayDetails.customLocations);
    const nextDraft: DayDetailsDraft = {
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
    };
    const nextSnapshot = JSON.stringify(buildUpdatesFromDraft(nextDraft));

    if (!baselineSnapshot) {
      setDraft(nextDraft);
      setBaselineSnapshot(nextSnapshot);
      return;
    }

    if (!isDirty && !updateDayDetails.isPending && nextSnapshot !== baselineSnapshot) {
      setDraft(nextDraft);
      setBaselineSnapshot(nextSnapshot);
    }
  }, [baselineSnapshot, dayDetails, isDirty, updateDayDetails.isPending]);

  useEffect(() => {
    setBaselineSnapshot(null);
    setJustSaved(false);
    setSaveError(null);
  }, [scheduleId]);

  useEffect(() => {
    if (!justSaved) return;
    const timer = window.setTimeout(() => setJustSaved(false), 2000);
    return () => window.clearTimeout(timer);
  }, [justSaved]);

  const triggerSave = useCallback((values: Partial<Omit<DayDetails, "scheduleId">>, snapshot: string) => {
    if (readOnly) return;
    setSaveError(null);
    updateDayDetails.mutate(values, {
      onSuccess: () => {
        setBaselineSnapshot(snapshot);
        setJustSaved(true);
      },
      onError: (error: any) => {
        const message = error?.message ? String(error.message) : "Save failed.";
        setSaveError(message);
      },
    } as any);
  }, [readOnly, updateDayDetails]);

  const handleSave = useCallback(() => {
    triggerSave(updates, serializedUpdates);
  }, [serializedUpdates, triggerSave, updates]);

  useEffect(() => {
    if (readOnly) return;
    if (!baselineSnapshot) return;
    if (!isDirty) return;
    if (updateDayDetails.isPending) return;

    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = window.setTimeout(() => {
      triggerSave(updates, serializedUpdates);
      autoSaveTimerRef.current = null;
    }, 1000);

    return () => {
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [baselineSnapshot, isDirty, readOnly, serializedUpdates, triggerSave, updateDayDetails.isPending, updates]);

  const handleCreateProjectLocation = useCallback(
    async ({ name, street, unit, city, province, postal, phone, notes, photoFile }: any) => {
      if (!clientId) throw new Error("Missing client.");
      if (!projectId) throw new Error("Missing project.");
      if (!user) throw new Error("You must be signed in to add locations.");
      if (!canCreateLocations) throw new Error("You do not have permission to add locations.");

      const trimmedName = String(name || "").trim();
      if (!trimmedName) throw new Error("Enter a location name.");

      setCreateLocationBusy(true);
      try {
        const payload = {
          name: trimmedName,
          street: String(street || "").trim(),
          unit: String(unit || "").trim(),
          city: String(city || "").trim(),
          province: String(province || "").trim(),
          postal: String(postal || "").trim(),
          phone: String(phone || "").trim(),
          notes: String(notes || "").trim(),
          shotIds: [],
          projectIds: [projectId],
          photoPath: null,
          createdAt: serverTimestamp(),
          createdBy: user?.uid || null,
        };

        const docRef = await writeDoc("create location", () =>
          addDoc(collection(db, "clients", clientId, "locations"), payload)
        );

        if (photoFile) {
          const { path } = await uploadImageFile(photoFile, { folder: "locations", id: docRef.id });
          await updateDoc(doc(db, "clients", clientId, "locations", docRef.id), { photoPath: path });
        }

        const address = formatProjectLocationAddress(payload as any);

        if (createLocationTarget?.kind === "fixed") {
          const key = createLocationTarget.key;
          setDraft((prev) => ({
            ...prev,
            [key]: {
              ...prev[key],
              locationId: docRef.id,
              label: prev[key].label.trim() ? prev[key].label : payload.name,
              notes: prev[key].notes.trim() ? prev[key].notes : address,
            },
          }));
        } else if (createLocationTarget?.kind === "custom") {
          const rowId = createLocationTarget.id;
          setDraft((prev) => ({
            ...prev,
            customLocations: (prev.customLocations || []).map((row) =>
              row.id !== rowId
                ? row
                : {
                    ...row,
                    locationId: docRef.id,
                    label: String(row.label || "").trim() ? row.label : payload.name,
                    notes: String(row.notes || "").trim() ? row.notes : address,
                  }
            ),
          }));
        }

        toast.success({ title: `${payload.name} added to project locations` });
      } catch (error: any) {
        const { code, message } = describeFirebaseError(error, "Unable to create location.");
        toast.error({ title: "Unable to create location", description: `${code}: ${message}` });
        throw new Error(`${code}: ${message}`);
      } finally {
        setCreateLocationBusy(false);
      }
    },
    [canCreateLocations, clientId, createLocationTarget, formatProjectLocationAddress, projectId, user]
  );

  const openCreateLocation = useCallback((target: LocationCreateTarget) => {
    setCreateLocationTarget(target);
    setCreateLocationOpen(true);
  }, []);

  const handleFixedLocationChange = useCallback(
    (key: FixedLocationKey, nextId: string) => {
      setDraft((prev) => {
        const current = (prev as any)[key] || { locationId: "", label: "", notes: "" };
        const nextLocationId = String(nextId || "");
        if (!nextLocationId) {
          return {
            ...prev,
            [key]: { ...current, locationId: "" },
          } as any;
        }

        const loc = projectLocationsById.get(nextLocationId);
        const name = String(loc?.name || "").trim();
        const address = loc ? formatProjectLocationAddress(loc) : "";

        return {
          ...prev,
          [key]: {
            ...current,
            locationId: nextLocationId,
            label: String(current.label || "").trim() ? current.label : name,
            notes: String(current.notes || "").trim() ? current.notes : address,
          },
        } as any;
      });
    },
    [formatProjectLocationAddress, projectLocationsById]
  );

  const handleCustomLocationLibraryChange = useCallback(
    (rowId: string, nextId: string) => {
      const nextLocationId = String(nextId || "");
      setDraft((prev) => ({
        ...prev,
        customLocations: (prev.customLocations || []).map((row) => {
          if (row.id !== rowId) return row;
          if (!nextLocationId) return { ...row, locationId: null };
          const loc = projectLocationsById.get(nextLocationId);
          const name = String(loc?.name || "").trim();
          const address = loc ? formatProjectLocationAddress(loc) : "";
          return {
            ...row,
            locationId: nextLocationId,
            label: String(row.label || "").trim() ? row.label : name,
            notes: String(row.notes || "").trim() ? row.notes : address,
          };
        }),
      }));
    },
    [formatProjectLocationAddress, projectLocationsById]
  );

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
          <div className="flex items-center gap-3">
            {!readOnly && updateDayDetails.isPending ? (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving…
              </span>
            ) : null}
            {!readOnly && !updateDayDetails.isPending && justSaved ? (
              <span className="text-xs font-medium text-emerald-600">✓ Saved</span>
            ) : null}
            {!readOnly && !updateDayDetails.isPending && !justSaved && saveError ? (
              <span className="text-xs font-medium text-red-600">Save failed</span>
            ) : null}
            <Button variant="outline" size="sm" onClick={handleReset} disabled={readOnly}>
              Reset
            </Button>
            {!readOnly && isDirty && !updateDayDetails.isPending ? (
              <Button size="sm" variant="ghost" onClick={handleSave}>
                Save
              </Button>
            ) : null}
          </div>
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
              {DEFAULT_LOCATION_TYPES.map((type) => {
                const key = defaultLocationFieldByTypeId[type.id];
                if (!key) return null;
                return (
                  <div
                    key={type.id}
                    className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{type.name}</div>
                  <div className="mt-3 grid gap-3">
                    <label className="grid gap-1 text-sm">
                      <span className="text-xs font-medium text-slate-500">From library</span>
                      <ProjectLocationSelect
                        locations={projectLocations}
                        value={(draft as any)[key].locationId || ""}
                        onChange={(value) => handleFixedLocationChange(key, value)}
                        onCreateNew={
                          readOnly || !canCreateLocations ? undefined : () => openCreateLocation({ kind: "fixed", key })
                        }
                        placeholder="Select location"
                        isDisabled={readOnly}
                      />
                    </label>
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
                );
              })}
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
                          <span className="text-xs font-medium text-slate-500">From library</span>
                          <ProjectLocationSelect
                            locations={projectLocations}
                            value={row.locationId ? String(row.locationId) : ""}
                            onChange={(value) => handleCustomLocationLibraryChange(row.id, value)}
                            onCreateNew={
                              readOnly || !canCreateLocations
                                ? undefined
                                : () => openCreateLocation({ kind: "custom", id: row.id })
                            }
                            placeholder="Select location"
                            isDisabled={readOnly}
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
              <TimePicker
                label="Crew Call"
                value={draft.crewCallTime.trim() ? draft.crewCallTime : null}
                onChange={(value) => setDraft((prev) => ({ ...prev, crewCallTime: value || "" }))}
                disabled={readOnly}
              />
              <TimePicker
                label="Shooting Call"
                value={draft.shootingCallTime.trim() ? draft.shootingCallTime : null}
                onChange={(value) => setDraft((prev) => ({ ...prev, shootingCallTime: value || "" }))}
                disabled={readOnly}
              />
              <TimePicker
                label="Est. Wrap"
                value={draft.estimatedWrap.trim() ? draft.estimatedWrap : null}
                onChange={(value) => setDraft((prev) => ({ ...prev, estimatedWrap: value || "" }))}
                disabled={readOnly}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <TimePicker
                label="Breakfast"
                value={draft.breakfastTime.trim() ? draft.breakfastTime : null}
                onChange={(value) => setDraft((prev) => ({ ...prev, breakfastTime: value || "" }))}
                disabled={readOnly}
              />
              <TimePicker
                label="1st Meal"
                value={draft.firstMealTime.trim() ? draft.firstMealTime : null}
                onChange={(value) => setDraft((prev) => ({ ...prev, firstMealTime: value || "" }))}
                disabled={readOnly}
              />
              <TimePicker
                label="2nd Meal"
                value={draft.secondMealTime.trim() ? draft.secondMealTime : null}
                onChange={(value) => setDraft((prev) => ({ ...prev, secondMealTime: value || "" }))}
                disabled={readOnly}
              />
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

      {canCreateLocations ? (
        <LocationCreateModal
          open={createLocationOpen}
          busy={createLocationBusy}
          onClose={() => {
            if (createLocationBusy) return;
            setCreateLocationOpen(false);
            setCreateLocationTarget(null);
          }}
          onCreate={handleCreateProjectLocation}
        />
      ) : null}
    </Card>
  );
}
