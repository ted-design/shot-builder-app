// src/components/callsheet/timeline/TimelineView.jsx
// Multi-lane timeline view with shared strip overlay
// Renders a horizontal time-based layout with swimlanes per track

import React, { useMemo, useState, useRef, useCallback } from "react";
import { Clock, Layers } from "lucide-react";
import {
  parseTimeToMinutes,
  minutesToTime12h,
  generateTimeSlots,
  minutesToTimeString,
} from "../../../lib/timeUtils";

/**
 * Compute overlap layout metadata for a list of entries within a single lane.
 * Uses a greedy column assignment algorithm to split overlapping blocks horizontally.
 *
 * @param {Array} entries - Entries for a single track
 * @param {Function} parseTime - Function to parse time string to minutes
 * @returns {Map} Map of entry.id -> { colIndex, colCount }
 */
function computeOverlapLayout(entries, parseTime) {
  if (!entries || entries.length === 0) {
    return new Map();
  }

  // Parse each entry's start/end times
  const parsed = entries.map((entry) => {
    const startMin = parseTime(entry.startTime || "00:00");
    const duration = typeof entry.duration === "number" ? entry.duration : 15;
    const endMin = startMin + duration;
    return { id: entry.id, startMin, endMin };
  });

  // Sort by start time, then by end time
  parsed.sort((a, b) => {
    if (a.startMin !== b.startMin) return a.startMin - b.startMin;
    return a.endMin - b.endMin;
  });

  // Greedy column assignment with cluster tracking
  // Each column tracks the latest end time in that column
  const colEndTimes = []; // colEndTimes[i] = latest endMin in column i
  const assignments = new Map(); // entry.id -> { colIndex, clusterStart }

  // Track clusters: entries that overlap with each other share a cluster
  // clusterMaxCols[clusterStart] = max columns used in that cluster
  const clusterMaxCols = new Map();
  let currentClusterStart = null;

  for (const item of parsed) {
    // Find the first available column (where colEndTimes[col] <= item.startMin)
    let assignedCol = -1;
    for (let col = 0; col < colEndTimes.length; col++) {
      if (colEndTimes[col] <= item.startMin) {
        assignedCol = col;
        break;
      }
    }

    // Check if this entry starts a new cluster
    // A new cluster starts if no active columns overlap with this entry
    const isNewCluster = assignedCol === 0 && colEndTimes.length > 0 && colEndTimes.every((t) => t <= item.startMin);

    if (isNewCluster || currentClusterStart === null) {
      // Finalize previous cluster's colCount
      if (currentClusterStart !== null) {
        clusterMaxCols.set(currentClusterStart, colEndTimes.length);
      }
      // Start new cluster
      currentClusterStart = item.id;
      colEndTimes.length = 0; // Reset columns for new cluster
      assignedCol = -1; // Re-evaluate for new cluster
    }

    // If no available column, create a new one
    if (assignedCol === -1) {
      assignedCol = colEndTimes.length;
      colEndTimes.push(item.endMin);
    } else {
      colEndTimes[assignedCol] = item.endMin;
    }

    assignments.set(item.id, { colIndex: assignedCol, clusterStart: currentClusterStart });
  }

  // Finalize last cluster
  if (currentClusterStart !== null) {
    clusterMaxCols.set(currentClusterStart, colEndTimes.length);
  }

  // Build final result with colCount from cluster
  const result = new Map();
  for (const [id, { colIndex, clusterStart }] of assignments) {
    const colCount = clusterMaxCols.get(clusterStart) || 1;
    result.set(id, { colIndex, colCount });
  }

  return result;
}

/**
 * TimelineView - Multi-lane timeline rendering with shared strip
 *
 * @param {object} props
 * @param {Array} props.entries - Resolved schedule entries
 * @param {Array} props.tracks - Tracks array
 * @param {object} props.settings - Schedule settings
 * @param {Function} props.onEditEntry - Callback for editing custom entries
 * @param {Function} props.onEditShotEntry - Callback for editing shot entries
 */
function TimelineView({ entries = [], tracks = [], settings = {}, onEditEntry, onEditShotEntry }) {
  // Identify shared track IDs
  const sharedTrackIds = useMemo(() => {
    const ids = new Set();
    tracks.forEach((track) => {
      if (track.scope === "shared" || track.id === "shared") {
        ids.add(track.id);
      }
    });
    return ids;
  }, [tracks]);

  // Filter entries into shared vs lane
  const sharedEntries = useMemo(() => {
    return entries.filter((entry) => sharedTrackIds.has(entry.trackId));
  }, [entries, sharedTrackIds]);

  const laneEntries = useMemo(() => {
    return entries.filter((entry) => !sharedTrackIds.has(entry.trackId));
  }, [entries, sharedTrackIds]);

  // Compute time range for the timeline
  const { minMinutes, maxMinutes, rangeMinutes } = useMemo(() => {
    // Gather all entry times (both shared and lane for global range)
    const allEntries = entries.length > 0 ? entries : [];
    let earliest = null;
    let latest = null;

    allEntries.forEach((entry) => {
      const start = parseTimeToMinutes(entry.startTime || "00:00");
      const duration = typeof entry.duration === "number" ? entry.duration : 15;
      const end = start + duration;

      if (earliest === null || start < earliest) earliest = start;
      if (latest === null || end > latest) latest = end;
    });

    // Fallback: 6AM to 6PM (12 hour window) if no entries
    if (earliest === null || latest === null) {
      const fallbackStart = parseTimeToMinutes(settings.dayStartTime || "06:00");
      return {
        minMinutes: fallbackStart,
        maxMinutes: fallbackStart + 12 * 60,
        rangeMinutes: 12 * 60,
      };
    }

    // Add small padding (30 min each side) for visual comfort
    const paddedMin = Math.max(0, earliest - 30);
    const paddedMax = Math.min(24 * 60, latest + 30);
    const range = paddedMax - paddedMin;

    return {
      minMinutes: paddedMin,
      maxMinutes: paddedMax,
      rangeMinutes: range > 0 ? range : 1,
    };
  }, [entries, settings.dayStartTime]);

  // Generate time slot markers for the header
  const timeSlots = useMemo(() => {
    // Determine a good interval (30 min for < 6h, 60 min otherwise)
    const interval = rangeMinutes <= 6 * 60 ? 30 : 60;
    // Round minMinutes down to nearest interval
    const startSlot = Math.floor(minMinutes / interval) * interval;
    const endSlot = Math.ceil(maxMinutes / interval) * interval;
    return generateTimeSlots(
      minutesToTimeString(startSlot),
      minutesToTimeString(endSlot),
      interval
    );
  }, [minMinutes, maxMinutes, rangeMinutes]);

  // Helper: compute left% and width% for an entry
  const getBlockStyle = (entry) => {
    const start = parseTimeToMinutes(entry.startTime || "00:00");
    const duration = typeof entry.duration === "number" ? entry.duration : 15;

    const leftPercent = ((start - minMinutes) / rangeMinutes) * 100;
    const widthPercent = (duration / rangeMinutes) * 100;

    return {
      left: `${Math.max(0, leftPercent)}%`,
      width: `${Math.max(0.5, Math.min(100 - leftPercent, widthPercent))}%`,
    };
  };

  // Helper: get entry label
  const getEntryLabel = (entry) => {
    if (entry.type === "shot") {
      return entry.resolvedShot?.name || "Shot";
    }
    return entry.customData?.label || entry.type || "Item";
  };

  // Lane tracks (non-shared)
  const laneTracks = useMemo(() => {
    return tracks.filter((t) => t.scope !== "shared" && t.id !== "shared");
  }, [tracks]);

  // Get the primary track ID (first lane track, or fallback)
  const primaryTrackId = laneTracks.length > 0 ? laneTracks[0].id : null;

  // Group lane entries by track ID
  // Entries with missing/undefined trackId default to the primary track
  const laneEntriesByTrack = useMemo(() => {
    const map = new Map();
    laneTracks.forEach((track) => map.set(track.id, []));
    laneEntries.forEach((entry) => {
      const trackId = entry.trackId || primaryTrackId;
      if (map.has(trackId)) {
        map.get(trackId).push(entry);
      } else if (primaryTrackId && map.has(primaryTrackId)) {
        // Fallback: entries with unknown track go to primary
        map.get(primaryTrackId).push(entry);
      }
    });
    return map;
  }, [laneEntries, laneTracks, primaryTrackId]);

  // Compute overlap layouts for each lane track
  const overlapLayoutsByTrack = useMemo(() => {
    const layoutMap = new Map();
    for (const [trackId, trackEntries] of laneEntriesByTrack) {
      layoutMap.set(trackId, computeOverlapLayout(trackEntries, parseTimeToMinutes));
    }
    return layoutMap;
  }, [laneEntriesByTrack]);

  // Hover guide state for vertical time indicator
  const [hoverX, setHoverX] = useState(null);
  const timelineGridRef = useRef(null);
  const LABEL_WIDTH = 64; // w-16 = 64px

  // Mouse handlers for hover guide
  const handleTimelineMouseMove = useCallback((e) => {
    if (!timelineGridRef.current) return;
    const rect = timelineGridRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    // Only track if mouse is past the label column
    if (x > LABEL_WIDTH) {
      setHoverX(x);
    } else {
      setHoverX(null);
    }
  }, []);

  const handleTimelineMouseLeave = useCallback(() => {
    setHoverX(null);
  }, []);

  // Compute time at hover position (for optional tooltip)
  const hoverTime = useMemo(() => {
    if (hoverX === null || !timelineGridRef.current) return null;
    const rect = timelineGridRef.current.getBoundingClientRect();
    const timelineWidth = rect.width - LABEL_WIDTH;
    const relativeX = hoverX - LABEL_WIDTH;
    const positionPercent = relativeX / timelineWidth;
    const minutesAtPosition = minMinutes + positionPercent * rangeMinutes;
    // Round to nearest 5 minutes for cleaner display
    const roundedMinutes = Math.round(minutesAtPosition / 5) * 5;
    return minutesToTime12h(Math.max(0, Math.min(24 * 60, roundedMinutes)));
  }, [hoverX, minMinutes, rangeMinutes]);

  // Compute exact hover position in minutes (unrounded) for block highlighting
  const hoverMin = useMemo(() => {
    if (hoverX === null || !timelineGridRef.current) return null;
    const rect = timelineGridRef.current.getBoundingClientRect();
    const timelineWidth = rect.width - LABEL_WIDTH;
    const relativeX = hoverX - LABEL_WIDTH;
    const positionPercent = relativeX / timelineWidth;
    return minMinutes + positionPercent * rangeMinutes;
  }, [hoverX, minMinutes, rangeMinutes]);

  // Handle click on an entry block
  const handleEntryClick = (entry) => {
    if (entry.type === "shot") {
      onEditShotEntry?.(entry);
    } else {
      onEditEntry?.(entry);
    }
  };

  // Handle keyboard activation (Enter/Space)
  const handleEntryKeyDown = (e, entry) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleEntryClick(entry);
    }
  };

  // Track count for stats
  const laneTrackCount = laneTracks.length;

  return (
    <div className="flex h-full flex-col">
      {/* Time header with hour markers */}
      <div className="flex-shrink-0 border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
        <div className="relative h-6 ml-16">
          {timeSlots.map((slot) => {
            const leftPercent = ((slot.minutes - minMinutes) / rangeMinutes) * 100;
            if (leftPercent < 0 || leftPercent > 100) return null;
            return (
              <div
                key={slot.time}
                className="absolute top-0 bottom-0 flex items-center"
                style={{ left: `${leftPercent}%` }}
              >
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 -translate-x-1/2">
                  {slot.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Timeline grid container - wraps shared strip + lanes for hover guide */}
      <div
        ref={timelineGridRef}
        className="relative flex-shrink-0"
        onMouseMove={handleTimelineMouseMove}
        onMouseLeave={handleTimelineMouseLeave}
      >
        {/* Vertical hover guide line */}
        {hoverX !== null && (
          <>
            {/* Guide line - positioned behind blocks (z-0) */}
            <div
              className="absolute top-0 bottom-0 w-px bg-slate-300/60 dark:bg-slate-600/50 pointer-events-none z-0"
              style={{ left: `${hoverX}px` }}
            />
            {/* Time tooltip at top of guide */}
            {hoverTime && (
              <div
                className="absolute top-0 -translate-y-full pointer-events-none z-10"
                style={{ left: `${hoverX}px` }}
              >
                <div className="relative -translate-x-1/2 px-1.5 py-0.5 rounded bg-slate-700 dark:bg-slate-600 shadow-sm">
                  <span className="text-[10px] font-medium text-white whitespace-nowrap">
                    {hoverTime}
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {/* Shared strip overlay */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800/40">
          {/* Label column */}
          <div className="w-16 flex-shrink-0 px-2 py-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Shared
            </span>
          </div>

          {/* Strip area */}
          <div className="relative flex-1 h-5 mr-2">
            {sharedEntries.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 italic">
                  No shared items
                </span>
              </div>
            ) : (
              sharedEntries.map((entry) => {
                const style = getBlockStyle(entry);
                const label = getEntryLabel(entry);
                return (
                  <div
                    key={entry.id}
                    className="absolute top-0.5 bottom-0.5 rounded bg-slate-200/70 dark:bg-slate-600/50 px-1.5 flex items-center overflow-hidden cursor-default hover:bg-slate-300/80 dark:hover:bg-slate-500/50 transition-colors z-10"
                    style={style}
                    title={`${label} (${entry.startTime}, ${entry.duration}m)`}
                  >
                    <span className="text-[10px] text-slate-700 dark:text-slate-200 truncate whitespace-nowrap leading-none">
                      {label}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Lane silhouettes - thin rows for each lane track with clickable blocks */}
        {laneTracks.length > 0 && (
          <div className="border-b border-slate-200 dark:border-slate-700">
            {laneTracks.map((track) => {
              const trackEntries = laneEntriesByTrack.get(track.id) || [];
              const trackOverlapLayout = overlapLayoutsByTrack.get(track.id) || new Map();

              // Check if any entry in this lane is under the hover guide
              const laneHasActiveBlock =
                hoverMin !== null &&
                trackEntries.some((entry) => {
                  const startMin = parseTimeToMinutes(entry.startTime || "00:00");
                  const duration = typeof entry.duration === "number" ? entry.duration : 15;
                  const endMin = startMin + duration;
                  return hoverMin >= startMin && hoverMin < endMin;
                });

              return (
                <div
                  key={track.id}
                  className="flex items-center h-6 border-b border-slate-100 last:border-b-0 dark:border-slate-800"
                >
                  {/* Label column - matches shared strip width */}
                  <div className="w-16 flex-shrink-0 px-2">
                    <span
                      className={[
                        "text-[10px] font-medium uppercase tracking-wide truncate block transition-colors",
                        laneHasActiveBlock
                          ? "text-slate-600 dark:text-slate-300"
                          : "text-slate-400 dark:text-slate-500",
                      ].join(" ")}
                    >
                      {track.name || track.id}
                    </span>
                  </div>

                  {/* Timeline area with blocks */}
                  <div className="relative flex-1 h-full mr-2">
                    {/* Subtle horizontal rule */}
                    <div className="absolute inset-y-0 left-0 right-0 flex items-center pointer-events-none">
                      <div className="w-full border-b border-slate-200/70 dark:border-slate-700/60" />
                    </div>

                    {/* Entry blocks with overlap handling */}
                    {trackEntries.map((entry) => {
                      const baseStyle = getBlockStyle(entry);
                      const label = getEntryLabel(entry);
                      const isClickable = !!(onEditEntry || onEditShotEntry);

                      // Get overlap layout for this entry
                      const layout = trackOverlapLayout.get(entry.id) || { colIndex: 0, colCount: 1 };
                      const { colIndex, colCount } = layout;

                      // Parse base left and width percentages
                      const baseLeft = parseFloat(baseStyle.left);
                      const baseWidth = parseFloat(baseStyle.width);

                      // Compute effective position for horizontal splitting
                      const effectiveWidth = baseWidth / colCount;
                      const effectiveLeft = baseLeft + colIndex * effectiveWidth;

                      // Build style with calc for subtle padding (1px gap between blocks)
                      const blockStyle =
                        colCount > 1
                          ? {
                              left: `calc(${effectiveLeft}% + 1px)`,
                              width: `calc(${effectiveWidth}% - 2px)`,
                              minWidth: "12px", // Ensure clickability
                            }
                          : baseStyle;

                      // Check if hover guide is over this block
                      const entryStartMin = parseTimeToMinutes(entry.startTime || "00:00");
                      const entryDuration = typeof entry.duration === "number" ? entry.duration : 15;
                      const entryEndMin = entryStartMin + entryDuration;
                      const isHoverActive =
                        hoverMin !== null && hoverMin >= entryStartMin && hoverMin < entryEndMin;

                      return (
                        <div
                          key={entry.id}
                          role={isClickable ? "button" : undefined}
                          tabIndex={isClickable ? 0 : undefined}
                          className={[
                            "absolute top-0.5 bottom-0.5 rounded px-1 flex items-center overflow-hidden transition-colors z-10",
                            isClickable
                              ? "cursor-pointer bg-slate-200/80 hover:bg-slate-300/80 dark:bg-slate-600/40 dark:hover:bg-slate-500/40"
                              : "cursor-default bg-slate-200/80 dark:bg-slate-600/40",
                            // Hover guide highlight (distinct from mouse-over hover)
                            isHoverActive
                              ? "ring-1 ring-slate-400/70 dark:ring-slate-300/40"
                              : "",
                          ].join(" ")}
                          style={blockStyle}
                          title={`${label} (${entry.startTime}, ${entry.duration}m)`}
                          onClick={isClickable ? () => handleEntryClick(entry) : undefined}
                          onKeyDown={isClickable ? (e) => handleEntryKeyDown(e, entry) : undefined}
                        >
                          <span className="text-xs text-slate-700 dark:text-slate-100 truncate whitespace-nowrap leading-none">
                            {label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Main timeline area (placeholder for lane tracks) */}
      <div className="flex-1 min-h-0 overflow-auto bg-white dark:bg-slate-900">
        {laneTrackCount === 0 && laneEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <Layers className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Lane tracks will appear here
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Multi-lane rendering coming in a future update
            </p>
          </div>
        ) : (
          <div className="p-4">
            {/* Stats summary */}
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="flex items-center gap-1.5 rounded bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">
                <Layers className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-slate-600 dark:text-slate-400">Lane Tracks:</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">{laneTrackCount}</span>
              </div>
              <div className="flex items-center gap-1.5 rounded bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">
                <Clock className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-slate-600 dark:text-slate-400">Lane Entries:</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">{laneEntries.length}</span>
              </div>
              <div className="flex items-center gap-1.5 rounded bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">
                <span className="text-slate-600 dark:text-slate-400">Shared Entries:</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">{sharedEntries.length}</span>
              </div>
            </div>

            {/* Lane entries list (compact debug view until full lanes implemented) */}
            {laneEntries.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
                <div className="border-b border-slate-200 px-3 py-2 dark:border-slate-700">
                  <h4 className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Lane Entries Preview
                  </h4>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-60 overflow-auto">
                  {laneEntries.slice(0, 20).map((entry) => (
                    <div key={entry.id} className="flex items-center gap-3 px-3 py-1.5 text-xs">
                      <span className="w-12 font-mono text-slate-500">{entry.startTime}</span>
                      <span className="w-10 text-slate-400">{entry.duration}m</span>
                      <span className="w-16 truncate text-slate-500">{entry.trackId}</span>
                      <span className="flex-1 truncate font-medium text-slate-800 dark:text-slate-200">
                        {getEntryLabel(entry)}
                      </span>
                    </div>
                  ))}
                  {laneEntries.length > 20 && (
                    <div className="px-3 py-1.5 text-xs text-slate-400 italic">
                      +{laneEntries.length - 20} more entries
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default TimelineView;
