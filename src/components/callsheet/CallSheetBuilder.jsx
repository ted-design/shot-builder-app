// src/components/callsheet/CallSheetBuilder.jsx
// Main container for the Call Sheet Builder (vertical editor + preview)

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
import {
  deriveOrderFromEntries,
  buildCascadeReorderUpdates,
  getTrackAnchorMinutes,
} from "../../lib/orderBasedSchedule";
import { DEFAULT_TRACKS, DEFAULT_SCHEDULE_SETTINGS, DEFAULT_COLUMNS } from "../../types/schedule";
import CallSheetToolbar from "./CallSheetToolbar";
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
import ColumnConfigModal from "./columns/ColumnConfigModal";
import TrackManager from "./tracks/TrackManager";
import CallSheetExportModal from "./export/CallSheetExportModal";
import CallSheetPrintPortal from "./print/CallSheetPrintPortal";
import { toast } from "../../lib/toast";
import { Loader2, Calendar, Clock } from "lucide-react";
import { Modal } from "../ui/modal";
import { Card, CardHeader, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
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

/**
 * Derives the effective day start time from Crew Call (primary) or settings (fallback).
 * Crew Call from Day Details is the single source of truth for when the day starts.
 * @param {object|null} dayDetails - Day details containing crewCallTime
 * @param {object|null} settings - Schedule settings containing dayStartTime
 * @returns {string} Effective day start time in HH:MM format
 */
function getEffectiveDayStartTime(dayDetails, settings) {
  return dayDetails?.crewCallTime || settings?.dayStartTime || "06:00";
}

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

  // Delta J.3: Navigation to V3 editor
  const navigate = useNavigate();

  // Modal state
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [entryModalMode, setEntryModalMode] = useState("select"); // 'shot' | 'custom' | 'select'
  const [entryModalTrackId, setEntryModalTrackId] = useState(null);
  const [entryModalCategory, setEntryModalCategory] = useState(null);
  const [entryModalStartTime, setEntryModalStartTime] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [isColumnConfigOpen, setIsColumnConfigOpen] = useState(false);
  const [isTrackManagerOpen, setIsTrackManagerOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isPrintPortalOpen, setIsPrintPortalOpen] = useState(false);
  const [isEntryDeleteConfirmOpen, setIsEntryDeleteConfirmOpen] = useState(false);
  const [entryPendingDelete, setEntryPendingDelete] = useState(null);

  // Workspace fullscreen mode - keeps both editor and preview visible in an overlay
  const [isWorkspaceFullscreen, setIsWorkspaceFullscreen] = useState(false);

  // ESC key handler for exiting workspace fullscreen
  useEffect(() => {
    if (!isWorkspaceFullscreen) return;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsWorkspaceFullscreen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isWorkspaceFullscreen]);

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

  const { updateSettings, toggleCascade } = useUpdateScheduleSettings(clientId, projectId, scheduleId, {
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
    loading: callSheetConfigLoading,
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

  const { dayDetails, loading: dayDetailsLoading } = useDayDetails(clientId, projectId, scheduleId);
  const { calls: talentCalls = [], loading: talentCallsLoading } = useTalentCalls(clientId, projectId, scheduleId);
  const { calls: clientCalls = [], loading: clientCallsLoading } = useClientCalls(clientId, projectId, scheduleId);
  const { callsByCrewMemberId, loading: crewCallsLoading } = useCrewCalls(clientId, projectId, scheduleId);
  const { crewById, loading: orgCrewLoading } = useOrganizationCrew(clientId);
  const { assignments: crewAssignments = [], loading: projectCrewLoading } = useProjectCrew(clientId, projectId);
  const { departments: orgDepartments = [], loading: orgDepartmentsLoading } = useDepartments(clientId);
  const { departments: projectDepartments = [], loading: projectDepartmentsLoading } = useProjectDepartments(clientId, projectId);

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
        const callOffsetDirection = call?.callOffsetDirection || null;
        const callOffsetMinutes = call?.callOffsetMinutes || null;
        const notes = call?.notes ? String(call.notes) : "";

        return {
          crewMemberId: assignment.crewMemberId,
          department,
          role,
          name,
          callTime,
          callText,
          callOffsetDirection,
          callOffsetMinutes,
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

  const crewSectionLoading =
    Boolean(crewCallsLoading) ||
    Boolean(orgCrewLoading) ||
    Boolean(projectCrewLoading) ||
    Boolean(orgDepartmentsLoading) ||
    Boolean(projectDepartmentsLoading) ||
    Boolean(dayDetailsLoading);

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
  const handleOpenEntryModal = useCallback((type, category = null, trackId = null) => {
    setEntryModalMode(type === "shot" ? "shot" : type === "custom" ? "custom" : "select");
    setEntryModalCategory(category);
    setEntryModalTrackId(trackId);
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
    setEntryModalTrackId(null);
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

  const handleUpdateEntryGeneric = useCallback(
    (entryId, updates) => {
      // If updating only duration, use resizeEntry for proper cascade handling
      if ("duration" in updates && Object.keys(updates).length === 1) {
        resizeEntry(entryId, updates.duration, resolvedEntries);
      } else {
        updateEntry({ entryId, updates });
      }
    },
    [updateEntry, resizeEntry, resolvedEntries]
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

  // Quick banner creation - creates a banner with default values directly (no modal)
  const handleAddQuickBanner = useCallback(async () => {
    // Default banner: "New Banner" at effective day start (derived from Crew Call)
    const defaultStartTime = getEffectiveDayStartTime(dayDetails, settings);
    const customData = {
      title: "New Banner",
      category: "other",
    };
    // trackId="all" creates a banner that spans all tracks
    await addCustomItem(customData, "all", defaultStartTime, 60, null);
    toast.success({ title: "Banner added" });
  }, [addCustomItem, dayDetails, settings]);

  const handleEditCustomEntry = useCallback((entry) => {
    if (!entry || entry.type !== "custom") return;
    setEditingEntry(entry);
    setEntryModalMode("custom");
    setEntryModalCategory(entry.customData?.category || null);
    setIsEntryModalOpen(true);
  }, []);

  const handleUpdateCustomItem = useCallback(
    async (entryId, { customData, trackId, duration, appliesToTrackIds, startTime }) => {
      if (!entryId) return;
      const updates = {
        customData,
        trackId,
        duration,
        appliesToTrackIds: appliesToTrackIds ?? null,
        notes: customData?.notes ? String(customData.notes) : null,
      };
      // Include startTime if provided (can be empty string to clear)
      if (startTime !== undefined) {
        updates.startTime = startTime || "";
      }
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

  // Delta J.3: Navigate to Shot Editor V3 instead of opening inline modal
  const handleEditShotEntry = useCallback(
    (entry) => {
      const shotId = entry?.shotRef;
      if (!shotId) return;
      const shot = shotsMap?.get?.(shotId);
      if (!shot) {
        toast.error({ title: "Shot not found", description: "This schedule entry references a missing shot." });
        return;
      }
      // Navigate to V3 editor with return context
      navigate(`/projects/${projectId}/shots/${shotId}?returnTo=schedule`);
    },
    [shotsMap, navigate, projectId]
  );

  // Combined handler that routes to shot editor for shots, custom entry modal for banners
  const handleEditEntry = useCallback(
    (entry) => {
      if (!entry) return;
      // Shot entries have shotRef
      if (entry.shotRef) {
        handleEditShotEntry(entry);
      } else if (entry.type === "custom") {
        handleEditCustomEntry(entry);
      }
    },
    [handleEditShotEntry, handleEditCustomEntry]
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

  const handleToggleCascade = useCallback(() => {
    if (!schedule?.settings) return;
    toggleCascade(schedule.settings);
  }, [schedule?.settings, toggleCascade]);

  const handleDeleteEntry = useCallback(
    (entryId) => {
      const entry = resolvedEntries.find((item) => item.id === entryId) || null;
      if (!entry) return;

      const label =
        entry.type === "shot"
          ? shotsMap.get(entry.shotRef)?.name || "Shot entry"
          : entry.title || "Custom entry";

      setEntryPendingDelete({ entryId, label });
      setIsEntryDeleteConfirmOpen(true);
    },
    [resolvedEntries, shotsMap]
  );

  const handleCancelDeleteEntry = useCallback(() => {
    setIsEntryDeleteConfirmOpen(false);
    setEntryPendingDelete(null);
  }, []);

  const handleConfirmDeleteEntry = useCallback(() => {
    if (!entryPendingDelete?.entryId) return;
    deleteEntry({ entryId: entryPendingDelete.entryId });
    setIsEntryDeleteConfirmOpen(false);
    setEntryPendingDelete(null);
  }, [deleteEntry, entryPendingDelete?.entryId]);

  const handleReorderEntries = useCallback(
    (entryId, oldIndex, newIndex) => {
      if (oldIndex === newIndex) return;

      // Find the moved entry to get its trackId
      const movedEntry = resolvedEntries.find((entry) => entry.id === entryId);
      if (!movedEntry) return;

      const trackId = movedEntry.trackId;

      // Get track-local entries sorted by order (matching SyncIntervalGridView's sorting)
      // This ensures indices from SyncIntervalGridView match our sorting here
      const trackEntries = resolvedEntries
        .filter((entry) => entry.trackId === trackId)
        .sort((a, b) => {
          const aOrder = a.order ?? Number.MAX_SAFE_INTEGER;
          const bOrder = b.order ?? Number.MAX_SAFE_INTEGER;
          if (aOrder !== bOrder) return aOrder - bOrder;
          // Fallback: startTime
          const aTime = parseTimeToMinutes(a.startTime || "00:00");
          const bTime = parseTimeToMinutes(b.startTime || "00:00");
          return aTime - bTime;
        });

      const clampedOldIndex = Math.max(0, Math.min(trackEntries.length - 1, oldIndex));
      const clampedNewIndex = Math.max(0, Math.min(trackEntries.length - 1, newIndex));
      if (clampedOldIndex === clampedNewIndex) return;

      const cascadeChanges = schedule?.settings?.cascadeChanges ?? true;

      // When cascade is OFF, only update the moved entry's time/order to the target position
      if (!cascadeChanges) {
        const targetEntry = trackEntries[clampedNewIndex];
        if (!targetEntry) return;

        // If times differ, update the moved entry's start time
        if (targetEntry.startTime !== movedEntry.startTime) {
          batchUpdateEntries({ updates: [{ entryId, startTime: targetEntry.startTime }] });
          return;
        }

        // Same start time: swap order values to reorder within the time slot
        const movedOrder = movedEntry.order ?? 0;
        const targetOrder = targetEntry.order ?? 0;
        if (movedOrder !== targetOrder) {
          batchUpdateEntries({
            updates: [
              { entryId, order: targetOrder },
              { entryId: targetEntry.id, order: movedOrder },
            ],
          });
        }
        return;
      }

      // Cascade ON: reorder within track using the provided track-local indices
      // Build new ordered ID list by splicing within the track entries
      const reorderedTrack = [...trackEntries];
      const [removed] = reorderedTrack.splice(clampedOldIndex, 1);
      reorderedTrack.splice(clampedNewIndex, 0, removed);

      const newOrderedTrackIds = reorderedTrack.map((entry) => entry.id);

      const anchorStartMinutes = getTrackAnchorMinutes(trackEntries);

      // Use order-based updates: updates both order and derived startTime
      const updates = buildCascadeReorderUpdates(resolvedEntries, trackId, newOrderedTrackIds, {
        anchorStartMinutes,
      });

      if (updates.length > 0) batchUpdateEntries({ updates });
    },
    [resolvedEntries, batchUpdateEntries, schedule?.settings?.cascadeChanges]
  );

  const handleMoveEntryToTrack = useCallback(
    (entryId, newTrackId, insertIndex) => {
      const entry = resolvedEntries.find((candidate) => candidate.id === entryId);
      if (!entry || !newTrackId || entry.trackId === newTrackId) return;

      const sourceTrackId = entry.trackId;

      // Get source track entries sorted by order (excluding the moved entry)
      const sourceEntriesBefore = resolvedEntries
        .filter((candidate) => candidate.trackId === sourceTrackId && candidate.id !== entryId)
        .sort((a, b) => {
          const aOrder = a.order ?? Number.MAX_SAFE_INTEGER;
          const bOrder = b.order ?? Number.MAX_SAFE_INTEGER;
          if (aOrder !== bOrder) return aOrder - bOrder;
          const aTime = parseTimeToMinutes(a.startTime || "00:00");
          const bTime = parseTimeToMinutes(b.startTime || "00:00");
          return aTime - bTime;
        });

      // Get destination track entries sorted by order (excluding the moved entry in case of re-call)
      const destEntriesBefore = resolvedEntries
        .filter((candidate) => candidate.trackId === newTrackId && candidate.id !== entryId)
        .sort((a, b) => {
          const aOrder = a.order ?? Number.MAX_SAFE_INTEGER;
          const bOrder = b.order ?? Number.MAX_SAFE_INTEGER;
          if (aOrder !== bOrder) return aOrder - bOrder;
          const aTime = parseTimeToMinutes(a.startTime || "00:00");
          const bTime = parseTimeToMinutes(b.startTime || "00:00");
          return aTime - bTime;
        });

      // Build source ordered IDs (entry removed)
      const sourceOrderIds = sourceEntriesBefore.map((candidate) => candidate.id);

      // Build destination ordered IDs with the moved entry inserted at the specified position
      const destOrderIds = destEntriesBefore.map((candidate) => candidate.id);
      const clampedInsertIndex =
        typeof insertIndex === "number"
          ? Math.max(0, Math.min(destOrderIds.length, insertIndex))
          : destOrderIds.length; // Default: append to end
      destOrderIds.splice(clampedInsertIndex, 0, entryId);

      // Create updated entries array with trackId changed
      const nextEntries = resolvedEntries.map((candidate) =>
        candidate.id === entryId ? { ...candidate, trackId: newTrackId } : candidate
      );

      // Compute anchors
      const sourceAnchor = getTrackAnchorStartMinutes(
        resolvedEntries.filter((candidate) => candidate.trackId === sourceTrackId)
      );
      const destAnchor = getTrackAnchorStartMinutes(destEntriesBefore) ?? parseTimeToMinutes(entry.startTime);

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

  // One-time order migration per schedule: derive order values for entries without valid orders.
  // This runs before normalization to ensure canonical order is established first.
  const orderMigratedScheduleRef = useRef(null);
  useEffect(() => {
    if (!scheduleId) return;
    if (entriesLoading) return;
    if (orderMigratedScheduleRef.current === scheduleId) return;
    if (!Array.isArray(resolvedEntries) || resolvedEntries.length === 0) return;

    const orderUpdates = deriveOrderFromEntries(resolvedEntries);
    if (orderUpdates.length > 0) {
      console.info("[CallSheetBuilder] Migrating order values for", orderUpdates.length, "entries");
      batchUpdateEntries({ updates: orderUpdates });
    }

    orderMigratedScheduleRef.current = scheduleId;
  }, [scheduleId, entriesLoading, resolvedEntries, batchUpdateEntries]);

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

  const handleRequestPrint = useCallback(() => {
    setIsPrintPortalOpen(true);
  }, []);

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
    <div
      className={[
        "flex h-full flex-col gap-4",
        isWorkspaceFullscreen
          ? "fixed inset-0 z-50 bg-slate-100 dark:bg-slate-900 p-4 overflow-hidden"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Toolbar */}
      {!isPreviewOnly ? (
        <CallSheetToolbar
          schedule={schedule}
          onAddShot={canWriteProject ? handleOpenEntryModal : undefined}
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
            isWorkspaceFullscreen={isWorkspaceFullscreen}
            onToggleWorkspaceFullscreen={() => setIsWorkspaceFullscreen((prev) => !prev)}
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
              resolvedEntries,
              onToggleCascade: canWriteProject ? handleToggleCascade : undefined,
              onAddScene: canWriteProject ? (trackId) => handleOpenEntryModal("shot", null, trackId) : undefined,
              onAddBanner: canWriteProject ? () => handleOpenEntryModal("custom", "other") : undefined,
              onAddQuickBanner: canWriteProject ? handleAddQuickBanner : undefined,
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
              onEditEntry: canWriteProject ? handleEditEntry : undefined,
              onReorderEntries: canWriteProject ? handleReorderEntries : undefined,
              onMoveEntryToTrack: canWriteProject ? handleMoveEntryToTrack : undefined,
              onUpdateEntry: canWriteProject ? handleUpdateEntryGeneric : undefined,
              onDeleteEntry: canWriteProject ? handleDeleteEntry : undefined,
              tracks,
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
              isWorkspaceFullscreen={isWorkspaceFullscreen}
              onToggleWorkspaceFullscreen={() => setIsWorkspaceFullscreen((prev) => !prev)}
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
          initialTrackId={entryModalTrackId}
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
            onRequestPrint={handleRequestPrint}
            schedule={schedule}
            entries={resolvedEntries}
            tracks={tracks}
          />

          <CallSheetPrintPortal
            open={isPrintPortalOpen}
            onDone={() => setIsPrintPortalOpen(false)}
            schedule={schedule}
            scheduleLoading={scheduleLoading}
            entries={resolvedEntries}
            entriesLoading={entriesLoading}
            tracks={tracks}
            projectTitle={projectTitle}
            dayDetails={dayDetails}
            dayDetailsLoading={dayDetailsLoading}
            crewRows={crewRows}
            crewLoading={crewSectionLoading}
            talentRows={talentRows}
            talentLoading={talentCallsLoading}
            clientRows={clientRows}
            clientLoading={clientCallsLoading}
            sections={orderedSections}
            callSheetConfig={callSheetConfig}
            callSheetConfigLoading={callSheetConfigLoading}
            layoutV2={layoutV2Local}
            layoutV2Loading={layoutLoading}
            columnConfig={effectiveColumns}
          />

          <Modal
            open={isEntryDeleteConfirmOpen}
            onClose={handleCancelDeleteEntry}
            labelledBy="delete-entry-title"
            contentClassName="max-w-md"
          >
            <Card className="border-0 shadow-none">
              <CardHeader>
                <h2 id="delete-entry-title" className="text-lg font-semibold text-red-600 dark:text-red-400">
                  Delete entry
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  This action cannot be undone.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
                  <p className="text-sm text-red-800 dark:text-red-200">
                    You are about to delete <strong>{entryPendingDelete?.label || "this entry"}</strong>.
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" type="button" onClick={handleCancelDeleteEntry}>
                    Cancel
                  </Button>
                  <Button type="button" variant="destructive" onClick={handleConfirmDeleteEntry}>
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          </Modal>
        </>
      ) : null}
    </div>
  );
}

export default CallSheetBuilder;
