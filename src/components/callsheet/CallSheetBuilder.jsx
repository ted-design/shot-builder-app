// src/components/callsheet/CallSheetBuilder.jsx
// Main container for the Call Sheet Builder (vertical editor + preview)

import React, { useState, useMemo, useCallback } from "react";
import {
  useSchedule,
  useUpdateScheduleTracks,
  useUpdateScheduleColumns,
} from "../../hooks/useSchedule";
import {
  useResolvedScheduleEntries,
  useMoveEntry,
  useResizeEntry,
  useMoveEntryToTrack,
  useAddShotToSchedule,
  useAddCustomItem,
  useUpdateScheduleEntry,
  useDeleteScheduleEntry,
  useBatchUpdateEntries,
} from "../../hooks/useScheduleEntries";
import { reorderEntry, sortEntriesByTime } from "../../lib/cascadeEngine";
import { DEFAULT_TRACKS, DEFAULT_SCHEDULE_SETTINGS, DEFAULT_COLUMNS } from "../../types/schedule";
import CallSheetToolbar from "./CallSheetToolbar";
import VerticalTimelineView from "./vertical/VerticalTimelineView";
import EntryFormModal from "./entries/EntryFormModal";
import ColumnConfigModal from "./columns/ColumnConfigModal";
import TrackManager from "./tracks/TrackManager";
import CallSheetExportModal from "./export/CallSheetExportModal";
import { toast } from "../../lib/toast";
import { Loader2, Calendar } from "lucide-react";

/**
 * CallSheetBuilder - Main container component for the call sheet timeline editor
 *
 * @param {object} props
 * @param {string} props.clientId - Client ID
 * @param {string} props.projectId - Project ID
 * @param {string} props.scheduleId - ID of the schedule to display/edit
 * @param {Array} props.shots - Array of shots available to add
 * @param {Map} props.shotsMap - Map of shot ID to shot data
 * @param {Map} props.talentMap - Map of talent ID to talent data
 * @param {Map} props.productsMap - Map of product ID to product data
 * @param {Map} props.locationsMap - Map of location ID to location data
 * @param {Function} props.onEditEntry - Callback when user wants to edit an entry
 * @param {Function} props.onEditSchedule - Callback to edit the schedule
 * @param {Function} props.onDeleteSchedule - Callback to delete the schedule
 * @param {Function} props.onDuplicateSchedule - Callback to duplicate the schedule
 */
function CallSheetBuilder({
  clientId,
  projectId,
  scheduleId,
  shots = [],
  shotsLoading = false,
  shotsMap = new Map(),
  talentMap = new Map(),
  productsMap = new Map(),
  locationsMap = new Map(),
  onEditEntry,
  onEditSchedule,
  onDeleteSchedule,
  onDuplicateSchedule,
}) {

  // Modal state
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [entryModalMode, setEntryModalMode] = useState("select"); // 'shot' | 'custom' | 'select'
  const [entryModalCategory, setEntryModalCategory] = useState(null);
  const [isColumnConfigOpen, setIsColumnConfigOpen] = useState(false);
  const [isTrackManagerOpen, setIsTrackManagerOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Schedule data
  const { schedule, loading: scheduleLoading, error: scheduleError } = useSchedule(
    clientId,
    projectId,
    scheduleId
  );

  // Entries with resolved shot data
  const { resolvedEntries, loading: entriesLoading } = useResolvedScheduleEntries(
    clientId,
    projectId,
    scheduleId,
    shotsMap,
    talentMap,
    productsMap,
    locationsMap
  );

  // Mutations
  const { moveEntry, isLoading: isMoving } = useMoveEntry(
    clientId,
    projectId,
    scheduleId,
    schedule?.settings?.cascadeChanges ?? true
  );

  const { resizeEntry, isLoading: isResizing } = useResizeEntry(
    clientId,
    projectId,
    scheduleId,
    schedule?.settings?.cascadeChanges ?? true
  );

  const { moveToTrack } = useMoveEntryToTrack(clientId, projectId, scheduleId);

  // Schedule update hooks
  const { updateTracks } = useUpdateScheduleTracks(clientId, projectId, scheduleId, {
    onSuccess: () => toast.success({ title: "Tracks updated" }),
  });

  const { updateColumns } = useUpdateScheduleColumns(clientId, projectId, scheduleId, {
    onSuccess: () => toast.success({ title: "Columns updated" }),
  });

  // Entry creation hooks
  const { addShotAtEnd, isLoading: isAddingShot } = useAddShotToSchedule(
    clientId,
    projectId,
    scheduleId,
    {
      onSuccess: () => {
        toast.success({ title: "Shot added to schedule" });
      },
    }
  );

  const { addCustomItemAtEnd, isLoading: isAddingCustom } = useAddCustomItem(
    clientId,
    projectId,
    scheduleId,
    {
      onSuccess: () => {
        toast.success({ title: "Item added to schedule" });
      },
    }
  );

  // Entry update hooks (for vertical view)
  const { mutate: updateEntry } = useUpdateScheduleEntry(clientId, projectId, scheduleId);

  const { mutate: deleteEntry } = useDeleteScheduleEntry(clientId, projectId, scheduleId, {
    onSuccess: () => {
      toast.success({ title: "Entry deleted" });
    },
  });

  const { mutate: batchUpdateEntries } = useBatchUpdateEntries(clientId, projectId, scheduleId, {
    onSuccess: () => {
      toast.success({ title: "Entries reordered" });
    },
  });

  // Group entries by track
  const entriesByTrack = useMemo(() => {
    const grouped = new Map();
    const tracks = schedule?.tracks || DEFAULT_TRACKS;

    // Initialize all tracks with empty arrays
    tracks.forEach((track) => {
      grouped.set(track.id, []);
    });

    // Group entries
    resolvedEntries.forEach((entry) => {
      const trackEntries = grouped.get(entry.trackId) || [];
      trackEntries.push(entry);
      grouped.set(entry.trackId, trackEntries);
    });

    return grouped;
  }, [resolvedEntries, schedule?.tracks]);

  // Current settings
  const settings = schedule?.settings || DEFAULT_SCHEDULE_SETTINGS;
  const tracks = schedule?.tracks || DEFAULT_TRACKS;
  const columnConfig = schedule?.columnConfig || [];

  // Modal handlers
  const handleOpenEntryModal = useCallback((type, category = null) => {
    setEntryModalMode(type === "shot" ? "shot" : type === "custom" ? "custom" : "select");
    setEntryModalCategory(category);
    setIsEntryModalOpen(true);
  }, []);

  const handleCloseEntryModal = useCallback(() => {
    setIsEntryModalOpen(false);
    setEntryModalMode("select");
    setEntryModalCategory(null);
  }, []);

  const handleAddShot = useCallback(
    (shotId, trackId) => {
      const duration = settings.defaultEntryDuration || 30;
      addShotAtEnd(shotId, trackId, resolvedEntries, duration);
    },
    [addShotAtEnd, resolvedEntries, settings.defaultEntryDuration]
  );

  const handleAddCustomItem = useCallback(
    (customData, trackId, duration, appliesToTrackIds) => {
      addCustomItemAtEnd(customData, trackId, resolvedEntries, duration, appliesToTrackIds);
    },
    [addCustomItemAtEnd, resolvedEntries]
  );

  // Vertical view handlers
  const handleUpdateEntryNotes = useCallback(
    (entryId, notes) => {
      updateEntry({ entryId, updates: { notes } });
    },
    [updateEntry]
  );

  const handleUpdateEntryLocation = useCallback(
    (entryId, locationId) => {
      updateEntry({ entryId, updates: { locationId } });
    },
    [updateEntry]
  );

  const handleDeleteEntry = useCallback(
    (entryId) => {
      // TODO: Add confirmation dialog
      deleteEntry({ entryId });
    },
    [deleteEntry]
  );

  // Handle inline column resize from preview
  const handleColumnResize = useCallback(
    (columnKey, newWidth) => {
      const currentColumns = columnConfig.length > 0 ? columnConfig : DEFAULT_COLUMNS;
      const updatedColumns = currentColumns.map((col) =>
        col.key === columnKey
          ? { ...col, width: newWidth, visible: newWidth !== "hidden" }
          : col
      );
      updateColumns(updatedColumns);
    },
    [columnConfig, updateColumns]
  );

  const handleReorderEntries = useCallback(
    (entryId, oldIndex, newIndex) => {
      if (oldIndex === newIndex) return;

      // Get sorted entries for finding target
      const sortedEntries = sortEntriesByTime(resolvedEntries);

      // Find the target entry at the new position
      const targetEntry = sortedEntries[newIndex];
      if (!targetEntry) return;

      // Determine insert position: before if moving up, after if moving down
      const position = newIndex < oldIndex ? "before" : "after";

      // Get cascade setting from schedule
      const cascadeEnabled = schedule?.settings?.cascadeChanges ?? true;

      // Call cascade engine to calculate new order and times
      const { reorderedEntries, timeChanges } = reorderEntry(
        resolvedEntries,
        entryId,
        targetEntry.id,
        position,
        { cascadeEnabled, gapMinutes: 0 }
      );

      // Build updates array from order changes and time changes
      const updates = [];

      // Collect order changes
      reorderedEntries.forEach((entry) => {
        const original = resolvedEntries.find((e) => e.id === entry.id);
        if (original && original.order !== entry.order) {
          updates.push({ entryId: entry.id, order: entry.order });
        }
      });

      // Merge time changes
      timeChanges.forEach((change) => {
        if (change.changed) {
          const existing = updates.find((u) => u.entryId === change.id);
          if (existing) {
            existing.startTime = change.startTime;
          } else {
            updates.push({ entryId: change.id, startTime: change.startTime });
          }
        }
      });

      // Execute batch update if there are changes
      if (updates.length > 0) {
        batchUpdateEntries({ updates });
      }
    },
    [resolvedEntries, schedule?.settings?.cascadeChanges, batchUpdateEntries]
  );

  // Locations array for vertical view
  const locationsArray = useMemo(() => {
    return Array.from(locationsMap.values());
  }, [locationsMap]);

  // Loading state
  if (scheduleLoading || entriesLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  // Error state
  if (scheduleError) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4 text-slate-500">
        <p>Failed to load schedule</p>
        <p className="text-sm text-slate-400">{scheduleError.message}</p>
      </div>
    );
  }

  // No schedule state
  if (!schedule) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4 text-slate-500">
        <Calendar className="h-12 w-12 text-slate-300" />
        <p>Schedule not found</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Toolbar */}
      <CallSheetToolbar
        schedule={schedule}
        onAddShot={handleOpenEntryModal}
        settings={settings}
        clientId={clientId}
        projectId={projectId}
        scheduleId={scheduleId}
        onEditColumns={() => setIsColumnConfigOpen(true)}
        onEditTracks={() => setIsTrackManagerOpen(true)}
        onExport={() => setIsExportModalOpen(true)}
        onEditSchedule={onEditSchedule}
        onDeleteSchedule={onDeleteSchedule}
        onDuplicateSchedule={onDuplicateSchedule}
      />

      {/* Editor (vertical) view */}
      <VerticalTimelineView
        schedule={schedule}
        entries={resolvedEntries}
        tracks={tracks}
        locations={locationsArray}
        settings={settings}
        onMoveEntry={(entryId, newTime) => moveEntry(entryId, newTime, resolvedEntries)}
        onResizeEntry={(entryId, newDuration) => resizeEntry(entryId, newDuration, resolvedEntries)}
        onUpdateEntryNotes={handleUpdateEntryNotes}
        onUpdateEntryLocation={handleUpdateEntryLocation}
        onDeleteEntry={handleDeleteEntry}
        onReorderEntries={handleReorderEntries}
        onMoveEntryToTrack={moveToTrack}
        onAddShot={handleOpenEntryModal}
        onAddCustomItem={(category) => handleOpenEntryModal("custom", category)}
        onColumnResize={handleColumnResize}
        onOpenColumnConfig={() => setIsColumnConfigOpen(true)}
      />

      {/* Entry Form Modal */}
      <EntryFormModal
        isOpen={isEntryModalOpen}
        onClose={handleCloseEntryModal}
        mode={entryModalMode}
        initialCategory={entryModalCategory}
        shots={shots}
        shotsLoading={shotsLoading}
        tracks={tracks}
        existingEntries={resolvedEntries}
        talentMap={talentMap}
        productsMap={productsMap}
        onAddShot={handleAddShot}
        onAddCustomItem={handleAddCustomItem}
      />

      {/* Column Configuration Modal */}
      <ColumnConfigModal
        isOpen={isColumnConfigOpen}
        onClose={() => setIsColumnConfigOpen(false)}
        columns={columnConfig.length > 0 ? columnConfig : DEFAULT_COLUMNS}
        onSave={updateColumns}
      />

      {/* Track Manager Modal */}
      <TrackManager
        isOpen={isTrackManagerOpen}
        onClose={() => setIsTrackManagerOpen(false)}
        tracks={tracks}
        onSave={updateTracks}
        entriesByTrack={entriesByTrack}
      />

      {/* Export Modal */}
      <CallSheetExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        schedule={schedule}
        entries={resolvedEntries}
        tracks={tracks}
      />
    </div>
  );
}

export default CallSheetBuilder;
