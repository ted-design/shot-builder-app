// src/components/callsheet/CallSheetBuilder.jsx
// Main container for the Call Sheet Builder (vertical editor + preview)

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  useSchedule,
  useUpdateScheduleTracks,
  useUpdateScheduleColumns,
  useUpdateScheduleSettings,
} from "../../hooks/useSchedule";
import {
  useResolvedScheduleEntries,
  useMoveEntry,
  useResizeEntry,
  useAddShotToSchedule,
  useAddCustomItem,
  useUpdateScheduleEntry,
  useDeleteScheduleEntry,
  useBatchUpdateEntries,
} from "../../hooks/useScheduleEntries";
import { useCreateShot } from "../../hooks/useFirestoreMutations";
import { sortEntriesByTime } from "../../lib/cascadeEngine";
import {
  buildGaplessNormalizeStartTimeUpdates,
  buildGaplessReorderUpdates,
  getTrackAnchorStartMinutes,
} from "../../lib/gaplessSchedule";
import { DEFAULT_TRACKS, DEFAULT_SCHEDULE_SETTINGS, DEFAULT_COLUMNS } from "../../types/schedule";
import CallSheetToolbar from "./CallSheetToolbar";
import VerticalTimelineView from "./vertical/VerticalTimelineView";
import EntryFormModal from "./entries/EntryFormModal";
import ScheduleShotEditorModal from "./entries/ScheduleShotEditorModal";
import ColumnConfigModal from "./columns/ColumnConfigModal";
import TrackManager from "./tracks/TrackManager";
import CallSheetExportModal from "./export/CallSheetExportModal";
import { toast } from "../../lib/toast";
import { Loader2, Calendar } from "lucide-react";
import { parseDateToTimestamp } from "../../lib/shotDraft";
import { minutesToTimeString, parseTimeToMinutes } from "../../lib/timeUtils";

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
  const [editingEntry, setEditingEntry] = useState(null);
  const [isColumnConfigOpen, setIsColumnConfigOpen] = useState(false);
  const [isTrackManagerOpen, setIsTrackManagerOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isShotEditorOpen, setIsShotEditorOpen] = useState(false);
  const [shotEditorShot, setShotEditorShot] = useState(null);

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

  // Schedule update hooks
  const { updateTracks } = useUpdateScheduleTracks(clientId, projectId, scheduleId, {
    onSuccess: () => toast.success({ title: "Tracks updated" }),
  });

  const { updateColumns, updateColumn } = useUpdateScheduleColumns(clientId, projectId, scheduleId, {
    onSuccess: () => toast.success({ title: "Columns updated" }),
  });

  const { setDayStartTime } = useUpdateScheduleSettings(clientId, projectId, scheduleId, {
    onSuccess: () => toast.success({ title: "Schedule settings updated" }),
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

  const createShotMutation = useCreateShot(clientId, { projectId });

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
  const effectiveColumns = columnConfig.length > 0 ? columnConfig : DEFAULT_COLUMNS;

  // Modal handlers
  const handleOpenEntryModal = useCallback((type, category = null) => {
    setEntryModalMode(type === "shot" ? "shot" : type === "custom" ? "custom" : "select");
    setEntryModalCategory(category);
    setEditingEntry(null);
    setIsEntryModalOpen(true);
  }, []);

  const handleCloseEntryModal = useCallback(() => {
    setIsEntryModalOpen(false);
    setEntryModalMode("select");
    setEntryModalCategory(null);
    setEditingEntry(null);
  }, []);

  const handleAddShot = useCallback(
    (shotId, trackId) => {
      const duration = typeof settings.defaultEntryDuration === "number" ? settings.defaultEntryDuration : 15;
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

  const handleEditCustomEntry = useCallback((entry) => {
    if (!entry || entry.type !== "custom") return;
    setEditingEntry(entry);
    setEntryModalMode("custom");
    setEntryModalCategory(entry.customData?.category || null);
    setIsEntryModalOpen(true);
  }, []);

  const handleUpdateCustomItem = useCallback(
    async (entryId, { customData, trackId, duration, appliesToTrackIds }) => {
      if (!entryId) return;
      const updates = {
        customData,
        trackId,
        duration,
        appliesToTrackIds: appliesToTrackIds ?? null,
        notes: customData?.notes ? String(customData.notes) : null,
      };
      updateEntry({ entryId, updates });
      toast.success({ title: "Banner updated" });
      handleCloseEntryModal();
    },
    [handleCloseEntryModal, updateEntry]
  );

  const handleColumnResize = useCallback(
    (columnKey, nextWidth) => {
      const updates = {
        width: nextWidth,
      };
      updateColumn(columnKey, updates, effectiveColumns);
    },
    [effectiveColumns, updateColumn]
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

  const handleReorderEntries = useCallback(
    (entryId, oldIndex, newIndex) => {
      if (oldIndex === newIndex) return;

      const sortedEntries = sortEntriesByTime(resolvedEntries);
      const movedEntry = sortedEntries.find((entry) => entry.id === entryId);
      if (!movedEntry) return;

      const clampedOldIndex = Math.max(0, Math.min(sortedEntries.length - 1, oldIndex));
      const clampedNewIndex = Math.max(0, Math.min(sortedEntries.length - 1, newIndex));
      if (clampedOldIndex === clampedNewIndex) return;

      const reorderedGlobal = [...sortedEntries];
      const [removed] = reorderedGlobal.splice(clampedOldIndex, 1);
      reorderedGlobal.splice(clampedNewIndex, 0, removed);

      const trackId = movedEntry.trackId;
      const trackEntries = resolvedEntries.filter((entry) => entry.trackId === trackId);
      const anchorStartMinutes = getTrackAnchorStartMinutes(trackEntries);

      const orderedTrackIds = reorderedGlobal
        .filter((entry) => entry.trackId === trackId)
        .map((entry) => entry.id);

      const updates = buildGaplessReorderUpdates(resolvedEntries, trackId, orderedTrackIds, {
        anchorStartMinutes,
      });

      if (updates.length > 0) batchUpdateEntries({ updates });
    },
    [resolvedEntries, batchUpdateEntries]
  );

  const handleMoveEntryToTrack = useCallback(
    (entryId, newTrackId) => {
      const entry = resolvedEntries.find((candidate) => candidate.id === entryId);
      if (!entry || !newTrackId || entry.trackId === newTrackId) return;

      const sourceTrackId = entry.trackId;
      const nextEntries = resolvedEntries.map((candidate) =>
        candidate.id === entryId ? { ...candidate, trackId: newTrackId } : candidate
      );

      const globalSorted = sortEntriesByTime(nextEntries);

      const sourceEntriesBefore = resolvedEntries.filter((candidate) => candidate.trackId === sourceTrackId);
      const destEntriesBefore = resolvedEntries.filter((candidate) => candidate.trackId === newTrackId);

      const sourceAnchor = getTrackAnchorStartMinutes(sourceEntriesBefore);
      const destAnchor = getTrackAnchorStartMinutes(destEntriesBefore) ?? parseTimeToMinutes(entry.startTime);

      const sourceOrderIds = globalSorted
        .filter((candidate) => candidate.trackId === sourceTrackId)
        .map((candidate) => candidate.id);
      const destOrderIds = globalSorted
        .filter((candidate) => candidate.trackId === newTrackId)
        .map((candidate) => candidate.id);

      const updates = [];
      updates.push({ entryId, trackId: newTrackId });

      const sourceUpdates = buildGaplessReorderUpdates(nextEntries, sourceTrackId, sourceOrderIds, {
        anchorStartMinutes: sourceAnchor,
      });
      const destUpdates = buildGaplessReorderUpdates(nextEntries, newTrackId, destOrderIds, {
        anchorStartMinutes: destAnchor,
      });

      const byId = new Map();
      const merge = (update) => {
        const existing = byId.get(update.entryId) || { entryId: update.entryId };
        byId.set(update.entryId, { ...existing, ...update });
      };

      updates.forEach(merge);
      sourceUpdates.forEach(merge);
      destUpdates.forEach(merge);

      const merged = Array.from(byId.values());
      if (merged.length > 0) batchUpdateEntries({ updates: merged });
    },
    [resolvedEntries, batchUpdateEntries]
  );

  // One-time normalization per schedule to remove overlaps/gaps in each lane track.
  // This also fixes single-track "shared" banners (appliesToTrackIds length 1) by packing them with that lane.
  const normalizedScheduleRef = useRef(null);
  useEffect(() => {
    if (!scheduleId) return;
    if (!schedule?.settings?.cascadeChanges) return;
    if (entriesLoading) return;
    if (normalizedScheduleRef.current === scheduleId) return;
    if (!Array.isArray(resolvedEntries) || resolvedEntries.length === 0) return;

    const laneTrackIds = (tracks || [])
      .filter((t) => t.scope !== "shared" && t.id !== "shared")
      .map((t) => t.id);
    if (laneTrackIds.length === 0) return;

    const updates = [];
    laneTrackIds.forEach((trackId) => {
      updates.push(...buildGaplessNormalizeStartTimeUpdates(resolvedEntries, trackId));
    });

    if (updates.length > 0) {
      batchUpdateEntries({ updates });
    }

    normalizedScheduleRef.current = scheduleId;
  }, [scheduleId, schedule?.settings?.cascadeChanges, entriesLoading, resolvedEntries, tracks, batchUpdateEntries]);

  // Locations array for vertical view
  const locationsArray = useMemo(() => {
    return Array.from(locationsMap.values());
  }, [locationsMap]);

  const productFamilies = useMemo(() => Array.from(productsMap.values()), [productsMap]);
  const talentOptions = useMemo(() => Array.from(talentMap.values()), [talentMap]);

  const handleSetDayStartTime = useCallback(
    (nextDayStartTime) => {
      const nextValue = typeof nextDayStartTime === "string" ? nextDayStartTime : settings.dayStartTime;
      if (!nextValue) return;

      if (!Array.isArray(resolvedEntries) || resolvedEntries.length === 0) {
        setDayStartTime(nextValue, settings);
        return;
      }

      let earliestStartMinutes = null;
      let latestEndMinutes = null;
      resolvedEntries.forEach((entry) => {
        const startMinutes = parseTimeToMinutes(entry.startTime || settings.dayStartTime || "00:00");
        const duration = typeof entry.duration === "number" ? Math.max(0, entry.duration) : 0;
        const endMinutes = startMinutes + duration;
        if (earliestStartMinutes == null || startMinutes < earliestStartMinutes) earliestStartMinutes = startMinutes;
        if (latestEndMinutes == null || endMinutes > latestEndMinutes) latestEndMinutes = endMinutes;
      });

      if (earliestStartMinutes == null) {
        setDayStartTime(nextValue, settings);
        return;
      }

      const targetStartMinutes = parseTimeToMinutes(nextValue);
      const delta = targetStartMinutes - earliestStartMinutes;

      if (delta !== 0 && latestEndMinutes != null) {
        const shiftedStart = earliestStartMinutes + delta;
        const shiftedEnd = latestEndMinutes + delta;
        if (shiftedStart < 0 || shiftedEnd > 24 * 60) {
          toast.error({
            title: "Start time out of range",
            description: "Choose a start time that keeps all entries within the day.",
          });
          return;
        }
      }

      if (delta !== 0) {
        const updates = resolvedEntries
          .map((entry) => {
            const startMinutes = parseTimeToMinutes(entry.startTime || "00:00");
            const nextStartTime = minutesToTimeString(startMinutes + delta);
            if (nextStartTime === entry.startTime) return null;
            return { entryId: entry.id, startTime: nextStartTime };
          })
          .filter(Boolean);

        if (updates.length > 0) {
          batchUpdateEntries({ updates });
        }
      }

      setDayStartTime(nextValue, settings);
    },
    [resolvedEntries, batchUpdateEntries, setDayStartTime, settings]
  );

  const handleCreateShotInSchedule = useCallback(
    async (trackId) => {
      if (!clientId || !projectId) return;
      const effectiveTrackId = trackId || tracks.find((t) => t.scope !== "shared" && t.id !== "shared")?.id || tracks[0]?.id;
      if (!effectiveTrackId) return;

      const today = new Date().toISOString().slice(0, 10);
      const baseShot = {
        projectId,
        name: "New Shot",
        shotNumber: "",
        type: "",
        description: "",
        status: "todo",
        date: parseDateToTimestamp(today),
        locationId: "",
        products: [],
        productIds: [],
        talent: [],
        talentIds: [],
        tags: [],
        notes: "",
        referenceImagePath: "",
        attachments: [],
      };

      const created = await createShotMutation.mutateAsync(baseShot);
      const duration = typeof settings.defaultEntryDuration === "number" ? settings.defaultEntryDuration : 15;
      addShotAtEnd(created.id, effectiveTrackId, resolvedEntries, duration);
      setShotEditorShot({ ...baseShot, id: created.id });
      setIsShotEditorOpen(true);
    },
    [
      clientId,
      projectId,
      tracks,
      settings.defaultEntryDuration,
      createShotMutation,
      addShotAtEnd,
      resolvedEntries,
    ]
  );

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
        onSetDayStartTime={handleSetDayStartTime}
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
        columnConfig={effectiveColumns}
        onColumnResize={handleColumnResize}
        onMoveEntry={(entryId, newTime) => moveEntry(entryId, newTime, resolvedEntries)}
        onResizeEntry={(entryId, newDuration) => resizeEntry(entryId, newDuration, resolvedEntries)}
        onUpdateEntryNotes={handleUpdateEntryNotes}
        onUpdateEntryLocation={handleUpdateEntryLocation}
        onDeleteEntry={handleDeleteEntry}
        onReorderEntries={handleReorderEntries}
        onMoveEntryToTrack={handleMoveEntryToTrack}
        onAddShot={handleOpenEntryModal}
        onAddCustomItem={(category) => handleOpenEntryModal("custom", category)}
        onOpenColumnConfig={() => setIsColumnConfigOpen(true)}
        onEditEntry={handleEditCustomEntry}
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
        onCreateShot={handleCreateShotInSchedule}
        onAddCustomItem={handleAddCustomItem}
        onUpdateCustomItem={handleUpdateCustomItem}
        editingEntry={editingEntry}
      />

      <ScheduleShotEditorModal
        open={isShotEditorOpen}
        onClose={() => {
          setIsShotEditorOpen(false);
          setShotEditorShot(null);
        }}
        clientId={clientId}
        projectId={projectId}
        shot={shotEditorShot}
        families={productFamilies}
        locations={locationsArray}
        talentOptions={talentOptions}
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
