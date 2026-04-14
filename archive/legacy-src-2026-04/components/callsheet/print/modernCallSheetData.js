import { deriveLocationsFromLegacy, locationBlockHasContent } from "../../../lib/callsheet/deriveLocationsFromLegacy";
import { buildScheduleProjection } from "../../../lib/callsheet/buildScheduleProjection";
import { computeEffectiveCrewCallDisplay, timeStringToMinutes } from "../../../lib/time/crewCallEffective";

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") {
    try {
      return value.toDate();
    } catch {
      return null;
    }
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateLong(value) {
  const date = toDate(value);
  if (!date) return "";
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export function formatTime12h(value) {
  if (!value || typeof value !== "string") return "";
  const [hRaw, mRaw] = value.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return value;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
}

export function getModernColors(callSheetConfig) {
  const raw = callSheetConfig?.colors && typeof callSheetConfig.colors === "object" ? callSheetConfig.colors : {};
  return {
    primary: raw.primary || "#1a365d",
    primaryText: raw.primaryText || "#ffffff",
    accent: raw.accent || "#fc5b54",
    rowAlternate: raw.rowAlternate || "#e8f4f8",
  };
}

export function buildModernCallSheetData({
  schedule,
  dayDetails,
  entries,
  crewRows,
  talentRows,
  sections,
  projectTitle,
  tracks,
}) {
  const projection = buildScheduleProjection({
    entries: entries || [],
    tracks: tracks || [],
    options: {
      mode: "time",
      fallbackStartMin: 420,
      defaultDurationMin: 15,
      formatTime12h: formatTime12h,
      context: "CallSheetModernData",
    },
  });

  const scheduleRows = projection.tableRows;

  const derivedLocations = deriveLocationsFromLegacy(dayDetails);
  const locations = derivedLocations
    .filter((block) => locationBlockHasContent(block))
    .map((block) => ({
      type: block.title || "Location",
      name: block.ref?.label ? String(block.ref.label) : "",
      address: block.ref?.notes ? String(block.ref.notes) : "",
    }));

  const talent = (talentRows || []).map((row) => ({
    id: String(row?.talentId || row?.id || row?.name || Math.random()),
    name: row?.name ? String(row.name) : "—",
    role: row?.role ? String(row.role) : "",
    callTime: row?.callTime ? String(row.callTime) : row?.callText ? String(row.callText) : "",
    status: row?.status ? String(row.status) : "",
    notes: row?.remarks ? String(row.remarks) : "",
  }));

  const crew = (crewRows || []).map((row) => {
    const callText = row?.callText ? String(row.callText).trim() : null;
    const callTime = row?.callTime ? String(row.callTime).trim() : null;
    const defaultCall = row?.defaultCall ? String(row.defaultCall).trim() : null;
    const offsetDirection = row?.callOffsetDirection || null;
    const offsetMinutes = row?.callOffsetMinutes || null;

    const effectiveResult = computeEffectiveCrewCallDisplay({
      baseMinutes: timeStringToMinutes(defaultCall),
      absoluteCallMinutes: timeStringToMinutes(callTime),
      callText,
      offsetDirection,
      offsetMinutes,
    });

    return {
      id: String(row?.crewMemberId || row?.id || row?.name || Math.random()),
      department: row?.department ? String(row.department) : "",
      role: row?.role ? String(row.role) : "",
      name: row?.name ? String(row.name) : "—",
      callTime: effectiveResult.display,
      isPrevDay: effectiveResult.isPrevDay,
      notes: row?.notes ? String(row.notes) : "",
      phone: row?.phone || null,
      email: row?.email || null,
    };
  });

  const scheduleDate = formatDateLong(schedule?.date);

  const trackList = Array.isArray(tracks)
    ? tracks.map((t) => ({ id: t.id, name: t.name }))
    : [];

  return {
    projectName: schedule?.name || "Call Sheet",
    projectTitle: projectTitle || undefined,
    version: dayDetails?.scheduleVersion ? `Schedule v${dayDetails.scheduleVersion}` : dayDetails?.scriptVersion ? `Script v${dayDetails.scriptVersion}` : "",
    groupName: "Call Sheet",
    shootDay: schedule?.name || "Shoot Day",
    date: scheduleDate || "",
    dayNumber: 1,
    totalDays: 1,
    crewCallTime: dayDetails?.crewCallTime ? String(dayDetails.crewCallTime) : null,
    dayDetails: {
      crewCallTime: dayDetails?.crewCallTime ?? null,
      shootingCallTime: dayDetails?.shootingCallTime ?? null,
      breakfastTime: dayDetails?.breakfastTime ?? null,
      firstMealTime: dayDetails?.firstMealTime ?? null,
      secondMealTime: dayDetails?.secondMealTime ?? null,
      estimatedWrap: dayDetails?.estimatedWrap ?? null,
      keyPeople: dayDetails?.keyPeople ?? null,
      setMedic: dayDetails?.setMedic ?? null,
      scriptVersion: dayDetails?.scriptVersion ?? null,
      scheduleVersion: dayDetails?.scheduleVersion ?? null,
      weather: dayDetails?.weather ?? null,
      notes: dayDetails?.notes ?? null,
    },
    locations,
    notes: dayDetails?.notes ? String(dayDetails.notes) : "",
    schedule: scheduleRows,
    talent,
    crew,
    tracks: trackList,
  };
}

