// src/components/callsheet/timeline/TimelineTrack.jsx
// Individual track row (swimlane) for the timeline view

import React, { useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import TimelineEntry from "./TimelineEntry";
import { parseTimeToMinutes } from "../../../lib/timeUtils";
import { BASE_HOUR_WIDTH } from "./TimelineRuler";
import { cn } from "../../../lib/utils";

// Track row height in pixels
const TRACK_ROW_HEIGHT = 56;

/**
 * TimelineTrack - A single swimlane track row
 *
 * @param {object} props
 * @param {object} props.track - Track configuration
 * @param {Array} props.entries - Entries for this track
 * @param {string} props.dayStart - Day start time (HH:MM)
 * @param {string} props.dayEnd - Day end time (HH:MM)
 * @param {number} props.zoomLevel - Current zoom level
 * @param {object} props.settings - Schedule settings
 * @param {string} props.selectedEntryId - Currently selected entry ID
 * @param {string} props.draggingEntryId - Currently dragging entry ID
 * @param {Function} props.onEntryClick - Entry click handler
 * @param {Function} props.onEntryDoubleClick - Entry double-click handler
 * @param {Function} props.onEntryResize - Entry resize handler
 * @param {number} props.trackLabelWidth - Width of track label column
 */
function TimelineTrack({
  track,
  entries = [],
  dayStart = "06:00",
  dayEnd = "22:00",
  zoomLevel = 1,
  settings = {},
  selectedEntryId,
  draggingEntryId,
  onEntryClick,
  onEntryDoubleClick,
  onEntryResize,
  trackLabelWidth = 120,
}) {
  // Set up droppable area for the track
  const { setNodeRef, isOver } = useDroppable({
    id: `track-${track.id}`,
    data: {
      type: "track",
      trackId: track.id,
    },
  });

  // Calculate timeline dimensions
  const dayStartMinutes = parseTimeToMinutes(dayStart);
  const dayEndMinutes = parseTimeToMinutes(dayEnd);
  const totalMinutes = dayEndMinutes - dayStartMinutes;
  const hourWidth = BASE_HOUR_WIDTH * zoomLevel;
  const totalWidth = (totalMinutes / 60) * hourWidth;
  const pixelsPerMinute = hourWidth / 60;

  // Calculate entry positions
  const positionedEntries = useMemo(() => {
    return entries.map((entry) => {
      const startMinutes = parseTimeToMinutes(entry.startTime);
      const left = (startMinutes - dayStartMinutes) * pixelsPerMinute;
      const width = entry.duration * pixelsPerMinute;

      return {
        ...entry,
        left,
        width: Math.max(width, 20), // Minimum width of 20px
      };
    });
  }, [entries, dayStartMinutes, pixelsPerMinute]);

  // Generate hour grid lines
  const hourLines = useMemo(() => {
    const lines = [];
    for (let m = dayStartMinutes; m <= dayEndMinutes; m += 60) {
      const left = (m - dayStartMinutes) * pixelsPerMinute;
      lines.push({ minutes: m, left });
    }
    return lines;
  }, [dayStartMinutes, dayEndMinutes, pixelsPerMinute]);

  return (
    <div className="flex border-b border-slate-200 dark:border-slate-700">
      {/* Track Label - sticky to stay visible on horizontal scroll */}
      <div
        className="sticky left-0 z-10 shrink-0 border-r border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
        style={{ width: trackLabelWidth }}
      >
        <div className="flex items-center gap-2">
          {/* Color indicator */}
          <div
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: track.color }}
          />
          {/* Track name */}
          <span className="truncate text-sm font-medium text-slate-700 dark:text-slate-300">
            {track.name}
          </span>
        </div>
        {/* Entry count */}
        <div className="mt-0.5 text-xs text-slate-500">
          {entries.length} {entries.length === 1 ? "item" : "items"}
        </div>
      </div>

      {/* Timeline Area */}
      <div
        ref={setNodeRef}
        className={cn(
          "relative overflow-hidden",
          isOver && "bg-primary/5"
        )}
        style={{
          width: totalWidth,
          height: TRACK_ROW_HEIGHT,
        }}
      >
        {/* Hour grid lines */}
        {hourLines.map((line) => (
          <div
            key={line.minutes}
            className="absolute top-0 bottom-0 w-px bg-slate-100 dark:bg-slate-800"
            style={{ left: line.left }}
          />
        ))}

        {/* Drop zone indicator */}
        {isOver && (
          <div className="absolute inset-0 border-2 border-dashed border-primary/30 bg-primary/5" />
        )}

        {/* Entries */}
        {positionedEntries.map((entry) => (
          <TimelineEntry
            key={entry.id}
            entry={entry}
            track={track}
            isSelected={selectedEntryId === entry.id}
            isDragging={draggingEntryId === entry.id}
            zoomLevel={zoomLevel}
            settings={settings}
            onClick={onEntryClick}
            onDoubleClick={onEntryDoubleClick}
            onResize={onEntryResize}
            left={entry.left}
            width={entry.width}
          />
        ))}

        {/* Empty track message */}
        {entries.length === 0 && !isOver && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">
            Drag items here or click + to add
          </div>
        )}
      </div>
    </div>
  );
}

export default TimelineTrack;

// Export constants
export { TRACK_ROW_HEIGHT };
