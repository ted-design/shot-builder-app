// src/components/callsheet/export/CallSheetExportModal.jsx
// Modal for exporting call sheet to PDF
//
// EXPORT ARCHITECTURE:
// --------------------
// The AUTHORITATIVE renderer is: src/components/schedule/preview/CallSheetPreview.tsx
// All export paths should route through that renderer for WYSIWYG parity.
//
// Export path:
// "Print to PDF" - Renders CallSheetPreview into a dedicated print portal
// (a clean DOM root appended to body) then calls window.print(). This ensures
// the call sheet is rendered at full width without layout constraints from the
// preview panel, eliminating scaling and clipping issues.
//
// To add new export formats, always derive from CallSheetPreview.tsx, not this file.

import React, { useCallback, useMemo, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { X, Clock, Users, Printer } from "lucide-react";
import { Button } from "../../ui/button";
import { CallSheetPreview as CallSheetPreviewModern } from "../../schedule/preview/CallSheetPreview";
import { deriveLocationsFromLegacy, locationBlockHasContent } from "../../../lib/callsheet/deriveLocationsFromLegacy";
import { buildScheduleProjection } from "../../../lib/callsheet/buildScheduleProjection";
import {
  computeEffectiveCrewCallDisplay,
  timeStringToMinutes,
} from "../../../lib/time/crewCallEffective";

// ============================================
// Print Portal Data Building (mirrors PreviewPanel)
// ============================================

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
  const projection = buildScheduleProjection({
    entries: entries || [],
    tracks: tracks || [],
    options: {
      mode: "time",
      fallbackStartMin: 420,
      defaultDurationMin: 15,
      formatTime12h: formatTime12h,
      context: "CallSheetExportModal",
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

/**
 * CallSheetExportModal - Modal for exporting call sheet
 */
function CallSheetExportModal({
  isOpen,
  onClose,
  schedule,
  entries = [],
  tracks = [],
  projectTitle = "",
  dayDetails,
  crewRows = [],
  talentRows = [],
  sections = [],
  callSheetConfig,
  layoutV2,
  columnConfig = [],
}) {
  const printPortalRef = useRef(null);
  const printRootRef = useRef(null);

  // Build modern data for print portal (mirrors PreviewPanel)
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

  // Cleanup print portal on unmount
  useEffect(() => {
    return () => {
      if (printRootRef.current) {
        printRootRef.current.unmount();
        printRootRef.current = null;
      }
      if (printPortalRef.current) {
        printPortalRef.current.remove();
        printPortalRef.current = null;
      }
    };
  }, []);

  /**
   * Print to PDF using a dedicated print portal.
   * This renders CallSheetPreview into a clean, full-width DOM root appended to body,
   * ensuring the call sheet prints without scaling or clipping from the preview panel.
   */
  const handlePrintPreview = useCallback(() => {
    const body = document?.body;
    if (!body) return;

    // Create print portal container
    const portalContainer = document.createElement("div");
    portalContainer.id = "callsheet-print-portal";
    portalContainer.setAttribute("data-callsheet-print-portal", "1");
    body.appendChild(portalContainer);
    printPortalRef.current = portalContainer;

    // Create React root and render CallSheetPreview
    const root = createRoot(portalContainer);
    printRootRef.current = root;

    root.render(
      <CallSheetPreviewModern
        data={modernData}
        colors={modernColors}
        showMobile={false}
        zoom={100}
        layoutV2={layoutV2}
        sections={sections}
        columnConfig={columnConfig}
        scheduleBlockFields={callSheetConfig?.scheduleBlockFields}
      />
    );

    // Cleanup function for after printing
    const cleanup = () => {
      body.removeAttribute("data-callsheet-printing");
      window.removeEventListener("afterprint", cleanup);

      // Unmount and remove portal after a brief delay to ensure print completes
      window.setTimeout(() => {
        if (printRootRef.current) {
          printRootRef.current.unmount();
          printRootRef.current = null;
        }
        if (printPortalRef.current) {
          printPortalRef.current.remove();
          printPortalRef.current = null;
        }
      }, 100);
    };

    window.addEventListener("afterprint", cleanup);
    body.setAttribute("data-callsheet-printing", "1");
    onClose?.();

    // Wait for React to render, then print
    window.setTimeout(() => window.print(), 100);
  }, [onClose, modernData, modernColors, layoutV2, sections, columnConfig, callSheetConfig?.scheduleBlockFields]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h2
            id="export-modal-title"
            className="text-lg font-semibold text-slate-900 dark:text-slate-100"
          >
            Export Call Sheet
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Summary */}
          <div className="mb-6 rounded-lg bg-slate-50 p-4 dark:bg-slate-800">
            <h3 className="mb-2 font-medium text-slate-900 dark:text-slate-100">
              {schedule?.name || "Call Sheet"}
            </h3>
            <div className="space-y-1 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" />
                {entries.length} entries
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5" />
                {tracks.length} tracks
              </div>
            </div>
          </div>

          {/* Export info */}
          <div className="mb-6">
            <p className="text-sm text-slate-500">
              Export includes all schedule entries organized by track with times, descriptions, talent, products, and locations.
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              onClick={handlePrintPreview}
              className="w-full gap-2"
            >
              <Printer className="h-4 w-4" />
              Print to PDF
            </Button>
            <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">
              Opens the print dialog. For full color fidelity, enable "Background graphics" in the print options.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CallSheetExportModal;
