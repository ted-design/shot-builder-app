// src/components/callsheet/timeline/SyncIntervalGridView.jsx
// Sync Interval Grid View - vertical multi-lane timeline with guaranteed alignment
// Uses time-interval rows to ensure blocks spanning the same time range
// have identical total heights across lanes.

import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { Clock, Layers, AlertTriangle, ArrowUpToLine, ChevronLeft, ChevronRight, Bug, X, Info } from "lucide-react";
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

// DEV-only multi-conflict fixture: TWO distinct overlap scenarios for navigation testing
// Occurrence 1 (Video): VA 7:00–7:30 ∩ VB 7:15–7:45 → first conflict interval at 7:15
// Occurrence 2 (Photo): PC 8:00–8:30 ∩ PD 8:10–8:40 → first conflict interval at 8:10
const DEV_MULTI_CONFLICT_FIXTURE_ENTRIES = [
  // Occurrence 1: Video lane overlap
  {
    id: "multi-video-a",
    trackId: "video",
    type: "shot",
    startTime: "07:00",
    duration: 30,
    shotNumber: "VA",
    resolvedTitle: "Video A (7:00-7:30)",
  },
  {
    id: "multi-video-b",
    trackId: "video",
    type: "shot",
    startTime: "07:15",
    duration: 30,
    shotNumber: "VB",
    resolvedTitle: "Video B (7:15-7:45) OVERLAP",
  },
  // Occurrence 2: Photo lane overlap
  {
    id: "multi-photo-c",
    trackId: "photo",
    type: "shot",
    startTime: "08:00",
    duration: 30,
    shotNumber: "PC",
    resolvedTitle: "Photo C (8:00-8:30)",
  },
  {
    id: "multi-photo-d",
    trackId: "photo",
    type: "shot",
    startTime: "08:10",
    duration: 30,
    shotNumber: "PD",
    resolvedTitle: "Photo D (8:10-8:40) OVERLAP",
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

  // DEV-only: fixture toggle state (mutually exclusive)
  const [useFixture, setUseFixture] = useState(false);
  const [useConflictFixture, setUseConflictFixture] = useState(false);
  const [useMultiConflictFixture, setUseMultiConflictFixture] = useState(false);
  // DEV-only: debug panel visibility
  const [isDebugPanelOpen, setIsDebugPanelOpen] = useState(false);
  const debugPanelRef = useRef(null);
  const debugButtonRef = useRef(null);

  // Determine effective data: use fixture or real props (priority: multi > conflict > sync-height)
  const effectiveEntries = import.meta.env.DEV && useMultiConflictFixture
    ? DEV_MULTI_CONFLICT_FIXTURE_ENTRIES
    : import.meta.env.DEV && useConflictFixture
      ? DEV_CONFLICT_FIXTURE_ENTRIES
      : import.meta.env.DEV && useFixture
        ? DEV_FIXTURE_ENTRIES
        : entries;
  const effectiveTracks = import.meta.env.DEV && (useFixture || useConflictFixture || useMultiConflictFixture) ? DEV_FIXTURE_TRACKS : tracks;

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

  // Derive stable ordered list of conflict occurrences for navigation
  // Each occurrence is a unique (laneId + entryPair) combo, sorted by earliest interval
  const conflictOccurrences = useMemo(() => {
    const occurrenceMap = new Map(); // key: "laneId|id1::id2" -> { laneId, entryIds, firstIntervalIndex }
    for (const conflict of gridData.conflicts) {
      const { entryIds, laneId, intervalIndex } = conflict;
      // Generate all pairs from entryIds (same logic as engine)
      for (let i = 0; i < entryIds.length; i++) {
        for (let j = i + 1; j < entryIds.length; j++) {
          // Create stable pair key using sorted IDs
          const [minId, maxId] = entryIds[i] < entryIds[j]
            ? [entryIds[i], entryIds[j]]
            : [entryIds[j], entryIds[i]];
          const pairKey = `${minId}::${maxId}`;
          const key = `${laneId}|${pairKey}`;

          if (!occurrenceMap.has(key)) {
            occurrenceMap.set(key, {
              laneId,
              pairKey,
              entryIds: [minId, maxId],
              firstIntervalIndex: intervalIndex,
            });
          } else {
            // Update to minimum interval index
            const existing = occurrenceMap.get(key);
            if (intervalIndex < existing.firstIntervalIndex) {
              existing.firstIntervalIndex = intervalIndex;
            }
          }
        }
      }
    }
    // Sort by firstIntervalIndex asc, then by lane order
    const laneOrderMap = new Map(gridData.lanes.map((lane, idx) => [lane.id, idx]));
    return Array.from(occurrenceMap.values()).sort((a, b) => {
      if (a.firstIntervalIndex !== b.firstIntervalIndex) {
        return a.firstIntervalIndex - b.firstIntervalIndex;
      }
      return (laneOrderMap.get(a.laneId) || 0) - (laneOrderMap.get(b.laneId) || 0);
    });
  }, [gridData.conflicts, gridData.lanes]);

  // Conflict navigation state
  const [selectedConflictIndex, setSelectedConflictIndex] = useState(0);
  const [highlightedIntervalIndex, setHighlightedIntervalIndex] = useState(null);
  const [isConflictListOpen, setIsConflictListOpen] = useState(false);
  const conflictListRef = useRef(null);
  const conflictToggleRef = useRef(null);

  // Reset selected conflict index when occurrences change
  useEffect(() => {
    setSelectedConflictIndex(0);
    setHighlightedIntervalIndex(null);
    setIsConflictListOpen(false);
  }, [conflictOccurrences.length]);

  // Close conflict list on click outside or Escape (only when open)
  useEffect(() => {
    if (!isConflictListOpen) return;

    const handleClickOutside = (e) => {
      // Early return if click is inside popover OR on the toggle button
      if (conflictListRef.current?.contains(e.target)) return;
      if (conflictToggleRef.current?.contains(e.target)) return;
      setIsConflictListOpen(false);
    };

    const handleEscape = (e) => {
      if (e.key === "Escape") {
        setIsConflictListOpen(false);
      }
    };

    document.addEventListener("pointerdown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isConflictListOpen]);

  // DEV-only: Close debug panel on click outside or Escape
  useEffect(() => {
    if (!import.meta.env.DEV || !isDebugPanelOpen) return;

    const handleClickOutside = (e) => {
      if (debugPanelRef.current?.contains(e.target)) return;
      if (debugButtonRef.current?.contains(e.target)) return;
      setIsDebugPanelOpen(false);
    };

    const handleEscape = (e) => {
      if (e.key === "Escape") {
        setIsDebugPanelOpen(false);
      }
    };

    document.addEventListener("pointerdown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isDebugPanelOpen]);

  // Build entry lookup map for conflict list
  const entryById = useMemo(() => {
    return new Map(effectiveEntries.map((e) => [e.id, e]));
  }, [effectiveEntries]);

  // Build lane lookup map for conflict list
  const laneById = useMemo(() => {
    return new Map(gridData.lanes.map((l) => [l.id, l]));
  }, [gridData.lanes]);

  // Navigate to conflict and highlight target row
  const navigateToConflict = useCallback((index) => {
    if (index < 0 || index >= conflictOccurrences.length) return;
    setSelectedConflictIndex(index);
    const occurrence = conflictOccurrences[index];
    const targetIntervalIndex = occurrence.firstIntervalIndex;

    // Scroll to the interval row
    const container = scrollContainerRef.current;
    if (container) {
      requestAnimationFrame(() => {
        const targetRow = container.querySelector(`[data-interval-index="${targetIntervalIndex}"]`);
        if (targetRow) {
          const containerRect = container.getBoundingClientRect();
          const targetRect = targetRow.getBoundingClientRect();
          const scrollOffset = targetRect.top - containerRect.top + container.scrollTop - 20; // 20px padding from top
          container.scrollTo({ top: scrollOffset, behavior: "smooth" });
        }
      });
    }

    // Highlight the row briefly
    setHighlightedIntervalIndex(targetIntervalIndex);
    setTimeout(() => {
      setHighlightedIntervalIndex(null);
    }, 800);
  }, [conflictOccurrences]);

  const handlePrevConflict = useCallback(() => {
    navigateToConflict(selectedConflictIndex - 1);
  }, [selectedConflictIndex, navigateToConflict]);

  const handleNextConflict = useCallback(() => {
    navigateToConflict(selectedConflictIndex + 1);
  }, [selectedConflictIndex, navigateToConflict]);

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

  // DEV-only: Check if any fixture is active
  const isAnyFixtureActive = import.meta.env.DEV && (useFixture || useConflictFixture || useMultiConflictFixture);

  return (
    <div className="flex flex-col h-full">

      {/* Conflict warnings with navigation - uses unique pair count for stable reporting */}
      {gridData.totalConflictPairCount > 0 && (
        <div className="flex-shrink-0 px-4 py-2 bg-amber-50 border-b border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 relative">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{gridData.totalConflictPairCount} overlap conflict{gridData.totalConflictPairCount !== 1 ? "s" : ""} detected</span>
              {conflictOccurrences.length > 0 && (
                <button
                  ref={conflictToggleRef}
                  type="button"
                  onClick={() => setIsConflictListOpen(!isConflictListOpen)}
                  className="ml-1 px-1.5 py-0.5 text-[11px] font-medium rounded bg-amber-200 dark:bg-amber-800/60 text-amber-800 dark:text-amber-200 hover:bg-amber-300 dark:hover:bg-amber-700/60 transition-colors"
                >
                  {isConflictListOpen ? "Hide" : "View"}
                </button>
              )}
            </div>
            {/* Conflict navigation controls */}
            {conflictOccurrences.length > 0 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlePrevConflict}
                  disabled={selectedConflictIndex <= 0}
                  className="flex items-center justify-center w-6 h-6 rounded border border-amber-300 dark:border-amber-700 bg-white dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-800/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Previous conflict"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="text-xs font-medium text-amber-700 dark:text-amber-400 tabular-nums min-w-[3ch] text-center">
                  {selectedConflictIndex + 1}/{conflictOccurrences.length}
                </span>
                <button
                  type="button"
                  onClick={handleNextConflict}
                  disabled={selectedConflictIndex >= conflictOccurrences.length - 1}
                  className="flex items-center justify-center w-6 h-6 rounded border border-amber-300 dark:border-amber-700 bg-white dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-800/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Next conflict"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Conflict list popover */}
          {isConflictListOpen && conflictOccurrences.length > 0 && (
            <div
              ref={conflictListRef}
              className="absolute left-4 top-full mt-1 z-50 w-80 max-h-64 overflow-auto bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-700 rounded-lg shadow-lg"
            >
              <div className="px-3 py-2 border-b border-amber-100 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30">
                <span className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                  Conflict List
                </span>
              </div>
              <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                {conflictOccurrences.map((occurrence, idx) => {
                  const lane = laneById.get(occurrence.laneId);
                  const interval = gridData.intervals[occurrence.firstIntervalIndex];
                  const [entryId1, entryId2] = occurrence.entryIds;
                  const entry1 = entryById.get(entryId1);
                  const entry2 = entryById.get(entryId2);
                  const title1 = entry1 ? getEntryLabel(entry1) : entryId1;
                  const title2 = entry2 ? getEntryLabel(entry2) : entryId2;

                  return (
                    <li key={occurrence.pairKey} className="px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <div
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: lane?.color || "#64748B" }}
                            />
                            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                              {lane?.name || "Unknown"}
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">
                              @ {interval?.label || "—"}
                            </span>
                          </div>
                          <div className="text-xs text-slate-700 dark:text-slate-200 truncate">
                            {title1}
                          </div>
                          <div className="text-xs text-slate-700 dark:text-slate-200 truncate">
                            {title2}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigateToConflict(idx);
                            setIsConflictListOpen(false);
                          }}
                          className="flex-shrink-0 px-2 py-1 text-[10px] font-medium rounded bg-amber-100 dark:bg-amber-800/50 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-700/60 transition-colors"
                        >
                          Jump
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Zoom control + Jump to first + DEV Debug + Info hint */}
      <div className="flex-shrink-0 px-4 py-1.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 relative">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
          <Info className="h-3 w-3" />
          <span>Planning view only</span>
        </div>
        <div className="flex items-center gap-3">
          {/* DEV-only: Debug button */}
          {import.meta.env.DEV && (
            <button
              ref={debugButtonRef}
              type="button"
              onClick={() => setIsDebugPanelOpen(!isDebugPanelOpen)}
              className={[
                "flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border transition-colors",
                isAnyFixtureActive
                  ? "bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-900/40 dark:border-purple-700 dark:text-purple-400"
                  : "bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700",
              ].join(" ")}
              title="DEV: Toggle debug fixtures"
            >
              <Bug className="h-3 w-3" />
              {isAnyFixtureActive && <span className="text-[10px]">Fixture</span>}
            </button>
          )}
          {/* Jump to first time button */}
          <button
            type="button"
            onClick={handleJumpToFirstTime}
            disabled={gridData.intervals.length === 0}
            className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowUpToLine className="h-3 w-3" />
            <span>Jump</span>
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

        {/* DEV-only: Debug panel popover */}
        {import.meta.env.DEV && isDebugPanelOpen && (
          <div
            ref={debugPanelRef}
            className="absolute right-4 top-full mt-1 z-50 w-72 bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-700 rounded-lg shadow-lg"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-purple-100 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/30 rounded-t-lg">
              <span className="text-xs font-semibold text-purple-800 dark:text-purple-200 flex items-center gap-1.5">
                <Bug className="h-3 w-3" />
                DEV Fixtures
              </span>
              <button
                type="button"
                onClick={() => setIsDebugPanelOpen(false)}
                className="p-0.5 rounded hover:bg-purple-100 dark:hover:bg-purple-800/50 text-purple-500 dark:text-purple-400"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="p-3 space-y-2">
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-2">
                Override schedule data with test fixtures for development.
              </p>
              <label className="flex items-start gap-2 text-xs cursor-pointer p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-700/50">
                <input
                  type="checkbox"
                  checked={useFixture}
                  onChange={(e) => {
                    setUseFixture(e.target.checked);
                    if (e.target.checked) {
                      setUseConflictFixture(false);
                      setUseMultiConflictFixture(false);
                    }
                  }}
                  className="mt-0.5 rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <span className="font-medium text-purple-700 dark:text-purple-400">Sync-height</span>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Photo 60m = Video 30m+30m</p>
                </div>
              </label>
              <label className="flex items-start gap-2 text-xs cursor-pointer p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-700/50">
                <input
                  type="checkbox"
                  checked={useConflictFixture}
                  onChange={(e) => {
                    setUseConflictFixture(e.target.checked);
                    if (e.target.checked) {
                      setUseFixture(false);
                      setUseMultiConflictFixture(false);
                    }
                  }}
                  className="mt-0.5 rounded border-red-300 text-red-600 focus:ring-red-500"
                />
                <div>
                  <span className="font-medium text-red-700 dark:text-red-400">Single conflict</span>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Video overlap 7:00-7:30 ∩ 7:15-7:45</p>
                </div>
              </label>
              <label className="flex items-start gap-2 text-xs cursor-pointer p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-700/50">
                <input
                  type="checkbox"
                  checked={useMultiConflictFixture}
                  onChange={(e) => {
                    setUseMultiConflictFixture(e.target.checked);
                    if (e.target.checked) {
                      setUseFixture(false);
                      setUseConflictFixture(false);
                    }
                  }}
                  className="mt-0.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <span className="font-medium text-amber-700 dark:text-amber-400">Multi-conflict</span>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">2 conflicts: Video 7:15, Photo 8:10</p>
                </div>
              </label>
              {isAnyFixtureActive && (
                <button
                  type="button"
                  onClick={() => {
                    setUseFixture(false);
                    setUseConflictFixture(false);
                    setUseMultiConflictFixture(false);
                  }}
                  className="mt-2 w-full px-2 py-1.5 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600 transition-colors"
                >
                  Clear all fixtures
                </button>
              )}
            </div>
          </div>
        )}
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

        {/* Lane headers - use pair-based counts for stable conflict badges */}
        {gridData.lanes.map((lane) => {
          const conflictPairCount = gridData.conflictPairCountByLane.get(lane.id) || 0;
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
              {conflictPairCount > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40 px-1.5 py-0.5 rounded-full">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {conflictPairCount}
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
          {gridData.intervals.map((interval, idx) => {
            const isHighlighted = highlightedIntervalIndex === idx;
            return (
              <div
                key={`time-${idx}`}
                data-interval-index={idx}
                className={[
                  "flex items-start justify-end pr-2 pt-1 border-r border-slate-100 dark:border-slate-800 transition-colors duration-300",
                  isHighlighted ? "bg-amber-200 dark:bg-amber-700/50" : "",
                ].join(" ")}
                style={{
                  gridRow: idx + 1,
                  gridColumn: 1,
                }}
              >
                <span className={[
                  "text-[10px] font-medium tabular-nums transition-colors duration-300",
                  isHighlighted ? "text-amber-800 dark:text-amber-200" : "text-slate-500 dark:text-slate-400",
                ].join(" ")}>
                  {interval.label}
                </span>
              </div>
            );
          })}

          {/* Lane background cells - subtle grid lines + conflict highlights */}
          {gridData.intervals.map((interval, rowIdx) =>
            gridData.lanes.map((lane, colIdx) => {
              const cellKey = `${rowIdx}-${lane.id}`;
              const hasConflict = conflictCells.has(cellKey);
              const isRowHighlighted = highlightedIntervalIndex === rowIdx;
              return (
                <div
                  key={`cell-${cellKey}`}
                  className={[
                    "border-b border-r border-slate-100 dark:border-slate-800/50 relative transition-colors duration-300",
                    hasConflict ? "bg-red-50 dark:bg-red-950/20" : "",
                    isRowHighlighted && !hasConflict ? "bg-amber-100/50 dark:bg-amber-800/20" : "",
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
