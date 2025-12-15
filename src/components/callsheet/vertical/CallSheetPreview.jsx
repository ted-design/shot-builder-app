// src/components/callsheet/vertical/CallSheetPreview.jsx
// Live preview table for the call sheet (SetHero style right panel)

import React, { useMemo, useEffect, useState } from "react";
import { Clock, Calendar, Users, FileText, ChevronDown, Check, Image as ImageIcon } from "lucide-react";
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
import { sortEntriesByTime } from "../../../lib/cascadeEngine";
import { minutesToTime12h, parseTimeToMinutes } from "../../../lib/timeUtils";
import AppImage from "../../common/AppImage";

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

/**
 * Format time from 24h to 12h format
 */
function formatTime12h(timeStr) {
  if (!timeStr) return "—";
  const minutes = parseTimeToMinutes(timeStr);
  return minutesToTime12h(minutes);
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
  onColumnResize,
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
  // Sort entries by start time
  const sortedEntries = useMemo(() => {
    return sortEntriesByTime(entries);
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
              className="w-[816px] min-h-[1056px] rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="border-b border-slate-200 bg-slate-50 px-6 py-5 dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-start justify-between gap-6">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-slate-900 dark:text-slate-100">
                      {schedule?.name || "Call Sheet Preview"}
                    </h3>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <Calendar className="h-3.5 w-3.5" />
                      <span className="truncate">{scheduleDate}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <Clock className="h-3.5 w-3.5" />
                    {sortedEntries.length} items
                  </div>
                </div>
              </div>

              <div className="px-6 py-6">
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

        {/* Talent Summary (if any shots have talent) */}
        {sortedEntries.some((e) => e.resolvedTalent?.length > 0) && (
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
