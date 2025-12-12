// src/components/callsheet/vertical/VerticalTimelineView.jsx
// Main container for the vertical timeline view (SetHero-style)
// Split-pane layout: left = entry editor, right = live preview

import React, { useState, useMemo, useCallback } from "react";
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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus, Camera, Coffee, Clock } from "lucide-react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Button } from "../../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
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
 * @param {Function} props.onColumnResize - Callback for inline column resize (key, newWidth)
 * @param {Function} props.onOpenColumnConfig - Callback to open full column config modal
 */
function VerticalTimelineView({
  schedule,
  entries = [],
  tracks = [],
  locations = [],
  settings = {},
  onMoveEntry,
  onResizeEntry,
  onUpdateEntryNotes,
  onUpdateEntryLocation,
  onDeleteEntry,
  onReorderEntries,
  onMoveEntryToTrack,
  onAddShot,
  onAddCustomItem,
  onColumnResize,
  onOpenColumnConfig,
}) {
  const [selectedEntryId, setSelectedEntryId] = useState(null);
  const [previewZoom, setPreviewZoom] = useState(1);

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

  // Entry IDs for sortable context
  const entryIds = useMemo(() => sortedEntries.map((e) => e.id), [sortedEntries]);

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

  return (
    <PanelGroup direction="horizontal" className="h-full">
      {/* Left Panel - Entry Editor */}
      <Panel defaultSize={60} minSize={30}>
        <div className="flex h-full flex-col border-r border-slate-200 dark:border-slate-700">
        {/* Panel Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">
              Schedule Entries
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {sortedEntries.length} items
              {settings.cascadeChanges && " • Cascade mode"}
            </p>
          </div>

          {/* Add Button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onAddShot?.("shot")}>
                <Camera className="mr-2 h-4 w-4" />
                Add Shot
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onAddCustomItem?.("setup")}>
                <Clock className="mr-2 h-4 w-4" />
                Setup / Load-in
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAddCustomItem?.("break")}>
                <Coffee className="mr-2 h-4 w-4" />
                Break
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAddCustomItem?.("lunch")}>
                Lunch
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAddCustomItem?.("wrap")}>
                Wrap
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onAddCustomItem?.("travel")}>
                Location Move
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAddCustomItem?.("other")}>
                Custom Item
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

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
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {Array.from(entriesByTimeSlot.entries()).map(([time, timeEntries]) => (
                    <div key={time} className="flex flex-wrap gap-3">
                      {timeEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className={timeEntries.length > 1 ? "flex-1 min-w-[300px]" : "w-full"}
                        >
                          <VerticalEntryCard
                            entry={entry}
                            track={getTrackForEntry(entry)}
                            tracks={tracks}
                            locations={locations}
                            settings={settings}
                            isSelected={selectedEntryId === entry.id}
                            onSelect={setSelectedEntryId}
                            onTimeChange={handleTimeChange}
                            onDurationChange={handleDurationChange}
                            onNotesChange={handleNotesChange}
                            onLocationChange={handleLocationChange}
                            onTrackChange={handleTrackChange}
                            onDelete={handleDelete}
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
        </div>
      </Panel>

      {/* Resize Handle */}
      <PanelResizeHandle className="w-1.5 bg-slate-200 transition-colors hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600" />

      {/* Right Panel - Live Preview */}
      <Panel defaultSize={40} minSize={20}>
        <div className="flex h-full flex-col bg-slate-50 dark:bg-slate-900">
        {/* Preview Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">
            Preview
          </h3>
          {/* Zoom Controls */}
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant={previewZoom === 0.75 ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setPreviewZoom(0.75)}
              className="h-7 px-2 text-xs"
            >
              75%
            </Button>
            <Button
              type="button"
              variant={previewZoom === 1 ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setPreviewZoom(1)}
              className="h-7 px-2 text-xs"
            >
              100%
            </Button>
            <Button
              type="button"
              variant={previewZoom === 1.25 ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setPreviewZoom(1.25)}
              className="h-7 px-2 text-xs"
            >
              125%
            </Button>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-hidden">
          <CallSheetPreview
            schedule={schedule}
            entries={sortedEntries}
            tracks={tracks}
            columnConfig={schedule?.columnConfig}
            zoomLevel={previewZoom}
            onColumnResize={onColumnResize}
            onOpenColumnConfig={onOpenColumnConfig}
          />
        </div>
        </div>
      </Panel>
    </PanelGroup>
  );
}

export default VerticalTimelineView;
