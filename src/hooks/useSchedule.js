// src/hooks/useSchedule.js
// React hook for schedule CRUD operations with real-time subscription

import { useState, useEffect, useMemo, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { schedulesPath, schedulePath } from "../lib/paths";
import { toast } from "../lib/toast";
import { describeFirebaseError } from "../lib/firebaseErrors";
import { useAuth } from "../context/AuthContext";
import { isDemoModeActive } from "../lib/flags";
import {
  DEFAULT_TRACKS,
  DEFAULT_COLUMNS,
  DEFAULT_SCHEDULE_SETTINGS,
  PRIMARY_TRACK,
} from "../types/schedule";

/**
 * Normalize tracks array ensuring backward compatibility.
 * - Empty/missing tracks default to [PRIMARY_TRACK]
 * - Existing tracks (e.g., photo/video/shared) are preserved
 * - Ensures scope field is set for all tracks
 */
function normalizeTracks(tracks) {
  if (!Array.isArray(tracks) || tracks.length === 0) {
    return DEFAULT_TRACKS;
  }
  return tracks.map((track) => {
    // Determine scope: explicit scope, or infer from id for legacy "shared" track
    const scope = track.scope || (track.id === "shared" ? "shared" : "lane");
    return { ...track, scope };
  });
}

/**
 * Query keys for schedule-related queries
 */
export const scheduleQueryKeys = {
  schedules: (clientId, projectId) => ["schedules", clientId, projectId],
  schedule: (clientId, projectId, scheduleId) => [
    "schedule",
    clientId,
    projectId,
    scheduleId,
  ],
  scheduleEntries: (clientId, projectId, scheduleId) => [
    "scheduleEntries",
    clientId,
    projectId,
    scheduleId,
  ],
};

/**
 * Hook for subscribing to schedules for a project.
 *
 * @param {string} clientId - Client ID
 * @param {string} projectId - Project ID
 * @returns {{ schedules: Array, loading: boolean, error: Error | null }}
 */
export function useSchedules(clientId, projectId) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!clientId || !projectId) {
      setSchedules([]);
      setLoading(false);
      return;
    }

    const schedulesRef = collection(db, ...schedulesPath(projectId, clientId));
    const q = query(schedulesRef, orderBy("date", "asc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setSchedules(list);
        setLoading(false);
      },
      (err) => {
        console.error("[useSchedules] Subscription error:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [clientId, projectId]);

  return { schedules, loading, error };
}

/**
 * Hook for subscribing to a single schedule document.
 *
 * @param {string} clientId - Client ID
 * @param {string} projectId - Project ID
 * @param {string} scheduleId - Schedule ID
 * @returns {{ schedule: object | null, loading: boolean, error: Error | null }}
 */
export function useSchedule(clientId, projectId, scheduleId) {
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!clientId || !projectId || !scheduleId) {
      setSchedule(null);
      setLoading(false);
      return;
    }

    const scheduleRef = doc(db, ...schedulePath(projectId, scheduleId, clientId));

    const unsub = onSnapshot(
      scheduleRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setSchedule({
            id: snap.id,
            ...data,
            tracks: normalizeTracks(data.tracks),
          });
        } else {
          setSchedule(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error("[useSchedule] Subscription error:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [clientId, projectId, scheduleId]);

  return { schedule, loading, error };
}

/**
 * Hook for creating a new schedule.
 *
 * @param {string} clientId - Client ID
 * @param {string} projectId - Project ID
 * @param {object} options - Mutation options
 * @returns {object} Mutation result
 */
export function useCreateSchedule(clientId, projectId, options = {}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (scheduleData) => {
      // Demo mode: return fake success
      if (isDemoModeActive()) {
        const fakeId = `demo-schedule-${Date.now()}`;
        console.info("[Demo Mode] Schedule creation blocked, returning fake ID:", fakeId);
        return { id: fakeId, ...scheduleData };
      }

      const schedulesRef = collection(db, ...schedulesPath(projectId, clientId));

      // Merge with defaults
      const fullData = {
        projectId,
        name: scheduleData.name || "Untitled Schedule",
        date: scheduleData.date || new Date(),
        tracks: normalizeTracks(scheduleData.tracks || DEFAULT_TRACKS),
        columnConfig: scheduleData.columnConfig || DEFAULT_COLUMNS,
        settings: {
          ...DEFAULT_SCHEDULE_SETTINGS,
          ...scheduleData.settings,
        },
        createdBy: user?.uid || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(schedulesRef, fullData);
      return { id: docRef.id, ...fullData };
    },
    onSuccess: (newSchedule, variables) => {
      queryClient.invalidateQueries({
        queryKey: scheduleQueryKeys.schedules(clientId, projectId),
      });

      if (options.onSuccess) {
        options.onSuccess(newSchedule, variables);
      }
    },
    onError: (error, variables, context) => {
      const { code, message } = describeFirebaseError(error, "Failed to create schedule");
      console.error("[useCreateSchedule] Error:", error);
      toast.error({ title: "Failed to create schedule", description: `${code}: ${message}` });

      if (options.onError) {
        options.onError(error, variables, context);
      }
    },
  });
}

/**
 * Hook for updating a schedule.
 *
 * @param {string} clientId - Client ID
 * @param {string} projectId - Project ID
 * @param {object} options - Mutation options
 * @returns {object} Mutation result
 */
export function useUpdateSchedule(clientId, projectId, options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ scheduleId, updates }) => {
      // Demo mode: return fake success
      if (isDemoModeActive()) {
        console.info("[Demo Mode] Schedule update blocked for:", scheduleId);
        return { scheduleId, updates };
      }

      const scheduleRef = doc(db, ...schedulePath(projectId, scheduleId, clientId));
      await updateDoc(scheduleRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      return { scheduleId, updates };
    },
    onMutate: async ({ scheduleId, updates }) => {
      await queryClient.cancelQueries({
        queryKey: scheduleQueryKeys.schedules(clientId, projectId),
      });

      const previousSchedules = queryClient.getQueryData(
        scheduleQueryKeys.schedules(clientId, projectId)
      );

      // Optimistically update
      queryClient.setQueryData(
        scheduleQueryKeys.schedules(clientId, projectId),
        (old) => {
          if (!old) return old;
          return old.map((schedule) =>
            schedule.id === scheduleId ? { ...schedule, ...updates } : schedule
          );
        }
      );

      return { previousSchedules };
    },
    onError: (error, variables, context) => {
      if (context?.previousSchedules) {
        queryClient.setQueryData(
          scheduleQueryKeys.schedules(clientId, projectId),
          context.previousSchedules
        );
      }

      const { code, message } = describeFirebaseError(error, "Failed to update schedule");
      console.error("[useUpdateSchedule] Error:", error);
      toast.error({ title: "Failed to update schedule", description: `${code}: ${message}` });

      if (options.onError) {
        options.onError(error, variables, context);
      }
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({
        queryKey: scheduleQueryKeys.schedules(clientId, projectId),
      });

      if (options.onSuccess) {
        options.onSuccess(data, variables, context);
      }
    },
  });
}

/**
 * Hook for deleting a schedule.
 *
 * @param {string} clientId - Client ID
 * @param {string} projectId - Project ID
 * @param {object} options - Mutation options
 * @returns {object} Mutation result
 */
export function useDeleteSchedule(clientId, projectId, options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ scheduleId }) => {
      // Demo mode: return fake success
      if (isDemoModeActive()) {
        console.info("[Demo Mode] Schedule deletion blocked for:", scheduleId);
        return { scheduleId };
      }

      const scheduleRef = doc(db, ...schedulePath(projectId, scheduleId, clientId));
      await deleteDoc(scheduleRef);
      return { scheduleId };
    },
    onMutate: async ({ scheduleId }) => {
      await queryClient.cancelQueries({
        queryKey: scheduleQueryKeys.schedules(clientId, projectId),
      });

      const previousSchedules = queryClient.getQueryData(
        scheduleQueryKeys.schedules(clientId, projectId)
      );

      // Optimistically remove
      queryClient.setQueryData(
        scheduleQueryKeys.schedules(clientId, projectId),
        (old) => {
          if (!old) return old;
          return old.filter((schedule) => schedule.id !== scheduleId);
        }
      );

      return { previousSchedules };
    },
    onError: (error, variables, context) => {
      if (context?.previousSchedules) {
        queryClient.setQueryData(
          scheduleQueryKeys.schedules(clientId, projectId),
          context.previousSchedules
        );
      }

      const { code, message } = describeFirebaseError(error, "Failed to delete schedule");
      console.error("[useDeleteSchedule] Error:", error);
      toast.error({ title: "Failed to delete schedule", description: `${code}: ${message}` });

      if (options.onError) {
        options.onError(error, variables, context);
      }
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({
        queryKey: scheduleQueryKeys.schedules(clientId, projectId),
      });

      if (options.onSuccess) {
        options.onSuccess(data, variables, context);
      }
    },
  });
}

/**
 * Hook for updating schedule tracks.
 *
 * @param {string} clientId - Client ID
 * @param {string} projectId - Project ID
 * @param {string} scheduleId - Schedule ID
 * @param {object} options - Mutation options
 * @returns {object} Mutation result
 */
export function useUpdateScheduleTracks(clientId, projectId, scheduleId, options = {}) {
  const updateSchedule = useUpdateSchedule(clientId, projectId, options);

  const updateTracks = useCallback(
    (tracks) => {
      return updateSchedule.mutate({
        scheduleId,
        updates: { tracks: normalizeTracks(tracks) },
      });
    },
    [updateSchedule, scheduleId]
  );

  const addTrack = useCallback(
    (track, currentTracks) => {
      const newTracks = normalizeTracks([...currentTracks, track]);
      return updateSchedule.mutate({ scheduleId, updates: { tracks: newTracks } });
    },
    [updateSchedule, scheduleId]
  );

  const removeTrack = useCallback(
    (trackId, currentTracks) => {
      const newTracks = normalizeTracks(currentTracks.filter((t) => t.id !== trackId));
      return updateSchedule.mutate({ scheduleId, updates: { tracks: newTracks } });
    },
    [updateSchedule, scheduleId]
  );

  const reorderTracks = useCallback(
    (trackIds, currentTracks) => {
      const trackMap = new Map(currentTracks.map((t) => [t.id, t]));
      const newTracks = trackIds
        .map((id, idx) => {
          const track = trackMap.get(id);
          return track ? { ...track, order: idx } : null;
        })
        .filter(Boolean);
      return updateSchedule.mutate({
        scheduleId,
        updates: { tracks: normalizeTracks(newTracks) },
      });
    },
    [updateSchedule, scheduleId]
  );

  return {
    updateTracks,
    addTrack,
    removeTrack,
    reorderTracks,
    ...updateSchedule,
  };
}

/**
 * Hook for updating schedule column configuration.
 *
 * @param {string} clientId - Client ID
 * @param {string} projectId - Project ID
 * @param {string} scheduleId - Schedule ID
 * @param {object} options - Mutation options
 * @returns {object} Mutation result
 */
export function useUpdateScheduleColumns(clientId, projectId, scheduleId, options = {}) {
  const updateSchedule = useUpdateSchedule(clientId, projectId, options);

  const updateColumns = useCallback(
    (columnConfig) => {
      return updateSchedule.mutate({ scheduleId, updates: { columnConfig } });
    },
    [updateSchedule, scheduleId]
  );

  const updateColumn = useCallback(
    (columnKey, updates, currentColumns) => {
      const newColumns = currentColumns.map((col) =>
        col.key === columnKey ? { ...col, ...updates } : col
      );
      return updateSchedule.mutate({ scheduleId, updates: { columnConfig: newColumns } });
    },
    [updateSchedule, scheduleId]
  );

  const reorderColumns = useCallback(
    (columnKeys, currentColumns) => {
      const colMap = new Map(currentColumns.map((c) => [c.key, c]));
      const newColumns = columnKeys
        .map((key, idx) => {
          const col = colMap.get(key);
          return col ? { ...col, order: idx } : null;
        })
        .filter(Boolean);
      return updateSchedule.mutate({ scheduleId, updates: { columnConfig: newColumns } });
    },
    [updateSchedule, scheduleId]
  );

  const resetColumnsToDefaults = useCallback(() => {
    return updateSchedule.mutate({
      scheduleId,
      updates: { columnConfig: DEFAULT_COLUMNS },
    });
  }, [updateSchedule, scheduleId]);

  return {
    updateColumns,
    updateColumn,
    reorderColumns,
    resetColumnsToDefaults,
    ...updateSchedule,
  };
}

/**
 * Hook for updating schedule settings.
 *
 * @param {string} clientId - Client ID
 * @param {string} projectId - Project ID
 * @param {string} scheduleId - Schedule ID
 * @param {object} options - Mutation options
 * @returns {object} Mutation result
 */
export function useUpdateScheduleSettings(clientId, projectId, scheduleId, options = {}) {
  const updateSchedule = useUpdateSchedule(clientId, projectId, options);

  const updateSettings = useCallback(
    (settings, currentSettings) => {
      const mergedSettings = { ...currentSettings, ...settings };
      return updateSchedule.mutate({
        scheduleId,
        updates: { settings: mergedSettings },
      });
    },
    [updateSchedule, scheduleId]
  );

  const toggleCascade = useCallback(
    (currentSettings) => {
      return updateSchedule.mutate({
        scheduleId,
        updates: {
          settings: {
            ...currentSettings,
            cascadeChanges: !currentSettings.cascadeChanges,
          },
        },
      });
    },
    [updateSchedule, scheduleId]
  );

  const setDayStartTime = useCallback(
    (dayStartTime, currentSettings) => {
      return updateSchedule.mutate({
        scheduleId,
        updates: {
          settings: {
            ...currentSettings,
            dayStartTime,
          },
        },
      });
    },
    [updateSchedule, scheduleId]
  );

  const setTimeIncrement = useCallback(
    (timeIncrement, currentSettings) => {
      return updateSchedule.mutate({
        scheduleId,
        updates: {
          settings: {
            ...currentSettings,
            timeIncrement,
          },
        },
      });
    },
    [updateSchedule, scheduleId]
  );

  return {
    updateSettings,
    toggleCascade,
    setDayStartTime,
    setTimeIncrement,
    ...updateSchedule,
  };
}

/**
 * Hook for duplicating a schedule.
 *
 * @param {string} clientId - Client ID
 * @param {string} projectId - Project ID
 * @param {object} options - Mutation options
 * @returns {object} Mutation result
 */
export function useDuplicateSchedule(clientId, projectId, options = {}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ sourceSchedule, newName, newDate }) => {
      // Demo mode: return fake success
      if (isDemoModeActive()) {
        const fakeId = `demo-schedule-${Date.now()}`;
        console.info("[Demo Mode] Schedule duplication blocked, returning fake ID:", fakeId);
        return { id: fakeId };
      }

      // Create new schedule document with copied data
      const schedulesRef = collection(db, ...schedulesPath(projectId, clientId));
      const newScheduleData = {
        projectId,
        name: newName || `${sourceSchedule.name} (Copy)`,
        date: newDate || sourceSchedule.date,
        tracks: sourceSchedule.tracks,
        columnConfig: sourceSchedule.columnConfig,
        settings: sourceSchedule.settings,
        createdBy: user?.uid || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(schedulesRef, newScheduleData);
      return { id: docRef.id, ...newScheduleData };
    },
    onSuccess: (newSchedule, variables) => {
      queryClient.invalidateQueries({
        queryKey: scheduleQueryKeys.schedules(clientId, projectId),
      });

      toast.success({ title: "Schedule duplicated" });

      if (options.onSuccess) {
        options.onSuccess(newSchedule, variables);
      }
    },
    onError: (error, variables, context) => {
      const { code, message } = describeFirebaseError(error, "Failed to duplicate schedule");
      console.error("[useDuplicateSchedule] Error:", error);
      toast.error({ title: "Failed to duplicate schedule", description: `${code}: ${message}` });

      if (options.onError) {
        options.onError(error, variables, context);
      }
    },
  });
}
