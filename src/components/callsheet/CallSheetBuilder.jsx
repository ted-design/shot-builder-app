// src/components/callsheet/CallSheetBuilder.jsx
// Main container for the Call Sheet Builder (vertical editor + preview)

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  useSchedule,
  useUpdateScheduleTracks,
  useUpdateScheduleColumns,
  useUpdateScheduleSettings,
} from "../../hooks/useSchedule";
import { useCallSheetConfig } from "../../hooks/useCallSheetConfig";
import { useDayDetails } from "../../hooks/useDayDetails";
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
import WorkingPanel from "./builder/WorkingPanel";
import PreviewPanel from "./builder/PreviewPanel";
import { buildCallSheetLayoutV2 } from "../../lib/callsheet/layoutV2";
import { useCallSheetLayoutV2 } from "../../hooks/useCallSheetLayoutV2";
import { useProjectMemberRole } from "../../hooks/useProjectMemberRole";
import { useTalentCalls } from "../../hooks/useTalentCalls";
import { useCrewCalls } from "../../hooks/useCrewCalls";
import { useClientCalls } from "../../hooks/useClientCalls";
import { useOrganizationCrew } from "../../hooks/useOrganizationCrew";
import { useProjectCrew } from "../../hooks/useProjectCrew";
import { useDepartments } from "../../hooks/useDepartments";
import { useProjectDepartments } from "../../hooks/useProjectDepartments";
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
  viewMode = "builder",
  projectTitle = "",
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
  const normalizedViewMode = viewMode === "preview" ? "preview" : "builder";
  const isPreviewOnly = normalizedViewMode === "preview";

  // Modal state
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [entryModalMode, setEntryModalMode] = useState("select"); // 'shot' | 'custom' | 'select'
  const [entryModalCategory, setEntryModalCategory] = useState(null);
  const [entryModalStartTime, setEntryModalStartTime] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [isColumnConfigOpen, setIsColumnConfigOpen] = useState(false);
  const [isTrackManagerOpen, setIsTrackManagerOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isShotEditorOpen, setIsShotEditorOpen] = useState(false);
  const [shotEditorShot, setShotEditorShot] = useState(null);

  // Track focus mode - session-only state for dimming entries from other tracks
  const [trackFocusId, setTrackFocusId] = useState("all");

  // Schedule view mode - controls which view component is rendered (list, byTrack, timeline)
  const [scheduleViewMode, setScheduleViewMode] = useState("list");

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

  const { updateSettings, toggleCascade, setDayStartTime } = useUpdateScheduleSettings(clientId, projectId, scheduleId, {
    onSuccess: () => toast.success({ title: "Schedule settings updated" }),
  });

  // Entry creation hooks
  const { addShot, addShotAtEnd, isLoading: isAddingShot } = useAddShotToSchedule(
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

  const { addCustomItem, addCustomItemAtEnd, isLoading: isAddingCustom } = useAddCustomItem(
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

  // Call sheet config (sections/settings)
  const {
    config: remoteCallSheetConfig,
    ensureConfig,
    updateConfig,
  } = useCallSheetConfig(clientId, projectId, scheduleId);

  const { projectRole, canWrite: canWriteProject } = useProjectMemberRole(clientId, projectId);

  const [callSheetConfig, setCallSheetConfig] = useState(remoteCallSheetConfig);
  const [activeSectionId, setActiveSectionId] = useState(null);
  const [panelView, setPanelView] = useState({ mode: "outline" });
  const layoutInitAttemptedRef = useRef(false);
  const configInitAttemptedRef = useRef(false);

  useEffect(() => {
    setCallSheetConfig(remoteCallSheetConfig);
  }, [remoteCallSheetConfig]);

  // Reset config init flag when schedule changes
  useEffect(() => {
    configInitAttemptedRef.current = false;
  }, [scheduleId]);

  useEffect(() => {
    if (!clientId || !projectId || !scheduleId) return;
    if (!canWriteProject) return;
    if (ensureConfig.isPending || configInitAttemptedRef.current) return;
    configInitAttemptedRef.current = true;
    ensureConfig.mutate();
  }, [clientId, projectId, scheduleId, canWriteProject, ensureConfig]);

  useEffect(() => {
    layoutInitAttemptedRef.current = false;
  }, [scheduleId]);

  useEffect(() => {
    setPanelView({ mode: "outline" });
  }, [scheduleId]);

  const {
    layoutDoc,
    hasRemoteLayout,
    loading: layoutLoading,
    ensureLayout: ensureLayoutV2,
    updateLayout: updateLayoutV2,
  } = useCallSheetLayoutV2(clientId, projectId, scheduleId);

  const [layoutV2Local, setLayoutV2Local] = useState(null);

  useEffect(() => {
    setLayoutV2Local(null);
  }, [scheduleId]);

  useEffect(() => {
    setLayoutV2Local(layoutDoc?.layout || null);
  }, [layoutDoc?.layout]);

  const ensureLayoutV2FromConfig = useCallback(
    (nextConfig) => {
      if (!schedule || !nextConfig) return;
      if (!canWriteProject) return;
      const layout = buildCallSheetLayoutV2({ schedule, legacyCallSheetConfig: nextConfig });

      if (!hasRemoteLayout && !layoutInitAttemptedRef.current) {
        layoutInitAttemptedRef.current = true;
        ensureLayoutV2.mutate({ layout });
      }
    },
    [canWriteProject, ensureLayoutV2, hasRemoteLayout, schedule, updateLayoutV2]
  );

  useEffect(() => {
    if (!callSheetConfig || !schedule) return;
    // Wait for layout loading to complete before deciding to create new layout
    // This prevents race condition where layout is created before remote data loads
    if (layoutLoading) return;
    if (hasRemoteLayout) return;
    if (layoutInitAttemptedRef.current) return;
    ensureLayoutV2FromConfig(callSheetConfig);
  }, [callSheetConfig, hasRemoteLayout, layoutLoading, schedule, ensureLayoutV2FromConfig]);

  const applyCallSheetConfigUpdate = useCallback(
    (updates) => {
      setCallSheetConfig((prev) => {
        if (!prev) return prev;
        const next = { ...prev, ...updates };
        if (updates?.sections) next.sections = updates.sections;
        return next;
      });
      if (canWriteProject) {
        updateConfig.mutate(updates);
      }
    },
    [canWriteProject, updateConfig]
  );

  const sections = useMemo(() => {
    return Array.isArray(callSheetConfig?.sections) ? callSheetConfig.sections : [];
  }, [callSheetConfig?.sections]);

  const orderedSections = useMemo(() => {
    return [...sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [sections]);

  useEffect(() => {
    if (orderedSections.length === 0) return;
    if (activeSectionId && orderedSections.some((s) => s.id === activeSectionId)) return;
    const preferred = orderedSections.find((s) => s.type === "schedule")?.id || orderedSections[0].id;
    setActiveSectionId(preferred);
  }, [activeSectionId, orderedSections]);

  const activeSection = useMemo(() => {
    return orderedSections.find((s) => s.id === activeSectionId) || null;
  }, [activeSectionId, orderedSections]);

  const scheduleSectionForFields = useMemo(() => {
    return orderedSections.find((s) => s.type === "schedule") || null;
  }, [orderedSections]);

  const scheduleSectionTitle = useMemo(() => {
    const raw = scheduleSectionForFields?.config?.title;
    const title = raw != null ? String(raw) : "";
    return title.trim() ? title : "Today's Schedule";
  }, [scheduleSectionForFields?.config?.title]);

  // NOTE: handleUpdateSectionConfig must be defined BEFORE handleScheduleSectionTitleChange
  // to avoid Temporal Dead Zone error
  const handleUpdateSectionConfig = useCallback(
    (sectionId, updates) => {
      const nextSections = orderedSections.map((section) => {
        if (section.id !== sectionId) return section;
        return { ...section, config: { ...(section.config || {}), ...(updates || {}) } };
      });
      applyCallSheetConfigUpdate({ sections: nextSections });
    },
    [applyCallSheetConfigUpdate, orderedSections]
  );

  const handleScheduleSectionTitleChange = useCallback(
    (nextTitle) => {
      if (!scheduleSectionForFields) return;
      handleUpdateSectionConfig(scheduleSectionForFields.id, { title: String(nextTitle || "") });
    },
    [handleUpdateSectionConfig, scheduleSectionForFields]
  );

  const scheduledTalentIds = useMemo(() => {
    const ids = new Set();
    (resolvedEntries || []).forEach((entry) => {
      if (!entry || entry.type !== "shot" || !entry.shotRef) return;
      const shot = shotsMap.get(entry.shotRef);
      if (!shot) return;
      const list = Array.isArray(shot.talent) ? shot.talent : [];
      list.forEach((talentItem) => {
        if (!talentItem) return;
        if (typeof talentItem === "string") {
          ids.add(talentItem);
          return;
        }
        if (typeof talentItem === "object") {
          if (talentItem.talentId) ids.add(talentItem.talentId);
        }
      });
    });
    return Array.from(ids);
  }, [resolvedEntries, shotsMap]);

  const { dayDetails } = useDayDetails(clientId, projectId, scheduleId);
  const { calls: talentCalls = [] } = useTalentCalls(clientId, projectId, scheduleId);
  const { calls: clientCalls = [] } = useClientCalls(clientId, projectId, scheduleId);
  const { callsByCrewMemberId } = useCrewCalls(clientId, projectId, scheduleId);
  const { crewById } = useOrganizationCrew(clientId);
  const { assignments: crewAssignments = [] } = useProjectCrew(clientId, projectId);
  const { departments: orgDepartments = [] } = useDepartments(clientId);
  const { departments: projectDepartments = [] } = useProjectDepartments(clientId, projectId);

  const talentRows = useMemo(() => {
    return (talentCalls || [])
      .map((call) => {
        const talent = talentMap.get(call.talentId) || null;
        const name = talent?.name ? String(talent.name) : `Missing (${call.talentId})`;
        const idLabel = talent?.talentId ? String(talent.talentId) : "";
        return {
          talentId: call.talentId,
          idLabel,
          name,
          role: call.role || "",
          status: call.status || "",
          transportation: call.transportation || "",
          callTime: call.callTime || "",
          callText: call.callText || "",
          blockRhs: call.blockRhs || "",
          muWard: call.muWard || "",
          setTime: call.setTime || "",
          remarks: call.notes || "",
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [talentCalls, talentMap]);

  const crewRows = useMemo(() => {
    const departmentNameByKey = new Map();
    orgDepartments.forEach((d) => departmentNameByKey.set(`org:${d.id}`, d.name));
    projectDepartments.forEach((d) => departmentNameByKey.set(`project:${d.id}`, d.name));

    // Build position lookup from departments
    const positionById = new Map();
    orgDepartments.forEach((dept) => {
      (dept.positions || []).forEach((pos) => {
        positionById.set(pos.id, pos.title);
      });
    });
    projectDepartments.forEach((dept) => {
      (dept.positions || []).forEach((pos) => {
        positionById.set(pos.id, pos.title);
      });
    });

    return (crewAssignments || [])
      .map((assignment) => {
        const member = crewById.get(assignment.crewMemberId) || null;
        const name = member
          ? `${member.firstName || ""} ${member.lastName || ""}`.trim() || "Unnamed"
          : `Missing (${assignment.crewMemberId})`;

        const resolvedScope = assignment.departmentScope || (assignment.departmentId ? "org" : null);
        const resolvedId = assignment.departmentId || member?.departmentId || null;
        const deptKey = resolvedScope && resolvedId ? `${resolvedScope}:${resolvedId}` : "__unassigned__";
        const department =
          deptKey === "__unassigned__"
            ? "Unassigned"
            : departmentNameByKey.get(deptKey) || "Unknown department";

        // Resolve position (role) - check assignment first, then fall back to member's positionId
        const posId = assignment.positionId || member?.positionId || null;
        const role = posId && positionById.has(posId) ? positionById.get(posId) : "";

        const call = callsByCrewMemberId?.get(assignment.crewMemberId) || null;
        const defaultCall = dayDetails?.crewCallTime ? String(dayDetails.crewCallTime).trim() : "";
        const callTime = call?.callTime ? String(call.callTime).trim() : "";
        const callText = call?.callText ? String(call.callText).trim() : "";
        const notes = call?.notes ? String(call.notes) : "";

        return {
          crewMemberId: assignment.crewMemberId,
          department,
          role,
          name,
          callTime,
          callText,
          defaultCall,
          notes,
          phone: member?.phone || null,
          email: member?.email || null,
        };
      })
      .sort((a, b) => {
        const dept = a.department.localeCompare(b.department);
        if (dept !== 0) return dept;
        return a.name.localeCompare(b.name);
      });
  }, [callsByCrewMemberId, crewAssignments, crewById, dayDetails?.crewCallTime, orgDepartments, projectDepartments]);

  const clientRows = useMemo(() => {
    return (clientCalls || [])
      .map((call, idx) => {
        return {
          id: call.id,
          idLabel: String(idx + 1),
          name: call.name || "Unnamed",
          role: call.role || "",
          status: call.status || "",
          transportation: call.transportation || "",
          callTime: call.callTime || "",
          callText: call.callText || "",
          blockRhs: call.blockRhs || "",
          muWard: call.muWard || "",
          setTime: call.setTime || "",
          remarks: call.notes || "",
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [clientCalls]);

  const handleReorderSections = useCallback(
    (nextSections) => {
      applyCallSheetConfigUpdate({ sections: nextSections });
    },
    [applyCallSheetConfigUpdate]
  );

  const handleToggleSection = useCallback(
    (sectionId, nextVisible) => {
      const nextSections = orderedSections
        .map((section, idx) => {
          if (section.id !== sectionId) return { ...section, order: idx };
          return { ...section, isVisible: nextVisible, order: idx };
        })
        .map((section, idx) => ({ ...section, order: idx }));
      applyCallSheetConfigUpdate({ sections: nextSections });
    },
    [applyCallSheetConfigUpdate, orderedSections]
  );

  const handleAddSection = useCallback(
    (type, config = {}, afterId = null) => {
      const suffix = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
      const id = `section-${type}-${suffix}`;
      const nextSection = { id, type, isVisible: true, order: 0, config };
      const insertAfterIndex = afterId ? orderedSections.findIndex((s) => s.id === afterId) : -1;
      const insertAt = insertAfterIndex >= 0 ? insertAfterIndex + 1 : orderedSections.length;
      const nextSections = [
        ...orderedSections.slice(0, insertAt),
        nextSection,
        ...orderedSections.slice(insertAt),
      ].map((section, idx) => ({ ...section, order: idx }));
      applyCallSheetConfigUpdate({ sections: nextSections });
      setActiveSectionId(id);
      setPanelView({ mode: "section", section: type });
    },
    [applyCallSheetConfigUpdate, orderedSections]
  );

  const handleDeleteSection = useCallback(
    (sectionId) => {
      const nextSections = orderedSections
        .filter((section) => section.id !== sectionId)
        .map((section, idx) => ({ ...section, order: idx }));
      applyCallSheetConfigUpdate({ sections: nextSections });
      if (activeSectionId === sectionId) {
        setActiveSectionId(nextSections[0]?.id || null);
        setPanelView({ mode: "outline" });
      }
    },
    [activeSectionId, applyCallSheetConfigUpdate, orderedSections]
  );

  // Modal handlers
  const handleOpenEntryModal = useCallback((type, category = null) => {
    setEntryModalMode(type === "shot" ? "shot" : type === "custom" ? "custom" : "select");
    setEntryModalCategory(category);
    setEntryModalStartTime(null);
    setEditingEntry(null);
    setIsEntryModalOpen(true);
  }, []);

  const handleOpenEntryModalAtTime = useCallback((type, category = null, startTime = null) => {
    setEntryModalMode(type === "shot" ? "shot" : type === "custom" ? "custom" : "select");
    setEntryModalCategory(category);
    setEntryModalStartTime(startTime || null);
    setEditingEntry(null);
    setIsEntryModalOpen(true);
  }, []);

  const handleCloseEntryModal = useCallback(() => {
    setIsEntryModalOpen(false);
    setEntryModalMode("select");
    setEntryModalCategory(null);
    setEntryModalStartTime(null);
    setEditingEntry(null);
  }, []);

  const handleAddShot = useCallback(
    async (shotId, trackId, startTime = null) => {
      const duration = typeof settings.defaultEntryDuration === "number" ? settings.defaultEntryDuration : 15;
      if (startTime) {
        await addShot(shotId, trackId, startTime, duration);
      } else {
        await addShotAtEnd(shotId, trackId, resolvedEntries, duration);
      }
    },
    [addShot, addShotAtEnd, resolvedEntries, settings.defaultEntryDuration]
  );

  const handleAddCustomItem = useCallback(
    async (customData, trackId, duration, appliesToTrackIds, startTime = null) => {
      if (startTime) {
        await addCustomItem(customData, trackId, startTime, duration, appliesToTrackIds);
      } else {
        await addCustomItemAtEnd(customData, trackId, resolvedEntries, duration, appliesToTrackIds);
      }
    },
    [addCustomItem, addCustomItemAtEnd, resolvedEntries]
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

  const handleEditShotEntry = useCallback(
    (entry) => {
      const shotId = entry?.shotRef;
      if (!shotId) return;
      const shot = shotsMap?.get?.(shotId);
      if (!shot) {
        toast.error({ title: "Shot not found", description: "This schedule entry references a missing shot." });
        return;
      }
      setShotEditorShot({ ...shot, id: shotId });
      setIsShotEditorOpen(true);
    },
    [shotsMap]
  );

  const handleUpdateEntryFlag = useCallback(
    (entryId, flag) => {
      updateEntry({ entryId, updates: { flag: flag || null } });
    },
    [updateEntry]
  );

  const handleUpdateEntryMarker = useCallback(
    (entryId, marker) => {
      updateEntry({ entryId, updates: { marker: marker || null } });
    },
    [updateEntry]
  );

  const handleToggleShowDurations = useCallback(() => {
    if (!schedule?.settings) return;
    updateSettings({ showDurations: !(schedule.settings.showDurations ?? true) }, schedule.settings);
  }, [schedule?.settings, updateSettings]);

  const handleToggleCascade = useCallback(() => {
    if (!schedule?.settings) return;
    toggleCascade(schedule.settings);
  }, [schedule?.settings, toggleCascade]);

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
    async (trackId, startTime = null) => {
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
      if (startTime) {
        await addShot(created.id, effectiveTrackId, startTime, duration);
      } else {
        await addShotAtEnd(created.id, effectiveTrackId, resolvedEntries, duration);
      }
      setShotEditorShot({ ...baseShot, id: created.id });
      setIsShotEditorOpen(true);
    },
    [
      clientId,
      projectId,
      tracks,
      settings.defaultEntryDuration,
      createShotMutation,
      addShot,
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
      {!isPreviewOnly ? (
        <CallSheetToolbar
          schedule={schedule}
          onAddShot={canWriteProject ? handleOpenEntryModal : undefined}
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
      ) : null}

      {!isPreviewOnly && !canWriteProject ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Read-only: your project role is <span className="font-semibold">{projectRole || "unknown"}</span>. Ask an
          admin to set your role to <span className="font-semibold">producer</span> or{" "}
          <span className="font-semibold">wardrobe</span> to edit call sheets.
        </div>
      ) : null}

      {isPreviewOnly ? (
        <div className="flex-1 min-h-0">
          <PreviewPanel
            projectId={projectId}
            scheduleId={scheduleId}
            schedule={schedule}
            projectTitle={projectTitle}
            entries={resolvedEntries}
            tracks={tracks}
            columnConfig={effectiveColumns}
            onColumnResize={undefined}
            dayDetails={dayDetails}
            crewRows={crewRows}
            talentRows={talentRows}
            clientRows={clientRows}
            sections={orderedSections}
            callSheetConfig={callSheetConfig}
            layoutV2={layoutV2Local}
            onUpdateCallSheetConfig={applyCallSheetConfigUpdate}
          />
        </div>
      ) : (
        <div className="flex flex-1 min-h-0 gap-4">
          {/* Left Panel: Animated width outline/editor */}
          <WorkingPanel
            panelView={panelView}
            setPanelView={setPanelView}
            sections={orderedSections}
            orderedSections={orderedSections}
            activeSectionId={activeSectionId}
            activeSection={activeSection}
            canWrite={canWriteProject}
            onSelectSection={setActiveSectionId}
            onReorderSections={handleReorderSections}
            onToggleSection={handleToggleSection}
            onAddSection={handleAddSection}
            onDeleteSection={handleDeleteSection}
            onEditFields={canWriteProject ? () => setIsColumnConfigOpen(true) : undefined}
            onDone={() => setPanelView({ mode: "outline" })}
            readOnly={!canWriteProject}
            editorProps={{
              clientId,
              projectId,
              scheduleId,
              schedule,
              scheduleSettings: settings,
              scheduledTalentIds,
              trackFocusId,
              onTrackFocusChange: setTrackFocusId,
              scheduleViewMode,
              onScheduleViewModeChange: setScheduleViewMode,
              resolvedEntries,
              onToggleShowDurations: canWriteProject ? handleToggleShowDurations : undefined,
              onToggleCascade: canWriteProject ? handleToggleCascade : undefined,
              onOpenScheduleFields: canWriteProject ? () => setIsColumnConfigOpen(true) : undefined,
              onAddScene: canWriteProject ? () => handleOpenEntryModal("shot") : undefined,
              onAddBanner: canWriteProject ? () => handleOpenEntryModal("custom", "other") : undefined,
              onAddMove: canWriteProject ? () => handleOpenEntryModal("custom", "travel") : undefined,
              onLookupSceneAtTime: canWriteProject
                ? (startTime) => handleOpenEntryModalAtTime("shot", null, startTime)
                : undefined,
              onCreateSceneAtTime: canWriteProject
                ? (startTime) => handleCreateShotInSchedule(null, startTime)
                : undefined,
              onAddCustomAtTime: canWriteProject
                ? (category, startTime) => handleOpenEntryModalAtTime("custom", category, startTime)
                : undefined,
              dayDetails,
              callSheetConfig,
              onUpdateCallSheetConfig: applyCallSheetConfigUpdate,
              layoutV2: layoutV2Local,
              onUpdateLayoutV2: (nextLayout) => {
                setLayoutV2Local(nextLayout);
                updateLayoutV2.mutate({ layout: nextLayout });
              },
              generalCrewCallTime: dayDetails?.crewCallTime || "",
              onUpdateSectionConfig: handleUpdateSectionConfig,
              onEditEntry: canWriteProject ? handleEditCustomEntry : undefined,
              onEditShotEntry: canWriteProject ? handleEditShotEntry : undefined,
              scheduleEditor: (
                <VerticalTimelineView
                  schedule={schedule}
                  entries={resolvedEntries}
                  tracks={tracks}
                  locations={locationsArray}
                  settings={settings}
                  showPreviewPanel={false}
                  showEditorHeader={false}
                  columnConfig={effectiveColumns}
                  trackFocusId={trackFocusId}
                  onMoveEntry={
                    canWriteProject ? (entryId, newTime) => moveEntry(entryId, newTime, resolvedEntries) : undefined
                  }
                  onResizeEntry={
                    canWriteProject
                      ? (entryId, newDuration) => resizeEntry(entryId, newDuration, resolvedEntries)
                      : undefined
                  }
                  onUpdateEntryNotes={canWriteProject ? handleUpdateEntryNotes : undefined}
                  onUpdateEntryLocation={canWriteProject ? handleUpdateEntryLocation : undefined}
                  onUpdateEntryFlag={canWriteProject ? handleUpdateEntryFlag : undefined}
                  onUpdateEntryMarker={canWriteProject ? handleUpdateEntryMarker : undefined}
                  onDeleteEntry={canWriteProject ? handleDeleteEntry : undefined}
                  onReorderEntries={canWriteProject ? handleReorderEntries : undefined}
                  onMoveEntryToTrack={canWriteProject ? handleMoveEntryToTrack : undefined}
                  onAddShot={canWriteProject ? handleOpenEntryModal : undefined}
                  onAddCustomItem={canWriteProject ? (category) => handleOpenEntryModal("custom", category) : undefined}
                  onOpenColumnConfig={canWriteProject ? () => setIsColumnConfigOpen(true) : undefined}
                  onEditEntry={canWriteProject ? handleEditCustomEntry : undefined}
                  onEditShotEntry={canWriteProject ? handleEditShotEntry : undefined}
                />
              ),
            }}
          />

          {/* Right Panel: Preview (fills remaining space, lower z-index) */}
          <div className="flex-1 min-w-[500px] relative z-10">
            <PreviewPanel
              projectId={projectId}
              scheduleId={scheduleId}
              schedule={schedule}
              projectTitle={projectTitle}
              entries={resolvedEntries}
              tracks={tracks}
              columnConfig={effectiveColumns}
              onColumnResize={canWriteProject ? handleColumnResize : undefined}
              dayDetails={dayDetails}
              crewRows={crewRows}
              talentRows={talentRows}
              clientRows={clientRows}
              sections={orderedSections}
              callSheetConfig={callSheetConfig}
              layoutV2={layoutV2Local}
              onUpdateCallSheetConfig={applyCallSheetConfigUpdate}
            />
          </div>
        </div>
      )}

      {/* Entry Form Modal */}
      {!isPreviewOnly ? (
        <EntryFormModal
          isOpen={isEntryModalOpen}
          onClose={handleCloseEntryModal}
          mode={entryModalMode}
          initialCategory={entryModalCategory}
          defaultStartTime={entryModalStartTime}
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
      ) : null}

      {!isPreviewOnly ? (
        <>
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

          <ColumnConfigModal
            isOpen={isColumnConfigOpen}
            onClose={() => setIsColumnConfigOpen(false)}
            columns={columnConfig.length > 0 ? columnConfig : DEFAULT_COLUMNS}
            sectionTitle={scheduleSectionTitle}
            onSectionTitleChange={handleScheduleSectionTitleChange}
            onSave={updateColumns}
          />

          <TrackManager
            isOpen={isTrackManagerOpen}
            onClose={() => setIsTrackManagerOpen(false)}
            tracks={tracks}
            onSave={updateTracks}
            entriesByTrack={entriesByTrack}
          />

          <CallSheetExportModal
            isOpen={isExportModalOpen}
            onClose={() => setIsExportModalOpen(false)}
            schedule={schedule}
            entries={resolvedEntries}
            tracks={tracks}
          />
        </>
      ) : null}
    </div>
  );
}

export default CallSheetBuilder;
