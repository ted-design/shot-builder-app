// src/components/callsheet/vertical/CallSheetTimelinePreview.jsx
// Call-sheet style preview with a vertical time ruler and duration-proportional blocks.

import React, { useMemo, useState, useCallback } from "react";
import { Calendar, Clock } from "lucide-react";
import { CUSTOM_ENTRY_CATEGORY_COLORS } from "../../../types/schedule";
import { minutesToTime12h, parseTimeToMinutes } from "../../../lib/timeUtils";
import { sortEntriesByTime } from "../../../lib/cascadeEngine";

function withAlpha(hex, alphaHex) {
  if (!hex || typeof hex !== "string") return hex;
  const normalized = hex.startsWith("#") ? hex.slice(1) : hex;
  if (normalized.length !== 6) return hex;
  return `#${normalized}${alphaHex}`;
}

function formatDuration(minutes) {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}hr`;
  return `${h}h ${m}m`;
}

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

function getSharedAppliesTo(entry, laneTracks) {
  const appliesTo =
    Array.isArray(entry.appliesToTrackIds) && entry.appliesToTrackIds.length > 0
      ? entry.appliesToTrackIds
      : laneTracks.map((t) => t.id);
  return laneTracks.filter((t) => appliesTo.includes(t.id)).map((t) => t.id);
}

function CallSheetTimelinePreview({ schedule, entries = [], tracks = [], zoomLevel = 1 }) {
  const sortedEntries = useMemo(() => sortEntriesByTime(entries), [entries]);
  const [selectedEntryId, setSelectedEntryId] = useState(null);

  const orderedTracks = useMemo(() => {
    return [...tracks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [tracks]);

  const sharedTrackIds = useMemo(() => {
    return new Set(
      orderedTracks
        .filter((track) => track.scope === "shared" || track.id === "shared")
        .map((track) => track.id)
    );
  }, [orderedTracks]);

  const laneTracks = useMemo(() => {
    return orderedTracks.filter((track) => !sharedTrackIds.has(track.id));
  }, [orderedTracks, sharedTrackIds]);

  const sharedEntries = useMemo(() => {
    return sortedEntries.filter((entry) => entry.type === "custom" && sharedTrackIds.has(entry.trackId));
  }, [sortedEntries, sharedTrackIds]);

  const laneEntriesByTrack = useMemo(() => {
    const map = new Map();
    laneTracks.forEach((track) => map.set(track.id, []));
    sortedEntries.forEach((entry) => {
      if (!map.has(entry.trackId)) return;
      map.get(entry.trackId).push(entry);
    });
    for (const [trackId, list] of map.entries()) {
      map.set(
        trackId,
        [...list].sort((a, b) => {
          const am = parseTimeToMinutes(a.startTime);
          const bm = parseTimeToMinutes(b.startTime);
          if (am !== bm) return am - bm;
          return (a.order ?? 0) - (b.order ?? 0);
        })
      );
    }
    return map;
  }, [sortedEntries, laneTracks]);

  const range = useMemo(() => {
    if (sortedEntries.length === 0) return null;
    let min = null;
    let max = null;
    sortedEntries.forEach((entry) => {
      const start = parseTimeToMinutes(entry.startTime);
      const duration = typeof entry.duration === "number" ? Math.max(0, entry.duration) : 0;
      const end = start + duration;
      if (min == null || start < min) min = start;
      if (max == null || end > max) max = end;
    });
    if (min == null || max == null) return null;

    const tick = 30;
    const roundDown = (value) => Math.floor(value / tick) * tick;
    const roundUp = (value) => Math.ceil(value / tick) * tick;
    const startMinutes = roundDown(min);
    const endMinutes = Math.max(startMinutes + tick, roundUp(max));

    const majorTicks = [];
    const minorTicks = [];
    for (let m = startMinutes; m <= endMinutes; m += tick) {
      if (m % 60 === 0) majorTicks.push(m);
      else minorTicks.push(m);
    }
    return { startMinutes, endMinutes, majorTicks, minorTicks, tickMinutes: tick };
  }, [sortedEntries]);

  const scheduleDate = schedule?.date
    ? new Date(schedule.date).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Schedule Date";

  const previewZoom = typeof zoomLevel === "number" && zoomLevel > 0 ? zoomLevel : 1;
  const pxPerMinute = 2.2;
  const heightPx =
    range != null ? Math.max(1, (range.endMinutes - range.startMinutes) * pxPerMinute) : 1;

  const selectedEntry = useMemo(() => {
    if (!selectedEntryId) return null;
    return sortedEntries.find((entry) => entry.id === selectedEntryId) || null;
  }, [sortedEntries, selectedEntryId]);

  const handleSelectEntry = useCallback((entryId) => {
    setSelectedEntryId(entryId);
  }, []);

  if (!range || laneTracks.length === 0) {
    return (
      <div className="flex h-full flex-col overflow-hidden bg-white text-sm dark:bg-slate-900">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                {schedule?.name || "Call Sheet Preview"}
              </h3>
              <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {scheduleDate}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {sortedEntries.length} items
                </span>
              </div>
            </div>
            <span className="text-xs text-slate-400">Live Preview</span>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-slate-500 dark:text-slate-400">
          No entries to preview
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white text-sm dark:bg-slate-900">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">
              {schedule?.name || "Call Sheet Preview"}
            </h3>
            <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {scheduleDate}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {sortedEntries.length} items
              </span>
              <span className="hidden sm:inline">Click a block for details</span>
            </div>
          </div>
          <span className="text-xs text-slate-400">Live Preview</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-3">
          <div style={{ zoom: previewZoom }} className="rounded-lg border border-slate-300 dark:border-slate-600">
            {/* Header */}
            <div className="flex items-stretch border-b-2 border-slate-400 bg-slate-100 dark:border-slate-500 dark:bg-slate-800">
              <div className="w-28 min-w-[112px] flex-shrink-0 px-2 py-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Time
              </div>
              {laneTracks.map((track, idx) => (
                <div
                  key={track.id}
                  className={`flex min-w-[220px] flex-1 items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 ${
                    idx === 0 ? "border-l border-slate-200 dark:border-slate-700" : ""
                  } border-r border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50`}
                  style={{ borderTopColor: track.color, borderTopWidth: 3 }}
                >
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: track.color }} />
                  <span>{track.name}</span>
                </div>
              ))}
            </div>

            {/* Body */}
            <div className="relative flex items-stretch" style={{ height: heightPx }}>
              {/* Gridlines */}
              <div className="pointer-events-none absolute inset-0">
                {range.minorTicks.map((minutes) => (
                  <div
                    key={`minor-${minutes}`}
                    className="absolute left-0 right-0 border-t border-slate-100 dark:border-slate-800"
                    style={{ top: (minutes - range.startMinutes) * pxPerMinute }}
                  />
                ))}
                {range.majorTicks.map((minutes) => (
                  <div
                    key={`major-${minutes}`}
                    className="absolute left-0 right-0 border-t border-slate-200 dark:border-slate-700"
                    style={{ top: (minutes - range.startMinutes) * pxPerMinute }}
                  />
                ))}
              </div>

              {/* Time ruler */}
              <div className="relative w-28 min-w-[112px] flex-shrink-0 border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                {[...range.majorTicks, ...range.minorTicks]
                  .sort((a, b) => a - b)
                  .map((minutes) => (
                    <div
                      key={`label-${minutes}`}
                      className="absolute left-0 right-0 pr-2 text-right"
                      style={{ top: (minutes - range.startMinutes) * pxPerMinute }}
                    >
                      <div
                        className={`inline-block rounded px-1 py-0.5 text-[11px] tabular-nums ${
                          minutes % 60 === 0
                            ? "bg-white/90 font-semibold text-slate-700 dark:bg-slate-900/90 dark:text-slate-200"
                            : "bg-white/80 font-medium text-slate-500 dark:bg-slate-900/80 dark:text-slate-400"
                        }`}
                      >
                        {minutesToTime12h(minutes)}
                      </div>
                    </div>
                  ))}
              </div>

              {/* Track columns */}
              <div className="relative flex flex-1">
                {laneTracks.map((track, trackIndex) => {
                  const laneEntries = laneEntriesByTrack.get(track.id) || [];
                  const sharedForTrack = sharedEntries.filter((entry) =>
                    getSharedAppliesTo(entry, laneTracks).includes(track.id)
                  );

                  return (
                    <div
                      key={track.id}
                      className={`relative min-w-[220px] flex-1 border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 ${
                        trackIndex === 0 ? "border-l border-slate-200 dark:border-slate-700" : ""
                      }`}
                    >
                      {sharedForTrack.map((entry) => {
                        const startMinutes = parseTimeToMinutes(entry.startTime);
                        const duration = typeof entry.duration === "number" ? Math.max(0, entry.duration) : 0;
                        const endMinutes = startMinutes + duration;
                        const top = (startMinutes - range.startMinutes) * pxPerMinute;
                        const height = Math.max(22, duration * pxPerMinute);
                        const category = entry.customData?.category;
                        const color = (category && CUSTOM_ENTRY_CATEGORY_COLORS[category]) || "#64748B";

                        const appliesOrdered = getSharedAppliesTo(entry, laneTracks);
                        const first = appliesOrdered[0];
                        const last = appliesOrdered[appliesOrdered.length - 1];
                        const showContent = track.id === first;
                        const radius =
                          track.id === first && track.id === last
                            ? "rounded-md"
                            : track.id === first
                            ? "rounded-l-md"
                            : track.id === last
                            ? "rounded-r-md"
                            : "rounded-none";
                        const isSelected = selectedEntryId === entry.id;

                        return (
                          <button
                            key={`shared-${entry.id}-${track.id}`}
                            type="button"
                            onClick={() => handleSelectEntry(entry.id)}
                            className={`absolute left-2 right-2 z-10 overflow-hidden border px-2 py-1 text-left focus:outline-none focus:ring-2 focus:ring-amber-400/60 ${radius} ${
                              isSelected ? "ring-2 ring-amber-400/70" : ""
                            }`}
                            style={{
                              top,
                              height,
                              borderColor: isSelected ? "#F59E0B" : color,
                              backgroundColor: withAlpha(color, "14"),
                            }}
                            title="Click for details"
                          >
                            {showContent ? (
                              <div className="flex h-full flex-col justify-center">
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                                  {minutesToTime12h(startMinutes)}–{minutesToTime12h(endMinutes)}
                                </div>
                                <div className="truncate text-[11px] font-semibold uppercase text-slate-700 dark:text-slate-300">
                                  {getCategoryLabel(category)}
                                </div>
                                <div className="truncate text-xs font-medium text-slate-900 dark:text-slate-100">
                                  {entry.resolvedTitle || "—"}
                                </div>
                              </div>
                            ) : null}
                          </button>
                        );
                      })}

                      {laneEntries.map((entry) => {
                        const startMinutes = parseTimeToMinutes(entry.startTime);
                        const duration = typeof entry.duration === "number" ? Math.max(0, entry.duration) : 0;
                        const endMinutes = startMinutes + duration;
                        const top = (startMinutes - range.startMinutes) * pxPerMinute;
                        const height = Math.max(24, duration * pxPerMinute);
                        const density = height < 36 ? "xs" : height < 52 ? "sm" : "md";
                        const isSelected = selectedEntryId === entry.id;

                        if (entry.type === "custom") {
                          const category = entry.customData?.category;
                          const color = (category && CUSTOM_ENTRY_CATEGORY_COLORS[category]) || track.color;
                          return (
                            <button
                              key={entry.id}
                              type="button"
                              onClick={() => handleSelectEntry(entry.id)}
                              className={`absolute left-2 right-2 z-20 overflow-hidden rounded-md border px-2 text-left focus:outline-none focus:ring-2 focus:ring-amber-400/60 ${
                                isSelected ? "ring-2 ring-amber-400/70" : ""
                              }`}
                              style={{
                                top,
                                height,
                                borderColor: isSelected ? "#F59E0B" : color,
                                backgroundColor: withAlpha(color, "14"),
                                paddingTop: density === "xs" ? 2 : 6,
                                paddingBottom: density === "xs" ? 2 : 6,
                              }}
                              title="Click for details"
                            >
                              <div className="flex items-start justify-between gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                                <span className="truncate">
                                  {minutesToTime12h(startMinutes)}–{minutesToTime12h(endMinutes)}
                                </span>
                                {density === "md" ? <span>{formatDuration(duration)}</span> : null}
                              </div>
                              {density !== "xs" ? (
                                <div className="mt-0.5 truncate text-[10px] font-semibold uppercase text-slate-600 dark:text-slate-400">
                                  {getCategoryLabel(category)}
                                </div>
                              ) : null}
                              <div className="truncate text-xs font-medium text-slate-900 dark:text-slate-100">
                                {entry.resolvedTitle || "—"}
                              </div>
                            </button>
                          );
                        }

                        return (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => handleSelectEntry(entry.id)}
                            className={`absolute left-2 right-2 z-30 overflow-hidden rounded-md border px-2 text-left focus:outline-none focus:ring-2 focus:ring-amber-400/60 ${
                              isSelected ? "ring-2 ring-amber-400/70" : ""
                            }`}
                            style={{
                              top,
                              height,
                              borderColor: isSelected ? "#F59E0B" : track.color,
                              backgroundColor: withAlpha(track.color, "10"),
                              paddingTop: density === "xs" ? 2 : 6,
                              paddingBottom: density === "xs" ? 2 : 6,
                            }}
                            title="Click for details"
                          >
                            <div className="flex items-start justify-between gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                              <span className="truncate">
                                {minutesToTime12h(startMinutes)}–{minutesToTime12h(endMinutes)}
                              </span>
                              {density === "md" ? <span>{formatDuration(duration)}</span> : null}
                            </div>
                            <div className="truncate text-xs font-medium text-slate-900 dark:text-slate-100">
                              {entry.resolvedTitle || "—"}
                            </div>
                            {density === "md" && entry.resolvedDetails ? (
                              <div className="mt-0.5 truncate text-[11px] text-slate-600 dark:text-slate-400">
                                {entry.resolvedDetails}
                              </div>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            {selectedEntry ? (
              (() => {
                const startMinutes = parseTimeToMinutes(selectedEntry.startTime);
                const duration = typeof selectedEntry.duration === "number" ? Math.max(0, selectedEntry.duration) : 0;
                const endMinutes = startMinutes + duration;
                const isShot = selectedEntry.type === "shot";
                const isCustom = selectedEntry.type === "custom";
                const category = selectedEntry.customData?.category;
                const track = laneTracks.find((t) => t.id === selectedEntry.trackId) || tracks.find((t) => t.id === selectedEntry.trackId);

                return (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {selectedEntry.resolvedTitle || "—"}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {minutesToTime12h(startMinutes)}–{minutesToTime12h(endMinutes)} • {formatDuration(duration)}
                          {track?.name ? ` • ${track.name}` : ""}
                        </div>
                      </div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {isShot ? "Shot" : isCustom ? getCategoryLabel(category) : selectedEntry.type}
                      </div>
                    </div>

                    {selectedEntry.resolvedDetails ? (
                      <div className="text-xs text-slate-700 dark:text-slate-300">
                        {selectedEntry.resolvedDetails}
                      </div>
                    ) : null}

                    {selectedEntry.description ? (
                      <div className="text-xs text-slate-700 dark:text-slate-300">
                        {selectedEntry.description}
                      </div>
                    ) : null}

                    {selectedEntry.resolvedTalent?.length ? (
                      <div className="text-xs text-slate-700 dark:text-slate-300">
                        <span className="font-semibold">Talent:</span>{" "}
                        {selectedEntry.resolvedTalent
                          .map((t) => (typeof t === "string" ? t : t.name))
                          .filter(Boolean)
                          .join(", ")}
                      </div>
                    ) : null}

                    {selectedEntry.resolvedProducts?.length ? (
                      <div className="text-xs text-slate-700 dark:text-slate-300">
                        <span className="font-semibold">Products:</span>{" "}
                        {selectedEntry.resolvedProducts
                          .map((p) => (typeof p === "string" ? p : p.name || p.familyName))
                          .filter(Boolean)
                          .join(", ")}
                      </div>
                    ) : null}

                    {selectedEntry.resolvedLocation ? (
                      <div className="text-xs text-slate-700 dark:text-slate-300">
                        <span className="font-semibold">Location:</span> {selectedEntry.resolvedLocation}
                      </div>
                    ) : null}

                    {selectedEntry.resolvedNotes ? (
                      <div className="text-xs text-slate-700 dark:text-slate-300">
                        <span className="font-semibold">Notes:</span> {selectedEntry.resolvedNotes}
                      </div>
                    ) : null}
                  </div>
                );
              })()
            ) : (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Click an entry block to view details.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CallSheetTimelinePreview;
