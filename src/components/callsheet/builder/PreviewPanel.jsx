import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Maximize2,
  Minimize2,
  ExternalLink,
  Smartphone,
  Palette,
} from "lucide-react";
import { Button } from "../../ui/button";
import { Checkbox } from "../../ui/input";
import { Modal } from "../../ui/modal";
import { toast } from "../../../lib/toast";
import CallSheetPreviewLegacy from "../vertical/CallSheetPreview";
import { CallSheetPreview as CallSheetPreviewModern } from "../../schedule/preview/CallSheetPreview";
import { ColorCustomizer } from "../../schedule/ColorCustomizer";
import { deriveLocationsFromLegacy, locationBlockHasContent } from "../../../lib/callsheet/deriveLocationsFromLegacy";

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

function formatTime12h(value) {
  if (!value || typeof value !== "string") return "";
  const [hRaw, mRaw] = value.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return value;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
}

function getModernColors(callSheetConfig) {
  const raw = callSheetConfig?.colors && typeof callSheetConfig.colors === "object" ? callSheetConfig.colors : {};
  return {
    primary: raw.primary || "#1a365d",
    primaryText: raw.primaryText || "#ffffff",
    accent: raw.accent || "#fc5b54",
    rowAlternate: raw.rowAlternate || "#e8f4f8",
  };
}

/**
 * DEV-ONLY: Expand crew to include multiple department blocks for column layout testing.
 * Enable via URL param: ?mockCrew=1
 * Creates 4-6 distinct departments with 2-4 crew members each.
 */
function expandCrewForDensityTest(crewArray) {
  // Only in DEV mode
  if (!import.meta.env.DEV) return crewArray;

  // Check for ?mockCrew=1 query param
  if (typeof window === "undefined") return crewArray;
  const params = new URLSearchParams(window.location.search);
  if (params.get("mockCrew") !== "1") return crewArray;

  if (crewArray.length === 0) return crewArray;

  // Mock department definitions with roles
  const mockDepartments = [
    {
      name: "CAMERA",
      roles: [
        { role: "Director of Photography", name: "Alex Chen" },
        { role: "1st AC", name: "Jordan Williams" },
        { role: "2nd AC", name: "Taylor Brooks" },
      ],
    },
    {
      name: "GRIP & ELECTRIC",
      roles: [
        { role: "Gaffer", name: "Sam Martinez" },
        { role: "Key Grip", name: "Casey Johnson" },
        { role: "Best Boy Electric", name: "Morgan Lee" },
        { role: "Grip", name: "Riley Cooper" },
      ],
    },
    {
      name: "WARDROBE",
      roles: [
        { role: "Costume Designer", name: "Jamie Taylor" },
        { role: "Wardrobe Assistant", name: "Drew Wilson" },
      ],
    },
    {
      name: "HAIR & MAKEUP",
      roles: [
        { role: "Key Hair", name: "Avery Jones" },
        { role: "Key Makeup", name: "Quinn Davis" },
        { role: "Hair/Makeup Assistant", name: "Blake Miller" },
      ],
    },
    {
      name: "ART DEPARTMENT",
      roles: [
        { role: "Production Designer", name: "Charlie Brown" },
        { role: "Art Director", name: "Skyler Anderson" },
        { role: "Set Dresser", name: "Reese Thomas" },
      ],
    },
    {
      name: "SOUND",
      roles: [
        { role: "Sound Mixer", name: "Emery White" },
        { role: "Boom Operator", name: "Finley Garcia" },
      ],
    },
  ];

  // Get base call time from first crew member or use default
  const baseCallTime = crewArray[0]?.callTime || "07:00";

  // Build expanded crew array with multiple departments
  const expanded = [];
  let idCounter = 1;

  // Keep original crew (first department)
  for (const row of crewArray) {
    expanded.push(row);
  }

  // Get existing department names to avoid duplicates
  const existingDepts = new Set(crewArray.map((r) => r.department?.toUpperCase()).filter(Boolean));

  // Add mock departments (skip any that match existing)
  for (const dept of mockDepartments) {
    if (existingDepts.has(dept.name)) continue;
    // Stop if we have 5+ total departments
    const currentDeptCount = new Set(expanded.map((r) => r.department?.toUpperCase()).filter(Boolean)).size;
    if (currentDeptCount >= 5) break;

    for (const member of dept.roles) {
      expanded.push({
        id: `mock-${idCounter++}`,
        department: dept.name,
        role: member.role,
        name: member.name,
        callTime: offsetCallTime(baseCallTime, (idCounter % 4) * 15), // Vary by 0-45 min
        notes: "",
        phone: `555-${String(1000 + idCounter).slice(-4)}`,
        email: `${member.name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
      });
    }
  }

  return expanded;
}

/**
 * Offset a HH:MM time string by minutes (for mock data variation).
 */
function offsetCallTime(timeStr, minutesOffset) {
  if (!timeStr || typeof timeStr !== "string") return timeStr;
  const [hRaw, mRaw] = timeStr.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return timeStr;

  const totalMinutes = h * 60 + m + minutesOffset;
  const newH = Math.floor(totalMinutes / 60) % 24;
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

function buildModernCallSheetData({
  schedule,
  dayDetails,
  entries,
  crewRows,
  talentRows,
  sections,
  projectTitle,
  tracks,
}) {
  const scheduleRows = (entries || []).map((entry) => {
    const isBanner =
      entry?.type === "custom" &&
      (entry?.trackId === "shared" || (Array.isArray(entry?.appliesToTrackIds) && entry.appliesToTrackIds.length > 0));
    const titleParts = [];
    if (entry?.shotNumber) titleParts.push(entry.shotNumber);
    if (entry?.resolvedTitle) titleParts.push(entry.resolvedTitle);
    const description = titleParts.length > 0 ? titleParts.join(" — ") : entry?.resolvedTitle || "—";
    const cast = Array.isArray(entry?.resolvedTalent) ? entry.resolvedTalent.filter(Boolean).join(", ") : "";
    const notes = entry?.resolvedNotes || entry?.description || "";
    const locationName = entry?.resolvedLocation || "";

    // Canonical values for conflict detection (matches editor syncIntervalEngine)
    const startTimeCanonical = entry?.startTime || null; // Already HH:MM in source
    const durationMinutes = typeof entry?.duration === "number" ? entry.duration : null;

    return {
      id: String(entry?.id || `${entry?.startTime || "time"}-${Math.random()}`),
      time: formatTime12h(entry?.startTime || ""),
      duration: typeof entry?.duration === "number" ? `${entry.duration}m` : "",
      description,
      cast: cast || "—",
      notes: notes || "—",
      location: locationName ? { name: locationName, address: "" } : null,
      isBanner,
      marker: entry?.marker || null,
      trackId: entry?.trackId || null,
      // Canonical fields for conflict detection
      startTimeCanonical,
      durationMinutes,
    };
  });

  // Use unified locations from deriveLocationsFromLegacy (handles both modern array and legacy fields)
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

  const crewMapped = (crewRows || []).map((row) => ({
    id: String(row?.crewMemberId || row?.id || row?.name || Math.random()),
    department: row?.department ? String(row.department) : "",
    role: row?.role ? String(row.role) : "",
    name: row?.name ? String(row.name) : "—",
    callTime: row?.callTime ? String(row.callTime) : row?.callText ? String(row.callText) : row?.defaultCall ? String(row.defaultCall) : "",
    notes: row?.notes ? String(row.notes) : "",
    phone: row?.phone || null,
    email: row?.email || null,
  }));

  // DEV-ONLY: expand crew for density testing when ?mockCrew=1
  const crew = expandCrewForDensityTest(crewMapped);

  const scheduleDate = formatDateLong(schedule?.date);

  // Build simple track list (id + name only) for schedule display
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

export default function PreviewPanel({
  projectId,
  scheduleId,
  schedule,
  projectTitle = "",
  entries,
  tracks,
  columnConfig,
  onColumnResize,
  dayDetails,
  crewRows,
  talentRows,
  clientRows,
  sections,
  callSheetConfig,
  layoutV2,
  onUpdateCallSheetConfig,
}) {
  const panelRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [refreshNonce, setRefreshNonce] = useState(0);
  // Note: showImages state kept for legacy preview compatibility
  const showImages = true;
  const [showMobile, setShowMobile] = useState(() => {
    try {
      const stored = localStorage.getItem("callSheetPreview.showMobile");
      if (stored == null) return false;
      return stored === "true";
    } catch {
      return false;
    }
  });
  const [previewDesign, setPreviewDesign] = useState(() => {
    try {
      const stored = localStorage.getItem("callSheetPreview.design");
      if (stored === "modern" || stored === "legacy") return stored;
      return "modern"; // Default to modern (SetHero style)
    } catch {
      return "modern";
    }
  });
  const [isThemeOpen, setIsThemeOpen] = useState(false);

  // Read crew display options from localStorage (scoped to schedule to match CrewCallsCard)
  const keyEmails = scheduleId ? `callSheetCrew.showEmails:${scheduleId}` : null;
  const keyPhones = scheduleId ? `callSheetCrew.showPhones:${scheduleId}` : null;
  const keyColumnCount = scheduleId ? `callSheetCrew.columnCount:${scheduleId}` : null;
  const keyDepartmentOrder = scheduleId ? `callSheetCrew.departmentOrder:${scheduleId}` : null;

  const [crewDisplayOptions, setCrewDisplayOptions] = useState(() => {
    // SetHero defaults: showEmails OFF, showPhones ON, columnCount auto when unset
    if (!keyEmails || !keyPhones || !keyColumnCount) {
      return { showEmails: false, showPhones: true, columnCount: "auto", departmentOrder: null };
    }
    try {
      const storedColumnCount = localStorage.getItem(keyColumnCount);
      // Coerce "3" → "2" since 3-column layout is disabled
      const coercedColumnCount = storedColumnCount === "3" ? "2" : storedColumnCount;
      // Read department order
      let departmentOrder = null;
      if (keyDepartmentOrder) {
        try {
          const storedOrder = localStorage.getItem(keyDepartmentOrder);
          if (storedOrder) {
            const parsed = JSON.parse(storedOrder);
            departmentOrder = Array.isArray(parsed) ? parsed : null;
          }
        } catch {}
      }
      return {
        showEmails: localStorage.getItem(keyEmails) === "true", // Only true if explicitly "true"
        showPhones: localStorage.getItem(keyPhones) !== "false", // True unless explicitly "false"
        columnCount: ["1", "2"].includes(coercedColumnCount) ? coercedColumnCount : "auto",
        departmentOrder,
      };
    } catch {
      return { showEmails: false, showPhones: true, columnCount: "auto", departmentOrder: null };
    }
  });

  // Re-read localStorage when schedule changes (keys change)
  useEffect(() => {
    // SetHero defaults: showEmails OFF, showPhones ON, columnCount auto when unset
    if (!keyEmails || !keyPhones || !keyColumnCount) {
      setCrewDisplayOptions({ showEmails: false, showPhones: true, columnCount: "auto", departmentOrder: null });
      return;
    }
    try {
      const storedColumnCount = localStorage.getItem(keyColumnCount);
      // Coerce "3" → "2" since 3-column layout is disabled
      const coercedColumnCount = storedColumnCount === "3" ? "2" : storedColumnCount;
      // Read department order
      let departmentOrder = null;
      if (keyDepartmentOrder) {
        try {
          const storedOrder = localStorage.getItem(keyDepartmentOrder);
          if (storedOrder) {
            const parsed = JSON.parse(storedOrder);
            departmentOrder = Array.isArray(parsed) ? parsed : null;
          }
        } catch {}
      }
      setCrewDisplayOptions({
        showEmails: localStorage.getItem(keyEmails) === "true", // Only true if explicitly "true"
        showPhones: localStorage.getItem(keyPhones) !== "false", // True unless explicitly "false"
        columnCount: ["1", "2"].includes(coercedColumnCount) ? coercedColumnCount : "auto",
        departmentOrder,
      });
    } catch {
      setCrewDisplayOptions({ showEmails: false, showPhones: true, columnCount: "auto", departmentOrder: null });
    }
  }, [keyEmails, keyPhones, keyColumnCount, keyDepartmentOrder]);

  // Sync display options when toggled (from CrewCallsCard)
  useEffect(() => {
    const handleDisplayOptionsChange = () => {
      if (!keyEmails || !keyPhones || !keyColumnCount) return;
      const storedColumnCount = localStorage.getItem(keyColumnCount);
      // Coerce "3" → "2" since 3-column layout is disabled
      const coercedColumnCount = storedColumnCount === "3" ? "2" : storedColumnCount;
      // Read department order
      let departmentOrder = null;
      if (keyDepartmentOrder) {
        try {
          const storedOrder = localStorage.getItem(keyDepartmentOrder);
          if (storedOrder) {
            const parsed = JSON.parse(storedOrder);
            departmentOrder = Array.isArray(parsed) ? parsed : null;
          }
        } catch {}
      }
      setCrewDisplayOptions({
        showEmails: localStorage.getItem(keyEmails) === "true", // Only true if explicitly "true"
        showPhones: localStorage.getItem(keyPhones) !== "false", // True unless explicitly "false"
        columnCount: ["1", "2"].includes(coercedColumnCount) ? coercedColumnCount : "auto",
        departmentOrder,
      });
    };
    window.addEventListener("crewDisplayOptionsChange", handleDisplayOptionsChange);
    return () => window.removeEventListener("crewDisplayOptionsChange", handleDisplayOptionsChange);
  }, [keyEmails, keyPhones, keyColumnCount, keyDepartmentOrder]);

  const zoom = useMemo(() => zoomPercent / 100, [zoomPercent]);
  const minZoom = 50;
  const maxZoom = 200;
  const step = 10;

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    handleFullscreenChange();
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomPercent((prev) => Math.max(minZoom, prev - step));
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoomPercent((prev) => Math.min(maxZoom, prev + step));
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshNonce((prev) => prev + 1);
  }, []);

  const handleToggleMobile = useCallback((event) => {
    const next = Boolean(event.target.checked);
    setShowMobile(next);
    try {
      localStorage.setItem("callSheetPreview.showMobile", String(next));
    } catch {}
  }, []);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    if (!projectId || !scheduleId) return "";
    const url = new URL(window.location.href);
    url.pathname = `/projects/${projectId}/schedule`;
    url.searchParams.set("scheduleId", scheduleId);
    url.searchParams.set("callSheetBuilder", "1");
    url.searchParams.set("preview", "1");
    url.hash = "";
    return url.toString();
  }, [projectId, scheduleId]);

  const handleOpenLink = useCallback(() => {
    if (!shareUrl) return;
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  }, [shareUrl]);

  const handleToggleFullscreen = useCallback(async () => {
    if (typeof document === "undefined") return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      if (panelRef.current?.requestFullscreen) {
        await panelRef.current.requestFullscreen();
        return;
      }
      toast.info({ title: "Fullscreen not supported" });
    } catch {
      toast.error({ title: "Failed to enter fullscreen" });
    }
  }, []);

  const modernColors = useMemo(() => getModernColors(callSheetConfig), [callSheetConfig]);
  const modernData = useMemo(
    () =>
      buildModernCallSheetData({
        schedule,
        dayDetails,
        entries,
        crewRows,
        talentRows,
        sections,
        projectTitle,
        tracks,
      }),
    [crewRows, dayDetails, entries, projectTitle, schedule, sections, talentRows, tracks]
  );

  const handleUpdateModernColors = useCallback(
    (nextColors) => {
      if (!onUpdateCallSheetConfig) return;
      const existing = callSheetConfig?.colors && typeof callSheetConfig.colors === "object" ? callSheetConfig.colors : {};
      onUpdateCallSheetConfig({
        colors: {
          ...existing,
          primary: nextColors.primary,
          accent: nextColors.accent,
          primaryText: nextColors.primaryText,
          rowAlternate: nextColors.rowAlternate,
        },
      });
    },
    [callSheetConfig?.colors, onUpdateCallSheetConfig]
  );

  return (
    <div
      ref={panelRef}
      className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
    >
      {/* SetHero-style toolbar */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-700 dark:bg-slate-800">
        {/* Left: Live preview label with external link */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Live preview:</span>
          {shareUrl && (
            <button
              onClick={handleOpenLink}
              className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
              title="Open in new tab"
            >
              <ExternalLink className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-3">
          {/* Zoom controls grouped */}
          <div className="flex items-center gap-1 rounded border border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-700">
            <button
              onClick={handleZoomOut}
              className="px-2 py-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-600"
              title="Zoom out"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="min-w-[48px] text-center text-xs font-medium text-slate-600 dark:text-slate-300">
              {zoomPercent}%
            </span>
            <button
              onClick={handleZoomIn}
              className="px-2 py-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-600"
              title="Zoom in"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>

          {/* Show mobile checkbox */}
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
            <Checkbox checked={showMobile} onChange={handleToggleMobile} />
            <Smartphone className="h-4 w-4" />
            <span className="hidden sm:inline">Show mobile</span>
          </label>

          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            title="Refresh preview"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          {/* Theme button */}
          <button
            onClick={() => setIsThemeOpen(true)}
            className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-50"
            title="Customize theme"
            disabled={!onUpdateCallSheetConfig}
          >
            <Palette className="h-4 w-4" />
          </button>

          {/* Full Screen button */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={handleToggleFullscreen}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="h-3.5 w-3.5 mr-1.5" />
                Exit
              </>
            ) : (
              <>
                <Maximize2 className="h-3.5 w-3.5 mr-1.5" />
                Full Screen
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-slate-50 dark:bg-slate-900">
        {previewDesign === "modern" ? (
          <div className="doc-canvas h-full overflow-auto p-6">
            <CallSheetPreviewModern
              data={modernData}
              colors={modernColors}
              showMobile={showMobile}
              zoom={zoomPercent}
              layoutV2={layoutV2}
              sections={sections}
              crewDisplayOptions={crewDisplayOptions}
              columnConfig={columnConfig}
            />
          </div>
        ) : (
          <CallSheetPreviewLegacy
            key={refreshNonce}
            schedule={schedule}
            entries={entries}
            tracks={tracks}
            columnConfig={columnConfig}
            zoomLevel={zoom}
            showImages={showImages}
            mobileMode={showMobile}
            onColumnResize={onColumnResize}
            dayDetails={dayDetails}
            crewRows={crewRows}
            talentRows={talentRows}
            clientRows={clientRows}
            sections={sections}
            callSheetConfig={callSheetConfig}
            layoutV2={layoutV2}
          />
        )}
      </div>

      <Modal open={isThemeOpen} onClose={() => setIsThemeOpen(false)} labelledBy="preview-theme-title">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div id="preview-theme-title" className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Preview Theme
          </div>
          <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => setIsThemeOpen(false)}>
            Close
          </Button>
        </div>
        <div className="space-y-4 p-4">
          <div className="text-sm text-slate-600 dark:text-slate-300">
            Theme applies to the Immediate (Modern) preview.
          </div>
          <ColorCustomizer colors={modernColors} onChange={handleUpdateModernColors} />
        </div>
      </Modal>
    </div>
  );
}
