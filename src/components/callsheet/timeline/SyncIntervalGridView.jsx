// src/components/callsheet/timeline/SyncIntervalGridView.jsx
// Sync Interval Grid View - vertical multi-lane timeline with guaranteed alignment
// Uses time-interval rows to ensure blocks spanning the same time range
// have identical total heights across lanes.

import React, { useMemo, useState, useCallback, useRef } from "react";
import { Clock, Layers, AlertTriangle, ArrowUpToLine } from "lucide-react";
import {
  buildSyncIntervalGrid,
  calculateRowHeights,
  generateGridTemplateRows,
  getEntryRenderInfo,
  getLaneColumn,
} from "../../../lib/syncIntervalEngine";
import { parseTimeToMinutes, minutesToTime12h } from "../../../lib/timeUtils";

// Default rendering constants
const DEFAULT_PX_PER_MINUTE = 3;
const DEFAULT_MIN_ROW_HEIGHT = 48;
const TIME_COLUMN_WIDTH = 64; // px

// Zoom presets for row sizing
const ZOOM_PRESETS = {
  compact: { pxPerMin: 2, minRow: 36, label: "Compact" },
  comfortable: { pxPerMin: 3, minRow: 48, label: "Comfortable" },
};
const ZOOM_STORAGE_KEY = "syncGrid.zoom";

// DEV-only fixture for testing sync height alignment
// Photo: 7:00-8:00 (60m) should equal Video: 7:00-7:30 (30m) + 7:30-8:00 (30m)
const DEV_FIXTURE_TRACKS = [
  { id: "photo", name: "Photo", color: "#3B82F6", order: 0, scope: "lane" },
  { id: "video", name: "Video", color: "#F59E0B", order: 1, scope: "lane" },
];

const DEV_FIXTURE_ENTRIES = [
  {
    id: "fixture-photo-1",
    trackId: "photo",
    type: "shot",
    startTime: "07:00",
    duration: 60,
    shotNumber: "P1",
    resolvedTitle: "Photo Block (60m)",
  },
  {
    id: "fixture-video-1",
    trackId: "video",
    type: "shot",
    startTime: "07:00",
    duration: 30,
    shotNumber: "V1",
    resolvedTitle: "Video Block A (30m)",
  },
  {
    id: "fixture-video-2",
    trackId: "video",
    type: "shot",
    startTime: "07:30",
    duration: 30,
    shotNumber: "V2",
    resolvedTitle: "Video Block B (30m)",
  },
];

// DEV-only conflict fixture: same-lane overlap scenario
// Video entry A: 7:00–7:30 overlaps with Video entry B: 7:15–7:45
const DEV_CONFLICT_FIXTURE_ENTRIES = [
  {
    id: "conflict-video-a",
    trackId: "video",
    type: "shot",
    startTime: "07:00",
    duration: 30,
    shotNumber: "VA",
    resolvedTitle: "Video A (7:00-7:30)",
  },
  {
    id: "conflict-video-b",
    trackId: "video",
    type: "shot",
    startTime: "07:15",
    duration: 30,
    shotNumber: "VB",
    resolvedTitle: "Video B (7:15-7:45) OVERLAP",
  },
  {
    id: "conflict-photo-c",
    trackId: "photo",
    type: "shot",
    startTime: "07:00",
    duration: 60,
    shotNumber: "PC",
    resolvedTitle: "Photo C (7:00-8:00)",
  },
];

/**
 * Get display label for an entry
 */
function getEntryLabel(entry) {
  if (entry.type === "shot") {
    return (
      entry.resolvedTitle ||
      entry.shotNumber ||
      `Shot ${entry.shotRef || ""}`.trim()
    );
  }
  return entry.customData?.title || entry.type || "Item";
}

/**
 * Get background color class for entry based on type
 */
function getEntryColorClass(entry, track) {
  if (entry.type === "custom") {
    const category = entry.customData?.category;
    switch (category) {
      case "lunch":
        return "bg-emerald-100 border-emerald-300 dark:bg-emerald-900/30 dark:border-emerald-700";
      case "break":
        return "bg-slate-100 border-slate-300 dark:bg-slate-700/50 dark:border-slate-600";
      case "setup":
      case "wrap":
        return "bg-indigo-100 border-indigo-300 dark:bg-indigo-900/30 dark:border-indigo-700";
      default:
        return "bg-slate-100 border-slate-300 dark:bg-slate-700/50 dark:border-slate-600";
    }
  }
  // Shot entries use track color tint
  return "bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-600";
}

/**
 * Entry block component rendered within the grid
 */
function EntryBlock({
  entry,
  track,
  startRow,
  rowSpan,
  laneColumn,
  isSelected,
  isHovered,
  onClick,
  onHover,
}) {
  const label = getEntryLabel(entry);
  const colorClass = getEntryColorClass(entry, track);
  const duration = typeof entry.duration === "number" ? entry.duration : 15;
  const startTime = minutesToTime12h(parseTimeToMinutes(entry.startTime || "00:00"));

  // Compute left border color from track
  const borderLeftColor = track?.color || "#64748B";

  return (
    <div
      role="button"
      tabIndex={0}
      className={[
        "relative rounded-md border shadow-sm overflow-hidden cursor-pointer transition-all",
        "flex flex-col justify-start p-2",
        colorClass,
        isSelected ? "ring-2 ring-blue-500 ring-offset-1" : "",
        isHovered ? "shadow-md z-10" : "z-0",
      ].join(" ")}
      style={{
        gridRow: `${startRow} / span ${rowSpan}`,
        gridColumn: laneColumn,
        borderLeftWidth: "3px",
        borderLeftColor,
        minHeight: 0, // Allow shrinking within grid cell
      }}
      onClick={() => onClick?.(entry)}
      onMouseEnter={() => onHover?.(entry.id)}
      onMouseLeave={() => onHover?.(null)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.(entry);
        }
      }}
    >
      {/* Time badge - always visible */}
      <div className="flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-0.5 flex-shrink-0">
        <Clock className="h-3 w-3 flex-shrink-0" />
        <span className="whitespace-nowrap">{startTime}</span>
        <span className="opacity-70 whitespace-nowrap">({duration}m)</span>
      </div>

      {/* Title - use line-clamp for 2 lines instead of truncate */}
      <div className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-snug line-clamp-2">
        {entry.shotNumber && (
          <span className="text-slate-500 dark:text-slate-400 mr-1">
            #{entry.shotNumber}
          </span>
        )}
        {label}
      </div>

      {/* Details (only show if enough space - rowSpan > 1 means taller block) */}
      {rowSpan > 1 && (
        <div className="mt-1 space-y-0.5 overflow-hidden flex-shrink-0">
          {entry.resolvedTalent?.length > 0 && (
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {entry.resolvedTalent.join(", ")}
            </div>
          )}
          {entry.resolvedLocation && (
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {entry.resolvedLocation}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * SyncIntervalGridView - Main grid component
 *
 * @param {object} props
 * @param {Array} props.entries - Resolved schedule entries
 * @param {Array} props.tracks - Track definitions
 * @param {object} props.settings - Schedule settings
 * @param {Function} props.onEditEntry - Callback when entry is clicked (custom)
 * @param {Function} props.onEditShotEntry - Callback when entry is clicked (shot)
 * @param {number} props.pxPerMinute - Pixels per minute for row height (default 2)
 * @param {number} props.minRowHeight - Minimum row height in pixels (default 36)
 */
function SyncIntervalGridView({
  entries = [],
  tracks = [],
  settings = {},
  onEditEntry,
  onEditShotEntry,
}) {
  const [selectedEntryId, setSelectedEntryId] = useState(null);
  const [hoveredEntryId, setHoveredEntryId] = useState(null);
  const scrollContainerRef = useRef(null);

  // Zoom preset state with localStorage persistence
  const [zoom, setZoom] = useState(() => {
    const stored = localStorage.getItem(ZOOM_STORAGE_KEY);
    return stored && ZOOM_PRESETS[stored] ? stored : "comfortable";
  });

  const handleZoomChange = useCallback((nextZoom) => {
    setZoom(nextZoom);
    localStorage.setItem(ZOOM_STORAGE_KEY, nextZoom);
  }, []);

  // Get active preset values
  const activePreset = ZOOM_PRESETS[zoom] || ZOOM_PRESETS.comfortable;
  const pxPerMinute = activePreset.pxPerMin;
  const minRowHeight = activePreset.minRow;

  // DEV-only: fixture toggle state
  const [useFixture, setUseFixture] = useState(false);
  const [useConflictFixture, setUseConflictFixture] = useState(false);

  // Determine effective data: use fixture or real props
  const effectiveEntries = import.meta.env.DEV && useConflictFixture
    ? DEV_CONFLICT_FIXTURE_ENTRIES
    : import.meta.env.DEV && useFixture
      ? DEV_FIXTURE_ENTRIES
      : entries;
  const effectiveTracks = import.meta.env.DEV && (useFixture || useConflictFixture) ? DEV_FIXTURE_TRACKS : tracks;

  // Build the sync interval grid data
  const gridData = useMemo(() => {
    return buildSyncIntervalGrid(effectiveEntries, effectiveTracks);
  }, [effectiveEntries, effectiveTracks]);

  // Calculate row heights
  const rowHeights = useMemo(() => {
    return calculateRowHeights(gridData.intervals, pxPerMinute, minRowHeight);
  }, [gridData.intervals, pxPerMinute, minRowHeight]);

  // Generate CSS grid template
  const gridTemplateRows = useMemo(() => {
    return generateGridTemplateRows(rowHeights);
  }, [rowHeights]);

  // Get entries with render positioning info
  const entryRenderInfo = useMemo(() => {
    return getEntryRenderInfo(gridData, effectiveEntries);
  }, [gridData, effectiveEntries]);

  // Build track lookup map
  const trackById = useMemo(() => {
    return new Map(effectiveTracks.map((t) => [t.id, t]));
  }, [effectiveTracks]);

  // Build conflict lookup Set for efficient cell highlighting
  const conflictCells = useMemo(() => {
    const set = new Set();
    for (const conflict of gridData.conflicts) {
      set.add(`${conflict.intervalIndex}-${conflict.laneId}`);
    }
    return set;
  }, [gridData.conflicts]);

  // Handle entry click
  const handleEntryClick = useCallback(
    (entry) => {
      setSelectedEntryId(entry.id);
      if (entry.type === "shot") {
        onEditShotEntry?.(entry);
      } else {
        onEditEntry?.(entry);
      }
    },
    [onEditEntry, onEditShotEntry]
  );

  // Handle hover
  const handleEntryHover = useCallback((entryId) => {
    setHoveredEntryId(entryId);
  }, []);

  // Jump to first interval row
  const handleJumpToFirstTime = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    requestAnimationFrame(() => {
      const firstRow = container.querySelector('[data-interval-index="0"]');
      if (!firstRow) {
        container.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      const containerRect = container.getBoundingClientRect();
      const firstRowRect = firstRow.getBoundingClientRect();
      const scrollOffset = firstRowRect.top - containerRect.top + container.scrollTop;
      container.scrollTo({ top: scrollOffset, behavior: "smooth" });
    });
  }, []);

  // Empty state
  if (gridData.lanes.length === 0 || gridData.intervals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <Layers className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No lane entries to display
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
          Add entries to tracks to see the sync interval grid
        </p>
      </div>
    );
  }

  // Calculate total grid height
  const totalGridHeight = rowHeights.reduce((sum, h) => sum + h, 0);

  // Generate grid template columns: time column + lane columns
  const gridTemplateColumns = `${TIME_COLUMN_WIDTH}px repeat(${gridData.lanes.length}, minmax(120px, 1fr))`;

  return (
    <div className="flex flex-col h-full">
      {/* DEV-only: Fixture toggle */}
      {import.meta.env.DEV && (
        <div className="flex-shrink-0 px-4 py-2 bg-purple-50 border-b border-purple-200 dark:bg-purple-900/20 dark:border-purple-800 flex items-center gap-6">
          <label className="flex items-center gap-2 text-xs text-purple-700 dark:text-purple-400 cursor-pointer">
            <input
              type="checkbox"
              checked={useFixture}
              onChange={(e) => {
                setUseFixture(e.target.checked);
                if (e.target.checked) setUseConflictFixture(false);
              }}
              className="rounded border-purple-300 text-purple-600 focus:ring-purple-500"
            />
            <span className="font-medium">Use sync-height fixture</span>
            {useFixture && (
              <span className="text-purple-500 dark:text-purple-400">
                (Photo: 60m, Video: 30m+30m)
              </span>
            )}
          </label>
          <label className="flex items-center gap-2 text-xs text-red-700 dark:text-red-400 cursor-pointer">
            <input
              type="checkbox"
              checked={useConflictFixture}
              onChange={(e) => {
                setUseConflictFixture(e.target.checked);
                if (e.target.checked) setUseFixture(false);
              }}
              className="rounded border-red-300 text-red-600 focus:ring-red-500"
            />
            <span className="font-medium">Use conflict fixture</span>
            {useConflictFixture && (
              <span className="text-red-500 dark:text-red-400">
                (Video overlap: 7:00-7:30 ∩ 7:15-7:45)
              </span>
            )}
          </label>
        </div>
      )}

      {/* Conflict warnings */}
      {gridData.conflictWarnings.length > 0 && (
        <div className="flex-shrink-0 px-4 py-2 bg-amber-50 border-b border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
          <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{gridData.conflictWarnings.length} overlap conflict(s) detected</span>
          </div>
        </div>
      )}

      {/* Zoom control + Jump to first + Export behavior hint */}
      <div className="flex-shrink-0 px-4 py-1.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Planning view. PDF export uses the chronological schedule table.
        </p>
        <div className="flex items-center gap-3">
          {/* Jump to first time button */}
          <button
            type="button"
            onClick={handleJumpToFirstTime}
            disabled={gridData.intervals.length === 0}
            className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowUpToLine className="h-3 w-3" />
            <span>Jump to first time</span>
          </button>
          <span className="text-xs text-slate-500 dark:text-slate-400">Zoom</span>
          <div className="flex rounded-md overflow-hidden border border-slate-200 dark:border-slate-700">
            {Object.entries(ZOOM_PRESETS).map(([key, preset]) => (
              <button
                key={key}
                type="button"
                onClick={() => handleZoomChange(key)}
                className={[
                  "px-2 py-0.5 text-xs font-medium transition-colors",
                  zoom === key
                    ? "bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900"
                    : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700",
                ].join(" ")}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Header row with lane labels */}
      <div
        className="flex-shrink-0 border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50"
        style={{
          display: "grid",
          gridTemplateColumns,
        }}
      >
        {/* Time column header */}
        <div className="px-2 py-2 flex items-center justify-center">
          <Clock className="h-4 w-4 text-slate-400" />
        </div>

        {/* Lane headers */}
        {gridData.lanes.map((lane) => {
          const conflictCount = gridData.conflictCountByLane.get(lane.id) || 0;
          return (
            <div
              key={lane.id}
              className="px-2 py-2 flex items-center gap-2 border-l border-slate-200 dark:border-slate-700"
            >
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: lane.color }}
              />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                {lane.name}
              </span>
              {conflictCount > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40 px-1.5 py-0.5 rounded-full">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {conflictCount}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Scrollable grid area */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto">
        <div
          className="relative"
          style={{
            display: "grid",
            gridTemplateColumns,
            gridTemplateRows,
            minHeight: totalGridHeight,
          }}
        >
          {/* Time labels column - one per interval */}
          {gridData.intervals.map((interval, idx) => (
            <div
              key={`time-${idx}`}
              data-interval-index={idx}
              className="flex items-start justify-end pr-2 pt-1 border-r border-slate-100 dark:border-slate-800"
              style={{
                gridRow: idx + 1,
                gridColumn: 1,
              }}
            >
              <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                {interval.label}
              </span>
            </div>
          ))}

          {/* Lane background cells - subtle grid lines + conflict highlights */}
          {gridData.intervals.map((interval, rowIdx) =>
            gridData.lanes.map((lane, colIdx) => {
              const cellKey = `${rowIdx}-${lane.id}`;
              const hasConflict = conflictCells.has(cellKey);
              return (
                <div
                  key={`cell-${cellKey}`}
                  className={[
                    "border-b border-r border-slate-100 dark:border-slate-800/50 relative",
                    hasConflict ? "bg-red-50 dark:bg-red-950/20" : "",
                  ].join(" ")}
                  style={{
                    gridRow: rowIdx + 1,
                    gridColumn: colIdx + 2, // +1 for time col, +1 for 1-index
                  }}
                >
                  {hasConflict && (
                    <span className="absolute top-0.5 right-0.5 flex items-center justify-center w-3.5 h-3.5 text-[9px] font-bold text-red-600 dark:text-red-400 bg-red-200 dark:bg-red-800/60 rounded-full z-20">
                      !
                    </span>
                  )}
                </div>
              );
            })
          )}

          {/* Entry blocks */}
          {entryRenderInfo.map(({ entry, startRow, rowSpan, laneId }) => {
            const track = trackById.get(laneId);
            const laneColumn = getLaneColumn(gridData.lanes, laneId);

            return (
              <EntryBlock
                key={entry.id}
                entry={entry}
                track={track}
                startRow={startRow}
                rowSpan={rowSpan}
                laneColumn={laneColumn}
                isSelected={selectedEntryId === entry.id}
                isHovered={hoveredEntryId === entry.id}
                onClick={handleEntryClick}
                onHover={handleEntryHover}
              />
            );
          })}
        </div>
      </div>

      {/* Stats footer */}
      <div className="flex-shrink-0 px-4 py-2 border-t border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span>
            <strong className="text-slate-700 dark:text-slate-200">{gridData.lanes.length}</strong> lanes
          </span>
          <span>
            <strong className="text-slate-700 dark:text-slate-200">{gridData.intervals.length}</strong> intervals
          </span>
          <span>
            <strong className="text-slate-700 dark:text-slate-200">{entryRenderInfo.length}</strong> entries
          </span>
          <span className="text-slate-400">
            {pxPerMinute}px/min, {minRowHeight}px min
          </span>
        </div>
      </div>
    </div>
  );
}

export default SyncIntervalGridView;
