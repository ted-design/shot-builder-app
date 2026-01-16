// src/components/callsheet/vertical/CallSheetPreview.jsx
// Live preview table for the call sheet (SetHero style right panel)

import React, { useMemo, useEffect, useState } from "react";
import {
  Clock,
  Calendar,
  Users,
  FileText,
  Info,
  AlertTriangle,
  ChevronDown,
  Check,
  Image as ImageIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";

import {
  DEFAULT_COLUMNS,
  CUSTOM_ENTRY_CATEGORY_COLORS,
} from "../../../types/schedule";
import { sortEntriesCanonical } from "../../../lib/callsheet/sortEntriesCanonical";
import { minutesToTime12h, parseTimeToMinutes } from "../../../lib/timeUtils";
import AppImage from "../../common/AppImage";
import { buildCallSheetVariableContext, resolveCallSheetVariable } from "../../../lib/callsheet/variables";
import { formatNotesForDisplay } from "../../../lib/sanitize";
import { sanitizeHtml, hasRichContent } from "../../../lib/sanitizeHtml";
import { DEFAULT_CLIENT_ROSTER_COLUMNS, DEFAULT_TALENT_ROSTER_COLUMNS, normalizeRosterColumns } from "../../../lib/callsheet/peopleColumns";

// Width options for inline column resize
const WIDTH_OPTIONS = [
  { value: "xs", label: "XS", desc: "Extra Small" },
  { value: "sm", label: "S", desc: "Small" },
  { value: "md", label: "M", desc: "Medium" },
  { value: "lg", label: "L", desc: "Large" },
  { value: "xl", label: "XL", desc: "Extra Large" },
];

/**
 * Map column width preset to Tailwind width class
 */
function getWidthClass(width) {
  const widthMap = {
    xs: "w-16 min-w-[64px] flex-shrink-0",
    sm: "w-24 min-w-[96px] flex-shrink-0",
    md: "w-32 min-w-[128px] flex-shrink-0",
    lg: "w-48 min-w-[192px] flex-shrink-0",
    xl: "flex-1 min-w-[200px]",
    hidden: "hidden",
  };
  return widthMap[width] || "w-32 min-w-[128px] flex-shrink-0";
}

function getRosterWidthClass(width) {
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

/**
 * Format time from 24h to 12h format
 */
function formatTime12h(timeStr) {
  if (!timeStr) return "—";
  const minutes = parseTimeToMinutes(timeStr);
  return minutesToTime12h(minutes);
}

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

function getDeltaTag(deltaMinutes) {
  if (!Number.isFinite(deltaMinutes)) return null;
  if (deltaMinutes === 0) return { label: "ON TIME", tone: "muted" };
  if (deltaMinutes < 0) return { label: `EARLY ${Math.abs(deltaMinutes)}m`, tone: "blue" };
  return { label: `DELAY ${Math.abs(deltaMinutes)}m`, tone: "amber" };
}

/**
 * Format duration in minutes to readable string
 */
function formatDuration(minutes) {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}hr`;
  return `${h}h ${m}m`;
}

function isHexColor(value) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

/**
 * Get category display label
 */
function getCategoryLabel(category) {
  const labels = {
    setup: "Setup / Load-in",
    break: "Break",
    lunch: "Lunch",
    wrap: "Wrap",
    travel: "Location Move",
    meeting: "Meeting",
    talent: "Talent Prep",
    other: "Other",
  };
  return labels[category] || category;
}

function withAlpha(hex, alphaHex) {
  if (!hex || typeof hex !== "string") return hex;
  const normalized = hex.startsWith("#") ? hex.slice(1) : hex;
  if (normalized.length !== 6) return hex;
  return `#${normalized}${alphaHex}`;
}

/**
 * Render cell content based on column key
 */
function renderCellContent(columnKey, entry, options = {}) {
  const isShot = entry.type === "shot";
  const isCustom = !isShot;
  const showImages = options.showImages !== false;

  switch (columnKey) {
    case "time":
      return (
        <div className="flex flex-col justify-center">
          <div className="font-medium text-slate-900 dark:text-slate-100">
            {formatTime12h(entry.startTime)}
          </div>
          {entry.duration && (
            <div className="text-xs text-slate-400">
              {formatDuration(entry.duration)}
            </div>
          )}
          {entry.flag ? (
            <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
              {String(entry.flag)}
            </div>
          ) : null}
        </div>
      );
    case "duration":
      return (
        <span className="text-slate-600 dark:text-slate-400">
          {formatDuration(entry.duration) || "—"}
        </span>
      );
    case "shot":
      return isShot ? (
        <span className="font-medium text-slate-900 dark:text-slate-100">
          {entry.shotNumber || "—"}
        </span>
      ) : (
        <span className="text-xs italic text-slate-400">—</span>
      );
    case "description":
      return (
        <div className="flex flex-col justify-center">
          {isCustom && (
            <span className="mb-0.5 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
              {getCategoryLabel(entry.customData?.category)}
            </span>
          )}
          <div className="flex items-start gap-2">
		            {isShot && showImages && entry.resolvedImage && (
		              <div className="mt-0.5 w-14 flex-shrink-0 overflow-hidden rounded bg-slate-100 dark:bg-slate-700 aspect-[4/3] flex items-center justify-center">
		                <AppImage
		                  src={entry.resolvedImage}
		                  alt=""
		                  fit="cover"
		                  className="h-full w-full"
		                  imageClassName="h-full w-full"
		                  position={entry.resolvedImagePosition}
		                  fallback={
		                    <div className="flex h-full w-full items-center justify-center">
		                      <ImageIcon className="h-4 w-4 text-slate-400 dark:text-slate-500" />
	                    </div>
	                  }
	                />
	              </div>
	            )}
            <div className="min-w-0 flex-1">
              <div className="font-medium text-slate-900 dark:text-slate-100">
                {entry.resolvedTitle || "—"}
              </div>
              {entry.resolvedDetails && (
                <div className="mt-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                  {entry.resolvedDetails}
                </div>
              )}
              {entry.description && (
                <div className="mt-0.5 line-clamp-2 text-slate-600 dark:text-slate-400">
                  {entry.description}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    case "talent":
      return entry.resolvedTalent?.length > 0 ? (
        <span className="text-slate-700 dark:text-slate-300">
          {entry.resolvedTalent
            .slice(0, 3)
            .map((t) => (typeof t === "string" ? t : t.name))
            .join(", ")}
          {entry.resolvedTalent.length > 3 && "..."}
        </span>
      ) : (
        <span className="text-slate-400">—</span>
      );
    case "products":
      return entry.resolvedProducts?.length > 0 ? (
        <span className="text-slate-700 dark:text-slate-300">
          {entry.resolvedProducts
            .slice(0, 2)
            .map((p) => (typeof p === "string" ? p : p.name || p.familyName))
            .join(", ")}
          {entry.resolvedProducts.length > 2 && "..."}
        </span>
      ) : (
        <span className="text-slate-400">—</span>
      );
    case "location":
      return entry.resolvedLocation ? (
        <span className="text-slate-700 dark:text-slate-300">
          {entry.resolvedLocation}
        </span>
      ) : (
        <span className="text-slate-400">—</span>
      );
    case "notes":
      return entry.resolvedNotes ? (
        <span className="line-clamp-2 break-words text-slate-600 dark:text-slate-400">
          {entry.resolvedNotes}
        </span>
      ) : (
        <span className="text-slate-400">—</span>
      );
    default:
      return <span className="text-slate-400">—</span>;
  }
}

/**
 * CallSheetPreview - Live preview table showing call sheet format
 *
 * @param {object} props
 * @param {object} props.schedule - Schedule object with name, date
 * @param {Array} props.entries - Resolved entries array
 * @param {Array} props.tracks - Tracks array
 * @param {Array} props.columnConfig - Column configuration (optional)
 * @param {number} props.zoomLevel - Preview zoom level (0.75, 1, 1.25)
 * @param {boolean} props.showImages - Whether to show images in preview
 * @param {Function} props.onColumnResize - Callback when column size changes (key, newWidth)
 */
function CallSheetPreview({
  schedule,
  entries = [],
  tracks = [],
  columnConfig,
  zoomLevel = 1,
  showImages = true,
  mobileMode = false,
  onColumnResize,
  dayDetails,
  crewRows = [],
  talentRows = [],
  clientRows = [],
  sections,
  layoutV2,
}) {
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    const handleBefore = () => setIsPrinting(true);
    const handleAfter = () => setIsPrinting(false);
    window.addEventListener("beforeprint", handleBefore);
    window.addEventListener("afterprint", handleAfter);
    return () => {
      window.removeEventListener("beforeprint", handleBefore);
      window.removeEventListener("afterprint", handleAfter);
    };
  }, []);
  // Sort entries canonically by order (not time) for deterministic rendering
  // Matches PreviewPanel and editor behavior
  const sortedEntries = useMemo(() => {
    return sortEntriesCanonical(entries || [], { context: "CallSheetPreviewLegacy" });
  }, [entries]);

  const columns = useMemo(() => {
    return columnConfig || DEFAULT_COLUMNS;
  }, [columnConfig]);

  // Get visible columns sorted by order (fall back to defaults if not provided)
  const visibleColumns = useMemo(() => {
    return columns
      .filter((col) => col.visible !== false && col.width !== "hidden")
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [columns]);

  // Preview removes duration column; duration is shown in time/boxes instead.
  const previewColumns = useMemo(() => {
    return visibleColumns.filter((col) => col.key !== "duration");
  }, [visibleColumns]);

  const timeColumn = useMemo(() => {
    return (
      columns.find((col) => col.key === "time") ||
      DEFAULT_COLUMNS.find((col) => col.key === "time")
    );
  }, [columns]);

  const nonTimeColumns = useMemo(() => {
    return previewColumns.filter((col) => col.key !== "time");
  }, [previewColumns]);

  const orderedTracks = useMemo(() => {
    return [...tracks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [tracks]);

  const sharedTrackIdsBase = useMemo(() => {
    return new Set(
      orderedTracks
        .filter((track) => track.scope === "shared" || track.id === "shared")
        .map((track) => track.id)
    );
  }, [orderedTracks]);

  const legacySharedLaneTrackIds = useMemo(() => {
    const ids = new Set();
    sortedEntries.forEach((entry) => {
      if (entry.type !== "shot") return;
      if (sharedTrackIdsBase.has(entry.trackId)) ids.add(entry.trackId);
    });
    return ids;
  }, [sortedEntries, sharedTrackIdsBase]);

  const sharedTrackIds = useMemo(() => {
    const ids = new Set(sharedTrackIdsBase);
    legacySharedLaneTrackIds.forEach((id) => ids.delete(id));
    return ids;
  }, [sharedTrackIdsBase, legacySharedLaneTrackIds]);

  const laneCandidateTracks = useMemo(() => {
    return orderedTracks.filter((track) => !sharedTrackIds.has(track.id));
  }, [orderedTracks, sharedTrackIds]);

  const sharedEntries = useMemo(() => {
    return sortedEntries.filter((entry) => entry.type === "custom" && sharedTrackIds.has(entry.trackId));
  }, [sortedEntries, sharedTrackIds]);

  const laneTracks = useMemo(() => {
    const activeLaneTrackIds = new Set();

    sortedEntries.forEach((entry) => {
      if (sharedTrackIds.has(entry.trackId)) return;
      activeLaneTrackIds.add(entry.trackId);
    });

    sharedEntries.forEach((entry) => {
      if (!Array.isArray(entry.appliesToTrackIds) || entry.appliesToTrackIds.length === 0) return;
      entry.appliesToTrackIds.forEach((trackId) => activeLaneTrackIds.add(trackId));
    });

    if (activeLaneTrackIds.size === 0 && sharedEntries.length > 0 && laneCandidateTracks.length > 0) {
      activeLaneTrackIds.add(laneCandidateTracks[0].id);
    }

    return laneCandidateTracks.filter((track) => activeLaneTrackIds.has(track.id));
  }, [sortedEntries, sharedTrackIds, sharedEntries, laneCandidateTracks]);

  const isMultiTrack = laneTracks.length > 1;

  const sharedCustomSlots = useMemo(() => {
    if (!isMultiTrack) return new Map();
    const map = new Map();
    sharedEntries.forEach((entry) => {
      const minutes = parseTimeToMinutes(entry.startTime);
      const list = map.get(minutes) || [];
      list.push(entry);
      map.set(minutes, list);
    });
    for (const [minutes, list] of map.entries()) {
      map.set(minutes, [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
    }
    return map;
  }, [sharedEntries, isMultiTrack]);

  const entriesForSlots = useMemo(() => {
    if (!isMultiTrack) return sortedEntries;
    return sortedEntries.filter(
      (entry) => !(entry.type === "custom" && sharedTrackIds.has(entry.trackId))
    );
  }, [sortedEntries, isMultiTrack, sharedTrackIds]);

  const timeSlots = useMemo(() => {
    const byTime = new Map();

    entriesForSlots.forEach((entry) => {
      const minutes = parseTimeToMinutes(entry.startTime);
      const perTrack = byTime.get(minutes) || new Map();
      const trackEntries = perTrack.get(entry.trackId) || [];
      trackEntries.push(entry);
      perTrack.set(entry.trackId, trackEntries);
      byTime.set(minutes, perTrack);
    });

    // Ensure shared custom-only times are represented.
    for (const minutes of sharedCustomSlots.keys()) {
      if (!byTime.has(minutes)) {
        byTime.set(minutes, new Map());
      }
    }

    return Array.from(byTime.entries())
      .sort(([a], [b]) => a - b)
      .map(([minutes, perTrack]) => {
        const sortedPerTrack = new Map();
        for (const [trackId, list] of perTrack.entries()) {
          const listSorted = [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          sortedPerTrack.set(trackId, listSorted);
        }
        return { minutes, perTrack: sortedPerTrack };
      });
  }, [entriesForSlots, sharedCustomSlots]);

  const singleTrackColumns = useMemo(() => {
    const withoutTime = previewColumns.filter((col) => col.key !== "time");
    return [
      {
        key: "time",
        label: timeColumn?.label || "Time",
        width: timeColumn?.width || "md",
        order: -1,
      },
      ...withoutTime,
    ];
  }, [previewColumns, timeColumn]);

  // Get schedule date display
  const scheduleDate = schedule?.date
    ? new Date(schedule.date).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Schedule Date";

  const previewZoom = typeof zoomLevel === "number" && zoomLevel > 0 ? zoomLevel : 1;
  const previewShowImages = showImages !== false;
  const allowColumnResize = Boolean(onColumnResize) && !isPrinting;

  const configuredTimeColumnWidth = timeColumn?.width || "md";
  const timeColumnWidth =
    configuredTimeColumnWidth !== "hidden" ? configuredTimeColumnWidth : "md";
  const timeColumnLabel = timeColumn?.label || "Time";
  const incrementMinutes = schedule?.settings?.timeIncrement || 15;
  const showDurations = schedule?.settings?.showDurations ?? true;
  const baseRowHeight = 44;

  const headerEnabled = useMemo(() => {
    const list = Array.isArray(sections) ? sections : [];
    const headerSection = list.find((s) => s?.type === "header");
    if (!headerSection) return true;
    return headerSection.isVisible !== false;
  }, [sections]);

  const talentEnabled = useMemo(() => {
    const list = Array.isArray(sections) ? sections : [];
    const section = list.find((s) => s?.type === "talent");
    if (!section) return false;
    return section.isVisible !== false;
  }, [sections]);

  const orderedSectionsList = useMemo(() => {
    const list = Array.isArray(sections) ? [...sections] : [];
    return list.sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0));
  }, [sections]);

  const visibleNonHeaderSections = useMemo(() => {
    return orderedSectionsList.filter((section) => section?.type !== "header" && section?.isVisible !== false);
  }, [orderedSectionsList]);

  const scheduleSection = useMemo(() => {
    return orderedSectionsList.find((section) => section?.type === "schedule") || null;
  }, [orderedSectionsList]);

  const scheduleVisible = scheduleSection ? scheduleSection.isVisible !== false : true;

  const scheduleSectionIndex = useMemo(() => {
    return visibleNonHeaderSections.findIndex((section) => section?.type === "schedule");
  }, [visibleNonHeaderSections]);

  const scheduleInsertIndex = useMemo(() => {
    return scheduleSectionIndex >= 0 ? scheduleSectionIndex : 0;
  }, [scheduleSectionIndex]);

  const nonScheduleSections = useMemo(() => {
    return visibleNonHeaderSections.filter((section) => section?.type !== "schedule");
  }, [visibleNonHeaderSections]);

  const sectionsBeforeSchedule = useMemo(() => {
    if (!scheduleVisible) return nonScheduleSections;
    return nonScheduleSections.slice(0, scheduleInsertIndex);
  }, [nonScheduleSections, scheduleInsertIndex, scheduleVisible]);

  const sectionsAfterSchedule = useMemo(() => {
    if (!scheduleVisible) return [];
    return nonScheduleSections.slice(scheduleInsertIndex);
  }, [nonScheduleSections, scheduleInsertIndex, scheduleVisible]);

  const clientsSection = useMemo(() => {
    const list = Array.isArray(sections) ? sections : [];
    return list.find((s) => s?.type === "clients") || null;
  }, [sections]);

  const clientsTitle = useMemo(() => {
    const raw = clientsSection?.config?.title;
    const title = raw != null ? String(raw) : "";
    return title.trim() ? title : "Clients";
  }, [clientsSection?.config?.title]);

  const clientsColumns = useMemo(() => {
    return normalizeRosterColumns(clientsSection?.config?.columnConfig, DEFAULT_CLIENT_ROSTER_COLUMNS);
  }, [clientsSection?.config?.columnConfig]);

  const visibleClientsColumns = useMemo(() => {
    return clientsColumns
      .filter((col) => col.visible !== false && col.width !== "hidden")
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [clientsColumns]);

  const talentSection = useMemo(() => {
    const list = Array.isArray(sections) ? sections : [];
    return list.find((s) => s?.type === "talent") || null;
  }, [sections]);

  const talentTitle = useMemo(() => {
    const raw = talentSection?.config?.title;
    const title = raw != null ? String(raw) : "";
    return title.trim() ? title : "Talent";
  }, [talentSection?.config?.title]);

  const talentColumns = useMemo(() => {
    return normalizeRosterColumns(talentSection?.config?.columnConfig, DEFAULT_TALENT_ROSTER_COLUMNS);
  }, [talentSection?.config?.columnConfig]);

  const visibleTalentColumns = useMemo(() => {
    return talentColumns
      .filter((col) => col.visible !== false && col.width !== "hidden")
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [talentColumns]);

  const crewGroups = useMemo(() => {
    const groups = new Map();
    (crewRows || []).forEach((row) => {
      const dept = row?.department && String(row.department).trim() ? String(row.department).trim() : "Unassigned";
      if (!groups.has(dept)) groups.set(dept, []);
      groups.get(dept).push(row);
    });
    const ordered = Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
    return ordered.map(([department, rows]) => ({
      department,
      rows: [...rows].sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""))),
    }));
  }, [crewRows]);

  const variableCtx = useMemo(
    () =>
      buildCallSheetVariableContext({
        schedule,
        dayDetails: dayDetails || null,
      }),
    [dayDetails, schedule]
  );

  const callSheetSettings = layoutV2?.settings || null;
  const callSheetColors = callSheetSettings?.colors || null;

  const spacingKey =
    callSheetSettings?.spacing === "compact" || callSheetSettings?.spacing === "relaxed" || callSheetSettings?.spacing === "normal"
      ? callSheetSettings.spacing
      : "normal";
  const bodySpacingClassName = spacingKey === "compact" ? "space-y-4" : spacingKey === "relaxed" ? "space-y-8" : "space-y-6";
  const bodyPaddingClassName = spacingKey === "compact" ? "px-5 py-5" : spacingKey === "relaxed" ? "px-7 py-7" : "px-6 py-6";

  const paperStyle = useMemo(() => {
    if (mobileMode) {
      return {
        width: "390px",
        minHeight: "844px",
        backgroundColor: callSheetColors?.background || undefined,
      };
    }

    const width = callSheetSettings?.pageSize?.width;
    const height = callSheetSettings?.pageSize?.height;
    const unit = callSheetSettings?.pageSize?.unit;

    const dpi = 96;
    const mmToInches = 1 / 25.4;
    const widthInches =
      typeof width === "number" && Number.isFinite(width)
        ? unit === "mm"
          ? width * mmToInches
          : width
        : 8.5;
    const heightInches =
      typeof height === "number" && Number.isFinite(height)
        ? unit === "mm"
          ? height * mmToInches
          : height
        : 11;

    const widthPx = Math.round(widthInches * dpi);
    const heightPx = Math.round(heightInches * dpi);

    return {
      width: `${widthPx}px`,
      minHeight: `${heightPx}px`,
      backgroundColor: callSheetColors?.background || undefined,
    };
  }, [
    mobileMode,
    callSheetSettings?.pageSize?.width,
    callSheetSettings?.pageSize?.height,
    callSheetSettings?.pageSize?.unit,
    callSheetColors?.background,
  ]);

  const header = layoutV2?.header || null;
  const dayNotesHtml = useMemo(() => formatNotesForDisplay(dayDetails?.notes || ""), [dayDetails?.notes]);
  const dayNotesPlacement = dayDetails?.notesStyle?.placement === "top" ? "top" : "bottom";
  const dayNotesColor = isHexColor(dayDetails?.notesStyle?.color) ? dayDetails.notesStyle.color : null;
  const dayNotesIcon = dayDetails?.notesStyle?.icon || null;
  const customLocations = useMemo(
    () => (Array.isArray(dayDetails?.customLocations) ? dayDetails.customLocations : []),
    [dayDetails?.customLocations]
  );

  const renderHeaderText = (item) => {
    if (!item || item.enabled === false) return null;
    const raw = item.type === "variable" ? resolveCallSheetVariable(item.value, variableCtx) : String(item.value || "");
    const text = String(raw || "");
    return text.trim() ? text : "";
  };

  const renderHeaderItem = (item, idx, columnKey) => {
    if (!item || item.enabled === false) return null;
    // Deprecation: @companyName is hidden and should not render
    if (item.type === "variable" && item.value === "@companyName") return null;
    const align =
      item.style?.align ||
      (columnKey === "right" ? "right" : columnKey === "center" ? "center" : "left");
    const color = item.style?.color || undefined;
    const fontSize = typeof item.style?.fontSize === "number" ? item.style.fontSize : undefined;
    const lineHeight = typeof item.style?.lineHeight === "number" ? item.style.lineHeight : undefined;
    const marginTop = typeof item.style?.marginTop === "number" ? item.style.marginTop : undefined;
    const marginBottom = typeof item.style?.marginBottom === "number" ? item.style.marginBottom : undefined;
    const marginLeft = typeof item.style?.marginLeft === "number" ? item.style.marginLeft : undefined;
    const marginRight = typeof item.style?.marginRight === "number" ? item.style.marginRight : undefined;
    const wrap = item.style?.wrap === "nowrap" ? "nowrap" : "pre-wrap";

    const style = {
      textAlign: align,
      color,
      fontSize,
      lineHeight,
      marginTop,
      marginBottom,
      marginLeft,
      marginRight,
      whiteSpace: wrap,
      overflowWrap: "anywhere",
    };

    if (item.type === "image") {
      const src = String(item.value || "").trim();
      if (!src) return null;
      const shape =
        columnKey === "center"
          ? header?.centerShape === "circle"
            ? "rounded-full"
            : header?.centerShape === "rectangle"
            ? "rounded-md"
            : ""
          : "";
      return (
        <div key={`header-${columnKey}-img-${idx}`} style={style} className="my-1">
          <img
            src={src}
            alt=""
            className={["mx-auto max-h-16 max-w-full object-contain", shape].filter(Boolean).join(" ")}
          />
        </div>
      );
    }

    // Check for rich text content first (for text items)
    if (item.type === "text" && hasRichContent(item.richText)) {
      const sanitized = sanitizeHtml(item.richText);
      return (
        <div
          key={`header-${columnKey}-txt-${idx}`}
          style={style}
          className="my-0.5 header-richtext"
          dangerouslySetInnerHTML={{ __html: sanitized }}
        />
      );
    }

    // Fall back to plain text rendering
    const text = renderHeaderText(item);
    if (!text) return null;
    return (
      <div key={`header-${columnKey}-txt-${idx}`} style={style} className="my-0.5">
        {text}
      </div>
    );
  };

  const renderDetailRow = (label, value) => {
    const text = value != null && String(value).trim() ? String(value).trim() : "—";
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
        <div className="font-semibold uppercase tracking-wide text-slate-500">{label}</div>
        <div className="font-medium text-slate-800 dark:text-slate-200">{text}</div>
      </div>
    );
  };

  const renderLocationCard = (label, ref) => {
    const title = ref?.label && String(ref.label).trim() ? String(ref.label).trim() : "—";
    const notes = ref?.notes && String(ref.notes).trim() ? String(ref.notes).trim() : "";
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
        <div className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">{title}</div>
        {notes ? <div className="mt-1 text-xs text-slate-500">{notes}</div> : null}
      </div>
    );
  };

  const renderMainNotes = () => {
    const icon =
      dayNotesIcon === "alert"
        ? AlertTriangle
        : dayNotesIcon === "info"
        ? Info
        : dayNotesIcon === "note"
        ? FileText
        : null;
    const Icon = icon;
    const style = dayNotesColor ? { backgroundColor: dayNotesColor } : undefined;
    return (
      <div
        className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
        style={style}
      >
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {Icon ? <Icon className="h-4 w-4" /> : null}
          <span>Main Notes</span>
        </div>
        {dayNotesHtml ? (
          <div
            className="prose prose-sm mt-2 max-w-none text-slate-800 dark:prose-invert dark:text-slate-200"
            dangerouslySetInnerHTML={{ __html: dayNotesHtml }}
          />
        ) : (
          <div className="mt-2 text-xs text-slate-500">—</div>
        )}
      </div>
    );
  };

  const renderPageBreakSection = () => {
    const printStyle = isPrinting ? { breakAfter: "page", pageBreakAfter: "always" } : undefined;
    return (
      <div style={printStyle} className="py-3">
        <div className="flex items-center justify-center gap-3">
          <div className="h-px flex-1 border-t border-dashed border-slate-400 dark:border-slate-600" />
          <div className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
            Page Break
          </div>
          <div className="h-px flex-1 border-t border-dashed border-slate-400 dark:border-slate-600" />
        </div>
        {!isPrinting ? (
          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
            New Page
          </div>
        ) : null}
      </div>
    );
  };

  const renderRemindersSection = (section) => {
    const raw = section?.config?.text != null ? String(section.config.text) : "";
    const items = raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    return (
      <div className="rounded-lg border border-slate-300 dark:border-slate-600">
        <div className="bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white dark:bg-slate-950">
          Reminders
        </div>
        <div className="p-4">
          {items.length === 0 ? (
            <div className="text-sm text-slate-500">No reminders</div>
          ) : (
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">
              {items.map((item, idx) => (
                <li key={`${idx}-${item}`} className="break-words">
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  };

  const renderCustomBannerSection = (section) => {
    const text = section?.config?.text != null ? String(section.config.text).trim() : "";
    const label = text || "Banner";
    return (
      <div className="rounded-lg border border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-900">
        <div className="bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white dark:bg-slate-950">
          Banner
        </div>
        <div className="p-4">
          <div className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
            {label}
          </div>
        </div>
      </div>
    );
  };

  const renderExtrasSection = (section) => {
    const titleRaw = section?.config?.title != null ? String(section.config.title) : "";
    const title = titleRaw.trim() ? titleRaw.trim() : "Extras & Dept. Notes";
    const rows = Array.isArray(section?.config?.rows) ? section.config.rows : [];
    const normalized = rows
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const id = row.id != null ? String(row.id) : null;
        const rowTitle = row.title != null ? String(row.title).trim() : "";
        const text = row.text != null ? String(row.text).trim() : "";
        if (!rowTitle && !text) return null;
        return { id, title: rowTitle, text };
      })
      .filter(Boolean);

    return (
      <div className="rounded-lg border border-slate-300 dark:border-slate-600">
        <div className="bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white dark:bg-slate-950">
          {title}
        </div>
        <div className="grid gap-3 p-4">
          {normalized.length === 0 ? (
            <div className="text-sm text-slate-500">No extras / department notes</div>
          ) : (
            normalized.map((row, idx) => (
              <div
                key={row.id || `${idx}-${row.title}`}
                className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{row.title || "Row"}</div>
                <div className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
                  {row.text || "—"}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderAdvancedScheduleSection = (section) => {
    const titleRaw = section?.config?.title != null ? String(section.config.title) : "";
    const title = titleRaw.trim() ? titleRaw.trim() : "Advanced Schedule";
    const textRaw = section?.config?.text != null ? String(section.config.text) : "";
    const text = textRaw.trim();

    return (
      <div className="rounded-lg border border-slate-300 dark:border-slate-600">
        <div className="bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white dark:bg-slate-950">
          {title}
        </div>
        <div className="p-4">
          <div className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{text || "—"}</div>
        </div>
      </div>
    );
  };

  const renderNotesContactsSection = () => {
    return (
      <div className="rounded-lg border border-slate-300 dark:border-slate-600">
        <div className="bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white dark:bg-slate-950">
          Notes / Contacts
        </div>
        <div className="grid gap-4 p-4">
          <div className="grid gap-2 md:grid-cols-2">
            {renderDetailRow("Set Medic", dayDetails?.setMedic)}
            {renderDetailRow("Script Ver.", dayDetails?.scriptVersion)}
            {renderDetailRow("Schedule Ver.", dayDetails?.scheduleVersion)}
            {renderDetailRow("Key People", dayDetails?.keyPeople)}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {renderLocationCard("Production Office", dayDetails?.productionOffice)}
            {renderLocationCard("Nearest Hospital", dayDetails?.nearestHospital)}
            {renderLocationCard("Parking", dayDetails?.parking)}
            {renderLocationCard("Basecamp", dayDetails?.basecamp)}
          </div>
          {renderMainNotes()}
        </div>
      </div>
    );
  };

  const renderQuoteSection = (section) => {
    const titleRaw = section?.config?.title != null ? String(section.config.title) : "";
    const title = titleRaw.trim() ? titleRaw.trim() : "Quote of the Day";
    const quoteRaw = section?.config?.quote != null ? String(section.config.quote) : "";
    const authorRaw = section?.config?.author != null ? String(section.config.author) : "";
    const quote = quoteRaw.trim();
    const author = authorRaw.trim();

    return (
      <div className="rounded-lg border border-slate-300 dark:border-slate-600">
        <div className="bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white dark:bg-slate-950">
          {title}
        </div>
        <div className="p-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <div className="text-sm font-medium italic text-slate-800 dark:text-slate-200">
              {quote ? `“${quote}”` : "—"}
            </div>
            {author ? <div className="mt-2 text-xs font-semibold text-slate-500">— {author}</div> : null}
          </div>
        </div>
      </div>
    );
  };

  const renderDayDetailsSection = () => {
    return (
      <div className="rounded-lg border border-slate-300 dark:border-slate-600">
        <div className="bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white dark:bg-slate-950">
          Day Details
        </div>
        <div className="grid gap-4 p-4">
          {dayNotesPlacement === "top" ? renderMainNotes() : null}
          <div className="grid gap-2 md:grid-cols-3">
            {renderDetailRow("Crew Call", dayDetails?.crewCallTime)}
            {renderDetailRow("Shooting Call", dayDetails?.shootingCallTime)}
            {renderDetailRow("Est. Wrap", dayDetails?.estimatedWrap)}
            {renderDetailRow("Breakfast", dayDetails?.breakfastTime)}
            {renderDetailRow("1st Meal", dayDetails?.firstMealTime)}
            {renderDetailRow("2nd Meal", dayDetails?.secondMealTime)}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Key People</div>
              <div className="mt-1 whitespace-pre-wrap text-xs text-slate-700 dark:text-slate-300">
                {dayDetails?.keyPeople && String(dayDetails.keyPeople).trim() ? String(dayDetails.keyPeople).trim() : "—"}
              </div>
              <div className="mt-3 grid gap-2">
                {renderDetailRow("Set Medic", dayDetails?.setMedic)}
                {renderDetailRow("Script Ver.", dayDetails?.scriptVersion)}
                {renderDetailRow("Schedule Ver.", dayDetails?.scheduleVersion)}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Weather</div>
              <div className="mt-1 text-xs text-slate-700 dark:text-slate-300">
                {dayDetails?.weather?.summary && String(dayDetails.weather.summary).trim()
                  ? String(dayDetails.weather.summary).trim()
                  : "—"}
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {renderDetailRow("Low", dayDetails?.weather?.lowTemp != null ? `${dayDetails.weather.lowTemp}` : null)}
                {renderDetailRow("High", dayDetails?.weather?.highTemp != null ? `${dayDetails.weather.highTemp}` : null)}
                {renderDetailRow("Sunrise", dayDetails?.weather?.sunrise)}
                {renderDetailRow("Sunset", dayDetails?.weather?.sunset)}
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {renderLocationCard("Production Office", dayDetails?.productionOffice)}
            {renderLocationCard("Nearest Hospital", dayDetails?.nearestHospital)}
            {renderLocationCard("Parking", dayDetails?.parking)}
            {renderLocationCard("Basecamp", dayDetails?.basecamp)}
            {customLocations.map((row) =>
              renderLocationCard(String(row?.title || "Location"), {
                label: row?.label ?? null,
                notes: row?.notes ?? null,
              })
            )}
          </div>

          {dayNotesPlacement !== "top" ? renderMainNotes() : null}
        </div>
      </div>
    );
  };

  const renderSectionContent = (section) => {
    if (!section) return null;

    switch (section.type) {
      case "day-details":
        return renderDayDetailsSection();
      case "reminders":
        return renderRemindersSection(section);
      case "custom-banner":
        return renderCustomBannerSection(section);
      case "notes-contacts":
        return renderNotesContactsSection();
      case "extras":
        return renderExtrasSection(section);
      case "advanced-schedule":
        return renderAdvancedScheduleSection(section);
      case "quote":
        return renderQuoteSection(section);
      case "page-break":
        return renderPageBreakSection();
      case "clients":
        return (
          <div className="rounded-lg border border-slate-300 dark:border-slate-600">
            <div className="bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white dark:bg-slate-950">
              {clientsTitle}
            </div>
            {Array.isArray(clientRows) && clientRows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-[980px] w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    <tr>
                      {visibleClientsColumns.map((col) => (
                        <th key={col.key} className={`px-3 py-2 text-left ${getRosterWidthClass(col.width)}`}>
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {clientRows.map((row, idx) => (
                      <tr
                        key={row.id || idx}
                        className={idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-800/30"}
                      >
                        {visibleClientsColumns.map((col) => {
                          const key = col.key;
                          if (key === "id") {
                            return (
                              <td key="id" className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
                                {row?.idLabel ? String(row.idLabel) : "—"}
                              </td>
                            );
                          }

                          if (key === "name") {
                            return (
                              <td key="name" className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
                                {row?.name ? String(row.name) : "—"}
                              </td>
                            );
                          }

                          if (key === "call") {
                            const callValue = row?.callTime ? String(row.callTime) : row?.callText ? String(row.callText) : "";
                            const callDisplay = isTimeString(callValue) ? formatTime12h(callValue) : callValue || "—";
                            return (
                              <td key="call" className="px-3 py-2 text-slate-700 dark:text-slate-300">
                                {callDisplay}
                              </td>
                            );
                          }

                          if (key === "set") {
                            const setValue = row?.setTime ? String(row.setTime) : "";
                            const setDisplay = isTimeString(setValue) ? formatTime12h(setValue) : setValue || "—";
                            return (
                              <td key="set" className="px-3 py-2 text-slate-700 dark:text-slate-300">
                                {setDisplay}
                              </td>
                            );
                          }

                          const value =
                            key === "role"
                              ? row?.role
                              : key === "status"
                                ? row?.status
                                : key === "transportation"
                                  ? row?.transportation
                                  : key === "blockRhs"
                                    ? row?.blockRhs
                                    : key === "muWard"
                                      ? row?.muWard
                                      : key === "remarks"
                                        ? row?.remarks
                                        : null;

                          return (
                            <td key={key} className="px-3 py-2 text-slate-600 dark:text-slate-400">
                              {value ? String(value) : "—"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 text-sm text-slate-500">No clients in callsheet</div>
            )}
          </div>
        );
      case "talent":
        return (
          <div className="rounded-lg border border-slate-300 dark:border-slate-600">
            <div className="bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white dark:bg-slate-950">
              {talentTitle}
            </div>
            {Array.isArray(talentRows) && talentRows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-[980px] w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    <tr>
                      {visibleTalentColumns.map((col) => (
                        <th key={col.key} className={`px-3 py-2 text-left ${getRosterWidthClass(col.width)}`}>
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {talentRows.map((row, idx) => (
                      <tr
                        key={row.talentId || idx}
                        className={idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-800/30"}
                      >
                        {visibleTalentColumns.map((col) => {
                          const key = col.key;
                          if (key === "id") {
                            return (
                              <td key="id" className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
                                {row?.idLabel ? String(row.idLabel) : "—"}
                              </td>
                            );
                          }

                          if (key === "name") {
                            return (
                              <td key="name" className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
                                {row?.name ? String(row.name) : "—"}
                              </td>
                            );
                          }

                          if (key === "call") {
                            const callValue = row?.callTime ? String(row.callTime) : row?.callText ? String(row.callText) : "";
                            const callDisplay = isTimeString(callValue) ? formatTime12h(callValue) : callValue || "—";
                            return (
                              <td key="call" className="px-3 py-2 text-slate-700 dark:text-slate-300">
                                {callDisplay}
                              </td>
                            );
                          }

                          if (key === "set") {
                            const setValue = row?.setTime ? String(row.setTime) : "";
                            const setDisplay = isTimeString(setValue) ? formatTime12h(setValue) : setValue || "—";
                            return (
                              <td key="set" className="px-3 py-2 text-slate-700 dark:text-slate-300">
                                {setDisplay}
                              </td>
                            );
                          }

                          const value =
                            key === "role"
                              ? row?.role
                              : key === "status"
                                ? row?.status
                                : key === "transportation"
                                  ? row?.transportation
                                  : key === "blockRhs"
                                    ? row?.blockRhs
                                    : key === "muWard"
                                      ? row?.muWard
                                      : key === "remarks"
                                        ? row?.remarks
                                        : null;

                          return (
                            <td key={key} className="px-3 py-2 text-slate-600 dark:text-slate-400">
                              {value ? String(value) : "—"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 text-sm text-slate-500">No talents in callsheet</div>
            )}
          </div>
        );
      case "crew":
        return (
          <div className="rounded-lg border border-slate-300 dark:border-slate-600">
            <div className="bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white dark:bg-slate-950">
              Crew
            </div>
            <div className="p-4">
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Crew times are relative to the general crew call time.
              </div>
              {crewGroups.length === 0 ? (
                <div className="text-sm text-slate-500">No crew assigned to this project yet.</div>
              ) : (
                <div className="space-y-6">
                  {crewGroups.map((group) => (
                    <div key={group.department} className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{group.department}</div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
                          <thead className="bg-slate-50 dark:bg-slate-900 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            <tr>
                              <th className="px-3 py-2 text-left">Crew</th>
                              <th className="px-3 py-2 text-left w-36">Call</th>
                              <th className="px-3 py-2 text-left w-28">Delta</th>
                              <th className="px-3 py-2 text-left">Notes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {group.rows.map((row) => {
                              const baseTime = dayDetails?.crewCallTime ? String(dayDetails.crewCallTime).trim() : "";
                              const override =
                                (row?.callTime && String(row.callTime).trim()) ||
                                (row?.callText && String(row.callText).trim()) ||
                                "";
                              const effective =
                                (isTimeString(override) ? override : "") || (isTimeString(baseTime) ? baseTime : "");
                              const delta = getTimeDeltaMinutes(baseTime, effective);
                              const deltaTag = getDeltaTag(delta);
                              const callDisplay = effective
                                ? formatTime12h(effective)
                                : override
                                  ? String(override)
                                  : baseTime
                                    ? formatTime12h(baseTime)
                                    : "—";

                              return (
                                <tr key={row.crewMemberId}>
                                  <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
                                    {row?.name ? String(row.name) : "—"}
                                  </td>
                                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{callDisplay}</td>
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
                                      >
                                        {deltaTag.label}
                                      </span>
                                    ) : (
                                      "—"
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                                    {row?.notes ? String(row.notes) : "—"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-100 text-sm dark:bg-slate-900">
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto w-fit">
          <div
            data-callsheet-print-scale
            className="origin-top"
            style={{ transform: `scale(${previewZoom})` }}
          >
            <div
              data-callsheet-print-root
              data-callsheet-paper
              className="rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
              style={paperStyle}
            >
              <div className="border-b border-slate-200 bg-slate-50 px-6 py-5 dark:border-slate-700 dark:bg-slate-800">
                {headerEnabled && header ? (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="min-w-0">
                      {(header.left?.items || []).map((item, idx) => renderHeaderItem(item, idx, "left"))}
                    </div>
                    <div className="min-w-0">
                      {(header.center?.items || []).map((item, idx) => renderHeaderItem(item, idx, "center"))}
                    </div>
                    <div className="min-w-0">
                      {(header.right?.items || []).map((item, idx) => renderHeaderItem(item, idx, "right"))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold text-slate-900 dark:text-slate-100">
                        {schedule?.name || "Call Sheet Preview"}
                      </h3>
                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="whitespace-nowrap">{scheduleDate}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">
                      <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="whitespace-nowrap">{sortedEntries.length} items</span>
                    </div>
                  </div>
                )}
              </div>

              <div className={bodyPaddingClassName}>
                <div className={bodySpacingClassName}>
                  {sectionsBeforeSchedule.map((section) => {
                    const content = renderSectionContent(section);
                    if (!content) return null;
                    return <React.Fragment key={section.id}>{content}</React.Fragment>;
                  })}

                  {scheduleVisible ? (
                    <div className="rounded-lg border border-slate-300 dark:border-slate-600">
          {isMultiTrack ? (
            <>
              {/* Multi-track Header - Time + Track Columns */}
              <div className="flex items-stretch border-b-2 border-slate-400 bg-slate-100 dark:border-slate-500 dark:bg-slate-800">
                <div className={`group relative ${getWidthClass(timeColumnWidth)}`}>
                  {allowColumnResize ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-1 px-2 py-2 text-left font-bold uppercase tracking-wider text-slate-700 transition-colors hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                          <span className="truncate">{timeColumnLabel}</span>
                          <ChevronDown className="h-3 w-3 flex-shrink-0 opacity-0 group-hover:opacity-60" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="min-w-[140px]">
                        <div className="px-2 py-1.5 text-xs font-semibold text-slate-500">
                          Column Width
                        </div>
                        {WIDTH_OPTIONS.map((opt) => (
                          <DropdownMenuItem
                            key={opt.value}
                            onClick={() => onColumnResize("time", opt.value)}
                            className="gap-2"
                          >
                            <span className="w-6 text-center font-mono text-xs font-semibold">
                              {opt.label}
                            </span>
                            <span className="flex-1 text-slate-500">{opt.desc}</span>
                            {configuredTimeColumnWidth === opt.value && (
                              <Check className="h-4 w-4 text-amber-600" />
                            )}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <div className="px-2 py-2 font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      {timeColumnLabel}
                    </div>
                  )}
                </div>

                {laneTracks.map((track, trackIndex) => (
                  <div
                    key={track.id}
                    className={`flex min-w-[220px] flex-1 items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 ${
                      trackIndex === 0
                        ? "border-l border-slate-200 dark:border-slate-700"
                        : ""
                    } border-r border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50`}
                    style={{ borderTopColor: track.color, borderTopWidth: 3 }}
                  >
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: track.color }} />
                    <span>{track.name}</span>
                  </div>
                ))}
              </div>

              {/* Multi-track Body */}
              {(() => {
                let globalRowIndex = 0;
                return timeSlots.map((slot) => {
                  const bannerEntries = sharedCustomSlots.get(slot.minutes) || [];
                  const laneEntryCounts = laneTracks.map(
                    (track) => (slot.perTrack.get(track.id) || []).length
                  );
                  const maxLaneCount = Math.max(0, ...laneEntryCounts);
                  const rowCount = maxLaneCount > 0 ? Math.max(1, maxLaneCount) : 0;

                  return (
                    <React.Fragment key={slot.minutes}>
                      {bannerEntries.map((bannerEntry) => {
                        const bannerCategory = bannerEntry.customData?.category;
                        const bannerColor =
                          (bannerCategory &&
                            CUSTOM_ENTRY_CATEGORY_COLORS[bannerCategory]) ||
                          "#64748B";
                        const bannerHeight = baseRowHeight;
                        const appliesTo =
                          Array.isArray(bannerEntry.appliesToTrackIds) &&
                          bannerEntry.appliesToTrackIds.length > 0
                            ? bannerEntry.appliesToTrackIds
                            : laneTracks.map((t) => t.id);
                        const appliesToSet = new Set(
                          appliesTo.filter((id) => laneTracks.some((t) => t.id === id))
                        );
                        const isFullWidthBanner =
                          laneTracks.length > 0 &&
                          laneTracks.every((track) => appliesToSet.has(track.id));
                        const includedByIndex = laneTracks.map((track) =>
                          appliesToSet.has(track.id)
                        );
                        const firstSegmentStartIndex = includedByIndex.findIndex(
                          (included, idx) =>
                            included && (idx === 0 || !includedByIndex[idx - 1])
                        );
                        const rowBg =
                          globalRowIndex % 2 === 0
                            ? "bg-white dark:bg-slate-900"
                            : "bg-slate-50/50 dark:bg-slate-800/30";
                        globalRowIndex += 1;

                        return (
                          <div
                            key={`${slot.minutes}-banner-${bannerEntry.id}`}
                            className={`flex items-stretch border-b border-slate-200 dark:border-slate-700 ${rowBg}`}
                          >
                            <div
                              className={`flex items-center overflow-hidden px-2 py-2 ${getWidthClass(timeColumnWidth)} border-r border-slate-200 dark:border-slate-700`}
                            >
                              <div className="w-full overflow-hidden">
                                {renderCellContent("time", bannerEntry, { showImages: previewShowImages })}
                              </div>
                            </div>
                            {isFullWidthBanner ? (
                              <div className="flex flex-1 items-stretch border-l border-slate-200 px-2 py-2 dark:border-slate-700">
                                <div
                                  className="flex w-full items-center justify-center px-3 py-2 text-center"
                                  style={{
                                    minHeight: bannerHeight,
                                    borderLeftColor: bannerColor,
                                    borderLeftWidth: 3,
                                    backgroundColor: withAlpha(bannerColor, "14"),
                                    borderRadius: 8,
                                  }}
                                >
                                  <div className="flex flex-col items-center">
                                    <span className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">
                                      {getCategoryLabel(bannerCategory)}
                                    </span>
                                    <div className="font-medium text-slate-900 dark:text-slate-100">
                                      {bannerEntry.resolvedTitle || "—"}
                                    </div>
                                    {bannerEntry.description && (
                                      <div className="text-xs text-slate-700 dark:text-slate-300">
                                        {bannerEntry.description}
                                      </div>
                                    )}
                                    {bannerEntry.resolvedLocation && (
                                      <div className="mt-0.5 text-xs text-slate-700 dark:text-slate-300">
                                        <span className="font-semibold">Location:</span>{" "}
                                        {bannerEntry.resolvedLocation}
                                      </div>
                                    )}
                                    {bannerEntry.resolvedNotes && (
                                      <div className="mt-0.5 line-clamp-2 break-words text-xs text-slate-700 dark:text-slate-300">
                                        {bannerEntry.resolvedNotes}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              laneTracks.map((track, trackIndex) => {
                              const included = appliesToSet.has(track.id);
                              const borderSideClass =
                                trackIndex === 0
                                  ? "border-l border-slate-200 dark:border-slate-700"
                                  : "";
                              const cellClasses = `flex min-w-[220px] flex-1 items-stretch border-r border-slate-200 px-2 py-2 dark:border-slate-700 ${borderSideClass}`;

                              if (!included) {
                                return (
                                  <div
                                    key={`${slot.minutes}-banner-${bannerEntry.id}-${track.id}-empty`}
                                    className={cellClasses}
                                  />
                                );
                              }

                              const isSegmentStart =
                                trackIndex === 0 || !includedByIndex[trackIndex - 1];
                              const isSegmentEnd =
                                trackIndex === laneTracks.length - 1 ||
                                !includedByIndex[trackIndex + 1];
                              const showContent =
                                isSegmentStart && trackIndex === firstSegmentStartIndex;

                              return (
                                <div
                                  key={`${slot.minutes}-banner-${bannerEntry.id}-${track.id}`}
                                  className={cellClasses}
                                >
                                  <div
                                    className="flex w-full items-center justify-center px-3 py-2 text-center"
                                    style={{
                                      minHeight: bannerHeight,
                                      borderLeftColor: isSegmentStart
                                        ? bannerColor
                                        : "transparent",
                                      borderLeftWidth: 3,
                                      backgroundColor: withAlpha(bannerColor, "14"),
                                      borderTopLeftRadius: isSegmentStart ? 8 : 0,
                                      borderBottomLeftRadius: isSegmentStart ? 8 : 0,
                                      borderTopRightRadius: isSegmentEnd ? 8 : 0,
                                      borderBottomRightRadius: isSegmentEnd ? 8 : 0,
                                    }}
                                  >
                                    {showContent ? (
                                      <div className="flex flex-col items-center">
                                        <span className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">
                                          {getCategoryLabel(bannerCategory)}
                                        </span>
                                        <div className="font-medium text-slate-900 dark:text-slate-100">
                                          {bannerEntry.resolvedTitle || "—"}
                                        </div>
                                        {bannerEntry.description && (
                                          <div className="text-xs text-slate-700 dark:text-slate-300">
                                            {bannerEntry.description}
                                          </div>
                                        )}
                                        {bannerEntry.resolvedLocation && (
                                          <div className="mt-0.5 text-xs text-slate-700 dark:text-slate-300">
                                            <span className="font-semibold">Location:</span>{" "}
                                            {bannerEntry.resolvedLocation}
                                          </div>
                                        )}
                                        {bannerEntry.resolvedNotes && (
                                          <div className="mt-0.5 line-clamp-2 break-words text-xs text-slate-700 dark:text-slate-300">
                                            {bannerEntry.resolvedNotes}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="select-none text-transparent">—</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                            )}
                          </div>
                        );
                      })}

                      {Array.from({ length: rowCount }).map((_, rowIndex) => {
                        const rowBg =
                          globalRowIndex % 2 === 0
                            ? "bg-white dark:bg-slate-900"
                            : "bg-slate-50/50 dark:bg-slate-800/30";
                        globalRowIndex += 1;
                        const entriesForRow = laneTracks.map((track) => {
                          const trackEntries = slot.perTrack.get(track.id) || [];
                          return trackEntries[rowIndex] || null;
                        });
                        const filledIndices = entriesForRow
                          .map((entry, idx) => (entry ? idx : -1))
                          .filter((idx) => idx !== -1);
                        const shouldSpanRow = laneTracks.length > 1 && filledIndices.length === 1;
                        const spanIndex = shouldSpanRow ? filledIndices[0] : -1;

                        return (
                          <div
                            key={`${slot.minutes}-${rowIndex}`}
                            className={`flex items-stretch border-b border-slate-200 dark:border-slate-700 ${rowBg}`}
                          >
                            <div
                              className={`flex items-center overflow-hidden px-2 py-2 ${getWidthClass(timeColumnWidth)} border-r border-slate-200 dark:border-slate-700`}
                            >
                              {rowIndex === 0 ? (
                                <div className="w-full overflow-hidden">
                                  <div className="font-medium text-slate-900 dark:text-slate-100">
                                    {minutesToTime12h(slot.minutes)}
                                  </div>
                                </div>
                              ) : (
                                <span className="select-none text-transparent">—</span>
                              )}
                            </div>

                            {laneTracks.map((track, trackIndex) => {
                              const entry = entriesForRow[trackIndex];
                              if (shouldSpanRow && trackIndex !== spanIndex) {
                                return null;
                              }
                              const heightPx = baseRowHeight * Math.max(
                                1,
                                (entry?.duration || incrementMinutes) /
                                  incrementMinutes
                              );

                              const borderSideClass =
                                trackIndex === 0 || (shouldSpanRow && trackIndex === spanIndex)
                                  ? "border-l border-slate-200 dark:border-slate-700"
                                  : "";

                              return (
                                <div
                                  key={`${slot.minutes}-${rowIndex}-${track.id}`}
                                  className={`flex min-w-[220px] flex-1 items-stretch border-r border-slate-200 px-2 py-2 dark:border-slate-700 ${borderSideClass}`}
                                  style={shouldSpanRow ? { flexGrow: laneTracks.length } : undefined}
                                >
                                  {entry ? (
                                    entry.type === "custom" ? (
                                      <div
                                        className="flex w-full flex-col justify-center rounded-md border px-2 py-2"
                                        style={{
                                          minHeight: heightPx,
                                          borderColor:
                                            CUSTOM_ENTRY_CATEGORY_COLORS[
                                              entry.customData?.category
                                            ] || track.color,
                                          backgroundColor: withAlpha(
                                            CUSTOM_ENTRY_CATEGORY_COLORS[
                                              entry.customData?.category
                                            ] || track.color,
                                            "14"
                                          ),
                                        }}
                                      >
                                        <div className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">
                                          {getCategoryLabel(
                                            entry.customData?.category
                                          )}
                                        </div>
                                        <div className="font-medium text-slate-900 dark:text-slate-100">
                                          {entry.resolvedTitle || "—"}
                                        </div>
                                        {entry.resolvedDetails && (
                                          <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                            {entry.resolvedDetails}
                                          </div>
                                        )}
                                        {entry.description && (
                                          <div className="text-xs text-slate-700 dark:text-slate-300">
                                            {entry.description}
                                          </div>
                                        )}
                                        {entry.resolvedLocation && (
                                          <div className="mt-0.5 text-xs text-slate-700 dark:text-slate-300">
                                            <span className="font-semibold">Location:</span>{" "}
                                            {entry.resolvedLocation}
                                          </div>
                                        )}
                                        {entry.resolvedNotes && (
                                          <div className="mt-0.5 line-clamp-2 break-words text-xs text-slate-700 dark:text-slate-300">
                                            {entry.resolvedNotes}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div
                                        className="flex w-full flex-col gap-1 rounded-md border px-2 py-2"
                                        style={{
                                          minHeight: heightPx,
                                          borderColor: track.color,
                                          backgroundColor: withAlpha(
                                            track.color,
                                            "10"
                                          ),
                                        }}
                                      >
                                        {showDurations && (
                                          <div className="flex justify-end">
                                            <div className="text-xs italic text-slate-600 dark:text-slate-400">
                                              {formatDuration(entry.duration)}
                                            </div>
                                          </div>
                                        )}
                                        {(() => {
                                          const hasInlineImageColumn = nonTimeColumns.some((col) => col.key === "image");
                                          const hasDescriptionColumn = nonTimeColumns.some(
                                            (col) => col.key === "description"
                                          );
                                          const showThumbnailInDescription =
                                            previewShowImages && !hasInlineImageColumn && hasDescriptionColumn && entry.resolvedImage;
                                          const showFallbackImage =
                                            previewShowImages && !hasInlineImageColumn && !hasDescriptionColumn && entry.resolvedImage;

                                          return (
                                            <>
                                              {showFallbackImage ? (
                                                <div className="w-full overflow-hidden rounded bg-slate-100 dark:bg-slate-700 aspect-video flex items-center justify-center">
                                                  <AppImage
                                                    src={entry.resolvedImage}
                                                    alt=""
                                                    fit="cover"
                                                    className="h-full w-full"
                                                    imageClassName="h-full w-full"
                                                    position={entry.resolvedImagePosition}
                                                    fallback={
                                                      <div className="flex h-full w-full items-center justify-center">
                                                        <ImageIcon className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                                                      </div>
                                                    }
                                                  />
                                                </div>
                                              ) : null}

                                              {nonTimeColumns.map((col) => {
                                                switch (col.key) {
                                            case "shot":
                                              return (
                                                <div
                                                  key="shot"
                                                  className="text-xs font-semibold text-slate-900 dark:text-slate-100"
                                                >
                                                  {entry.shotNumber || "—"}
                                                </div>
                                              );
		                                            case "description":
		                                              return (
		                                                <div key="description" className="flex gap-2">
		                                                  {showThumbnailInDescription ? (
		                                                    <div className="mt-0.5 w-20 flex-shrink-0 overflow-hidden rounded bg-slate-100 dark:bg-slate-700 aspect-[4/3] flex items-center justify-center">
		                                                      <AppImage
		                                                        src={entry.resolvedImage}
		                                                        alt=""
		                                                        fit="cover"
		                                                        className="h-full w-full"
		                                                        imageClassName="h-full w-full"
		                                                        position={entry.resolvedImagePosition}
		                                                        fallback={
		                                                          <div className="flex h-full w-full items-center justify-center">
		                                                            <ImageIcon className="h-5 w-5 text-slate-400 dark:text-slate-500" />
		                                                          </div>
		                                                        }
		                                                      />
		                                                    </div>
		                                                  ) : null}
		                                                  <div className="min-w-0 flex-1 flex flex-col gap-0.5">
		                                                    <div className="font-medium text-slate-900 dark:text-slate-100">
		                                                      {entry.resolvedTitle || "—"}
		                                                    </div>
		                                                    {entry.resolvedDetails && (
		                                                      <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
		                                                        {entry.resolvedDetails}
		                                                      </div>
		                                                    )}
		                                                    {entry.description && (
		                                                      <div className="line-clamp-2 text-xs text-slate-700 dark:text-slate-300">
		                                                        {entry.description}
		                                                      </div>
		                                                    )}
		                                                  </div>
		                                                </div>
		                                              );
                                            case "talent":
                                              if (!entry.resolvedTalent?.length) return null;
                                              return (
                                                <div key="talent" className="text-xs text-slate-700 dark:text-slate-300">
                                                  <span className="font-semibold">Talent:</span>{" "}
                                                  {entry.resolvedTalent
                                                    .map((t) => (typeof t === "string" ? t : t.name))
                                                    .filter(Boolean)
                                                    .join(", ")}
                                                </div>
                                              );
                                            case "products":
                                              if (!entry.resolvedProducts?.length) return null;
                                              return (
                                                <div key="products" className="text-xs text-slate-700 dark:text-slate-300">
                                                  <span className="font-semibold">Products:</span>{" "}
                                                  {entry.resolvedProducts
                                                    .slice(0, 3)
                                                    .map((p) => (typeof p === "string" ? p : p.name || p.familyName))
                                                    .join(", ")}
                                                  {entry.resolvedProducts.length > 3 && "..."}
                                                </div>
                                              );
                                            case "location":
                                              if (!entry.resolvedLocation) return null;
                                              return (
                                                <div key="location" className="text-xs text-slate-700 dark:text-slate-300">
                                                  <span className="font-semibold">Location:</span>{" "}
                                                  {entry.resolvedLocation}
                                                </div>
                                              );
                                            case "notes":
                                              if (!entry.resolvedNotes) return null;
                                              return (
                                                <div key="notes" className="line-clamp-2 break-words text-xs text-slate-700 dark:text-slate-300">
                                                  {entry.resolvedNotes}
                                                </div>
                                              );
                                            case "image":
                                              if (!previewShowImages || !entry.resolvedImage) return null;
		                                              return (
		                                                <div
		                                                  key="image"
		                                                  className="mt-1 w-full overflow-hidden rounded bg-slate-100 dark:bg-slate-700 aspect-video flex items-center justify-center"
		                                                >
		                                                  <AppImage
		                                                    src={entry.resolvedImage}
		                                                    alt=""
		                                                    fit="cover"
		                                                    className="h-full w-full"
		                                                    imageClassName="h-full w-full"
		                                                    position={entry.resolvedImagePosition}
		                                                    fallback={
		                                                      <div className="flex h-full w-full items-center justify-center">
		                                                        <ImageIcon className="h-5 w-5 text-slate-400 dark:text-slate-500" />
		                                                      </div>
		                                                    }
		                                                  />
		                                                </div>
		                                              );
                                            default:
                                              return null;
                                          }
                                        })}
                                            </>
                                          );
                                        })()}
                                      </div>
                                    )
                                  ) : (
                                    <div className="flex w-full items-center justify-center text-slate-300 dark:text-slate-600">
                                      —
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </React.Fragment>
                  );
                });
              })()}
            </>
          ) : (
            <>
              {/* Single-track Header */}
              <div className="flex items-center border-b-2 border-slate-400 bg-slate-100 dark:border-slate-500 dark:bg-slate-800">
                {singleTrackColumns.map((col) => (
                  <div
                    key={col.key}
                    className={`group relative ${
                      col.key === "time"
                        ? getWidthClass(timeColumnWidth)
                        : getWidthClass(col.width)
                    }`}
                  >
                    {allowColumnResize ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="flex w-full items-center justify-between gap-1 px-2 py-2 text-left font-bold uppercase tracking-wider text-slate-700 transition-colors hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700"
                          >
                            <span className="truncate">
                              {col.key === "time" ? timeColumnLabel : col.label}
                            </span>
                            <ChevronDown className="h-3 w-3 flex-shrink-0 opacity-0 group-hover:opacity-60" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="min-w-[140px]">
                          <div className="px-2 py-1.5 text-xs font-semibold text-slate-500">
                            Column Width
                          </div>
                          {WIDTH_OPTIONS.map((opt) => (
                            <DropdownMenuItem
                              key={opt.value}
                              onClick={() => onColumnResize(col.key, opt.value)}
                              className="gap-2"
                            >
                              <span className="w-6 text-center font-mono text-xs font-semibold">
                                {opt.label}
                              </span>
                              <span className="flex-1 text-slate-500">{opt.desc}</span>
                              {(col.key === "time"
                                ? configuredTimeColumnWidth
                                : col.width) === opt.value && (
                                <Check className="h-4 w-4 text-amber-600" />
                              )}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <div className="px-2 py-2 font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        {col.key === "time" ? timeColumnLabel : col.label}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Single-track Body */}
              {sortedEntries.map((entry, entryIndex) => {
                const rowBg =
                  entryIndex % 2 === 0
                    ? "bg-white dark:bg-slate-900"
                    : "bg-slate-50/50 dark:bg-slate-800/30";

                if (entry.type === "custom") {
                  const bannerCategory = entry.customData?.category;
                  const bannerColor =
                    (bannerCategory &&
                      CUSTOM_ENTRY_CATEGORY_COLORS[bannerCategory]) ||
                    "#64748B";

                  return (
                    <div
                      key={entry.id}
                      className={`flex items-stretch border-b border-slate-200 dark:border-slate-700 ${rowBg}`}
                    >
                      <div
                        className={`flex items-center overflow-hidden px-2 py-2 ${getWidthClass(timeColumnWidth)} border-r border-slate-200 dark:border-slate-700`}
                      >
                        <div className="w-full overflow-hidden">
                          {renderCellContent("time", entry, { showImages: previewShowImages })}
                        </div>
                      </div>
                      <div
                        className="flex flex-1 items-center px-3 py-2"
                        style={{
                          borderLeftColor: bannerColor,
                          borderLeftWidth: 3,
                          backgroundColor: withAlpha(bannerColor, "14"),
                        }}
                      >
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">
                            {getCategoryLabel(bannerCategory)}
                          </span>
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {entry.resolvedTitle || "—"}
                          </div>
                          {entry.description && (
                            <div className="text-xs text-slate-700 dark:text-slate-300">
                              {entry.description}
                            </div>
                          )}
                          {entry.resolvedLocation && (
                            <div className="mt-0.5 text-xs text-slate-700 dark:text-slate-300">
                              <span className="font-semibold">Location:</span> {entry.resolvedLocation}
                            </div>
                          )}
                          {entry.resolvedNotes && (
                            <div className="mt-0.5 line-clamp-2 break-words text-xs text-slate-700 dark:text-slate-300">
                              {entry.resolvedNotes}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={entry.id}
                    className={`flex items-stretch border-b border-slate-200 dark:border-slate-700 ${rowBg}`}
                  >
                    {singleTrackColumns.map((col, colIndex) => (
                      <div
                        key={col.key}
                        className={`flex items-center overflow-hidden px-2 py-2 ${
                          col.key === "time"
                            ? getWidthClass(timeColumnWidth)
                            : getWidthClass(col.width)
                        } ${
                          colIndex < singleTrackColumns.length - 1
                            ? "border-r border-slate-200 dark:border-slate-700"
                            : ""
                        }`}
                      >
                        <div className="w-full overflow-hidden">
                          {renderCellContent(col.key, entry, { showImages: previewShowImages })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </>
          )}

          {/* Empty State */}
          {sortedEntries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <FileText className="mb-2 h-8 w-8" />
              <p>No entries to preview</p>
              <p className="text-xs">Add items to the schedule to see them here</p>
            </div>
          )}
                    </div>
                  ) : null}

                  {sectionsAfterSchedule.map((section) => {
                    const content = renderSectionContent(section);
                    if (!content) return null;
                    return <React.Fragment key={section.id}>{content}</React.Fragment>;
                  })}
                </div>

        {/* Talent Summary (from schedule only; shown when roster section is disabled) */}
        {!talentEnabled && sortedEntries.some((e) => e.resolvedTalent?.length > 0) && (
          <div className="mt-6">
            <h4 className="mb-2 flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300">
              <Users className="h-4 w-4" />
              Talent
            </h4>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="flex border-b border-slate-300 bg-slate-100 dark:border-slate-600 dark:bg-slate-800">
                <div className="w-48 px-3 py-2 font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Name
                </div>
                <div className="flex-1 px-3 py-2 font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Appears In
                </div>
              </div>
              {/* Unique talent list */}
              {(() => {
                // Extract unique talent names
                const talentNames = new Set();
                sortedEntries.forEach((e) => {
                  (e.resolvedTalent || []).forEach((t) => {
                    const name = typeof t === "string" ? t : t.name;
                    if (name) talentNames.add(name);
                  });
                });
                return Array.from(talentNames);
              })().map((talentName, idx) => (
                <div
                  key={talentName}
                  className={`flex border-b border-slate-200 dark:border-slate-700 ${
                    idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-800/30"
                  }`}
                >
                  <div className="w-48 px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
                    {talentName}
                  </div>
                  <div className="flex-1 px-3 py-2 text-slate-600 dark:text-slate-400">
                    {sortedEntries
                      .filter((e) =>
                        (e.resolvedTalent || []).some(
                          (t) => (typeof t === "string" ? t : t.name) === talentName
                        )
                      )
                      .map((e) => e.resolvedTitle || `Shot ${e.shotNumber}`)
                      .slice(0, 5)
                      .join(", ")}
                    {sortedEntries.filter((e) =>
                      (e.resolvedTalent || []).some(
                        (t) => (typeof t === "string" ? t : t.name) === talentName
                      )
                    ).length > 5 && "..."}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes Summary */}
        {sortedEntries.some((e) => e.resolvedNotes) && (
          <div className="mt-6">
            <h4 className="mb-2 flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300">
              <FileText className="h-4 w-4" />
              Notes
            </h4>
            <div className="space-y-2">
              {sortedEntries
                .filter((e) => e.resolvedNotes)
                .map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50"
                  >
                    <div className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                      {formatTime12h(entry.startTime)} — {entry.resolvedTitle}
                    </div>
                    <p className="text-slate-700 dark:text-slate-300">
                      {entry.resolvedNotes}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CallSheetPreview;
