// src/components/callsheet/vertical/VerticalTimelineView.jsx
// Main container for the vertical timeline view (SetHero-style)
// Split-pane layout: left = entry editor, right = live preview

import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import {
  Plus,
  Camera,
  Image as ImageIcon,
  ImageOff,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  RotateCcw,
  Maximize2,
  Minimize2,
  Settings,
} from "lucide-react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Button } from "../../ui/button";
import VerticalEntryCard from "./VerticalEntryCard";
import CallSheetPreview from "./CallSheetPreview";
import { sortEntriesByTime } from "../../../lib/cascadeEngine";

/**
 * VerticalTimelineView - Main container for vertical timeline with split layout
 *
 * @param {object} props
 * @param {object} props.schedule - Schedule object
 * @param {Array} props.entries - Resolved schedule entries
 * @param {Array} props.tracks - Tracks array
 * @param {Array} props.locations - Available locations
 * @param {object} props.settings - Schedule settings
 * @param {Function} props.onMoveEntry - Callback to move entry time
 * @param {Function} props.onResizeEntry - Callback to change entry duration
 * @param {Function} props.onUpdateEntryNotes - Callback to update notes
 * @param {Function} props.onUpdateEntryLocation - Callback to update location
 * @param {Function} props.onDeleteEntry - Callback to delete entry
 * @param {Function} props.onReorderEntries - Callback for drag reorder
 * @param {Function} props.onMoveEntryToTrack - Callback to move entry to different track
 * @param {Function} props.onAddShot - Callback to add shot
 * @param {Function} props.onAddCustomItem - Callback to add custom item
 * @param {Function} props.onOpenColumnConfig - Callback to open full column config modal
 * @param {Function} props.onEditEntry - Callback to edit a custom entry
 * @param {Array} props.columnConfig - Column config for single-track preview
 * @param {Function} props.onColumnResize - Callback when preview column is resized
 */
function VerticalTimelineView({
  schedule,
  entries = [],
  tracks = [],
  locations = [],
  settings = {},
  showPreviewPanel = true,
  showEditorHeader = true,
  trackFocusId = "all",
  onMoveEntry,
  onResizeEntry,
  onUpdateEntryNotes,
  onUpdateEntryLocation,
  onUpdateEntryFlag,
  onUpdateEntryMarker,
  onDeleteEntry,
  onReorderEntries,
  onMoveEntryToTrack,
  onAddShot,
  onAddCustomItem,
  onOpenColumnConfig,
  onEditShotEntry,
  onEditEntry,
  columnConfig,
  onColumnResize,
}) {
  const [activeEntryId, setActiveEntryId] = useState(null);
  const [checkedEntryIds, setCheckedEntryIds] = useState(() => new Set());
  // Track which entry's TimePicker is open (by stable entry.id) to survive group remounting
  const [openTimePickerForId, setOpenTimePickerForId] = useState(null);
  const [previewZoomPercent, setPreviewZoomPercent] = useState(100);
  const [previewRefreshNonce, setPreviewRefreshNonce] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPreviewImages, setShowPreviewImages] = useState(() => {
    try {
      const stored = localStorage.getItem("callSheetPreview.showImages");
      if (stored == null) return true;
      return stored === "true";
    } catch (error) {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("callSheetPreview.showImages", String(showPreviewImages));
    } catch (error) {
      // ignore storage failures
    }
  }, [showPreviewImages]);

  const previewZoom = useMemo(() => previewZoomPercent / 100, [previewZoomPercent]);
  const zoomStep = 10;
  const minZoom = 50;
  const maxZoom = 200;

  const handleZoomOut = useCallback(() => {
    setPreviewZoomPercent((prev) => Math.max(minZoom, prev - zoomStep));
  }, []);

  const handleZoomIn = useCallback(() => {
    setPreviewZoomPercent((prev) => Math.min(maxZoom, prev + zoomStep));
  }, []);

  const handleResetZoom = useCallback(() => {
    setPreviewZoomPercent(100);
  }, []);

  const handleRefreshPreview = useCallback(() => {
    setPreviewRefreshNonce((prev) => prev + 1);
  }, []);

  // Sort entries by start time
  const sortedEntries = useMemo(() => {
    return sortEntriesByTime(entries);
  }, [entries]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end for reordering
  const handleDragEnd = useCallback(
    (event) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = sortedEntries.findIndex((e) => e.id === active.id);
        const newIndex = sortedEntries.findIndex((e) => e.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1 && onReorderEntries) {
          onReorderEntries(active.id, oldIndex, newIndex);
        }
      }
    },
    [sortedEntries, onReorderEntries]
  );

  // Handle time change
  const handleTimeChange = useCallback(
    (entryId, newTime) => {
      if (onMoveEntry) {
        onMoveEntry(entryId, newTime);
      }
    },
    [onMoveEntry]
  );

  // Handle duration change
  const handleDurationChange = useCallback(
    (entryId, newDuration) => {
      if (onResizeEntry) {
        onResizeEntry(entryId, newDuration);
      }
    },
    [onResizeEntry]
  );

  // Handle notes change
  const handleNotesChange = useCallback(
    (entryId, newNotes) => {
      if (onUpdateEntryNotes) {
        onUpdateEntryNotes(entryId, newNotes);
      }
    },
    [onUpdateEntryNotes]
  );

  // Handle location change
  const handleLocationChange = useCallback(
    (entryId, locationId) => {
      if (onUpdateEntryLocation) {
        onUpdateEntryLocation(entryId, locationId);
      }
    },
    [onUpdateEntryLocation]
  );

  const handleFlagChange = useCallback(
    (entryId, flagValue) => {
      if (onUpdateEntryFlag) {
        onUpdateEntryFlag(entryId, flagValue);
      }
    },
    [onUpdateEntryFlag]
  );

  // Handle marker change (visual markers, separate from flag tags)
  const handleMarkerChange = useCallback(
    (entryId, marker) => {
      if (onUpdateEntryMarker) {
        onUpdateEntryMarker(entryId, marker);
      }
    },
    [onUpdateEntryMarker]
  );

  // Handle track change
  const handleTrackChange = useCallback(
    (entryId, newTrackId) => {
      if (onMoveEntryToTrack) {
        onMoveEntryToTrack(entryId, newTrackId);
      }
    },
    [onMoveEntryToTrack]
  );

  // Handle delete
  const handleDelete = useCallback(
    (entryId) => {
      if (onDeleteEntry) {
        onDeleteEntry(entryId);
      }
    },
    [onDeleteEntry]
  );

  // Get track for entry
  const getTrackForEntry = useCallback(
    (entry) => {
      return tracks.find((t) => t.id === entry.trackId) || tracks[0];
    },
    [tracks]
  );

  const handleCheckedChange = useCallback((entryId, nextChecked) => {
    setCheckedEntryIds((prev) => {
      const next = new Set(prev);
      if (nextChecked) next.add(entryId);
      else next.delete(entryId);
      return next;
    });
  }, []);

  // Entry IDs for sortable context
  const entryIds = useMemo(() => sortedEntries.map((e) => e.id), [sortedEntries]);

  // Auto-clear openTimePickerForId when the referenced entry is no longer rendered
  useEffect(() => {
    if (openTimePickerForId != null && !entryIds.includes(openTimePickerForId)) {
      setOpenTimePickerForId(null);
    }
  }, [openTimePickerForId, entryIds]);

  // Group entries by time-slot for side-by-side display of concurrent entries
  const entriesByTimeSlot = useMemo(() => {
    const grouped = new Map();
    sortedEntries.forEach((entry) => {
      const time = entry.startTime || "00:00";
      if (!grouped.has(time)) {
        grouped.set(time, []);
      }
      grouped.get(time).push(entry);
    });
    return grouped;
  }, [sortedEntries]);

  const previewHeader = showPreviewPanel ? (
    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
      <h3 className="font-semibold text-slate-900 dark:text-slate-100">Preview</h3>
      <div className="flex items-center gap-2">
        {/* Zoom Controls */}
        <div className="flex items-center overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleZoomOut}
            disabled={previewZoomPercent <= minZoom}
            className="h-9 w-9 rounded-none"
            title="Zoom out"
          >
            <ZoomOut className="h-5 w-5" />
          </Button>
          <div className="flex h-9 min-w-[60px] items-center justify-center border-x border-slate-200 px-2 text-xs font-medium tabular-nums text-slate-700 dark:border-slate-700 dark:text-slate-200">
            {previewZoomPercent}%
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleZoomIn}
            disabled={previewZoomPercent >= maxZoom}
            className="h-9 w-9 rounded-none"
            title="Zoom in"
          >
            <ZoomIn className="h-5 w-5" />
          </Button>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleResetZoom}
          disabled={previewZoomPercent === 100}
          className="h-9 w-9"
          title="Reset zoom"
        >
          <RotateCcw className="h-5 w-5" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleRefreshPreview}
          className="h-9 w-9"
          title="Refresh preview"
        >
          <RefreshCw className="h-5 w-5" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowPreviewImages((prev) => !prev)}
          className="h-9 w-9"
          title={showPreviewImages ? "Hide images" : "Show images"}
        >
          {showPreviewImages ? (
            <ImageIcon className="h-5 w-5" />
          ) : (
            <ImageOff className="h-5 w-5" />
          )}
        </Button>

        {onOpenColumnConfig ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onOpenColumnConfig}
            className="h-9 w-9"
            title="Configure columns"
          >
            <Settings className="h-5 w-5" />
          </Button>
        ) : null}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsFullscreen((prev) => !prev)}
          className="h-9 w-9"
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? (
            <Minimize2 className="h-5 w-5" />
          ) : (
            <Maximize2 className="h-5 w-5" />
          )}
        </Button>
      </div>
    </div>
  ) : null;

  const content = (
    <PanelGroup direction="horizontal" className="h-full">
      {/* Left Panel - Entry Editor */}
      <Panel defaultSize={60} minSize={30}>
        <div
          className={[
            "flex h-full flex-col",
            showPreviewPanel ? "border-r border-slate-200 dark:border-slate-700" : "",
          ].join(" ")}
        >
        {/* Panel Header */}
        {showEditorHeader ? (
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Schedule Entries</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {sortedEntries.length} items{settings.cascadeChanges ? " • Cascade mode" : ""}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" size="sm" className="gap-1.5" onClick={() => onAddShot?.("shot")}>
                <Plus className="h-4 w-4" />
                Add Shot
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => onAddCustomItem?.()}
              >
                <Plus className="h-4 w-4" />
                Add Banner
              </Button>
            </div>
          </div>
        ) : null}

        {/* Scrollable Entry List */}
        <div className="flex-1 overflow-y-auto p-4">
          {sortedEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <Camera className="h-8 w-8 text-slate-400" />
              </div>
              <h4 className="mb-2 font-medium text-slate-900 dark:text-slate-100">
                No entries yet
              </h4>
              <p className="mb-4 max-w-xs text-sm text-slate-500 dark:text-slate-400">
                Add shots from your project or create custom items like breaks and
                setup times.
              </p>
              <Button
                type="button"
                onClick={() => onAddShot?.("shot")}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Add First Entry
              </Button>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={entryIds}
                strategy={rectSortingStrategy}
              >
                <div className="space-y-4">
                  {Array.from(entriesByTimeSlot.entries()).map(([time, timeEntries]) => (
                    <div key={time} className="flex flex-wrap gap-4">
                      {timeEntries.map((entry) => {
                        // Track focus dimming: dim entries that don't match the focused track
                        const isDimmed = trackFocusId !== "all" && entry.trackId !== trackFocusId;
                        return (
                        <div
                          key={entry.id}
                          className={[
                            timeEntries.length > 1 ? "flex-1 min-w-[300px]" : "w-full",
                            isDimmed ? "opacity-40 transition-opacity" : "transition-opacity",
                          ].join(" ")}
                        >
                          <VerticalEntryCard
                            entry={entry}
                            track={getTrackForEntry(entry)}
                            tracks={tracks}
                            locations={locations}
                            settings={settings}
                            isSelected={activeEntryId === entry.id}
                            checked={checkedEntryIds.has(entry.id)}
                            onSelect={setActiveEntryId}
                            onCheckedChange={handleCheckedChange}
                            onTimeChange={handleTimeChange}
                            onDurationChange={handleDurationChange}
                            onNotesChange={handleNotesChange}
                            onLocationChange={handleLocationChange}
                            onTrackChange={handleTrackChange}
                            onFlagChange={handleFlagChange}
                            onMarkerChange={handleMarkerChange}
                            onEditShot={onEditShotEntry}
                            onEditCustom={onEditEntry}
                            onDelete={handleDelete}
                            timePickerOpen={openTimePickerForId === entry.id}
                            onTimePickerOpenChange={(nextOpen) =>
                              setOpenTimePickerForId(nextOpen ? entry.id : null)
                            }
                          />
                        </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
        </div>
      </Panel>

      {showPreviewPanel ? (
        <>
          {/* Resize Handle */}
          <PanelResizeHandle className="w-1.5 bg-slate-200 transition-colors hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600" />

          {/* Right Panel - Live Preview */}
          <Panel defaultSize={40} minSize={20}>
            <div className="flex h-full flex-col bg-slate-50 dark:bg-slate-900">
              {/* Preview Header */}
              {previewHeader}

              {/* Preview Content */}
              <div className="flex-1 overflow-hidden">
                <CallSheetPreview
                  key={previewRefreshNonce}
                  schedule={schedule}
                  entries={sortedEntries}
                  tracks={tracks}
                  columnConfig={columnConfig}
                  zoomLevel={previewZoom}
                  showImages={showPreviewImages}
                  onColumnResize={onColumnResize}
                />
              </div>
            </div>
          </Panel>
        </>
      ) : null}
    </PanelGroup>
  );

  if (showPreviewPanel && isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex h-screen w-screen flex-col bg-slate-50 dark:bg-slate-900">
        {content}
      </div>
    );
  }

  return content;
}

export default VerticalTimelineView;
