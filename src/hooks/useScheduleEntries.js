// src/hooks/useScheduleEntries.js
// React hook for schedule entry operations with shot data joins

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  writeBatch,
  getDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  scheduleEntriesPath,
  scheduleEntryPath,
  shotsPath,
} from "../lib/paths";
import { toast } from "../lib/toast";
import { describeFirebaseError } from "../lib/firebaseErrors";
import { useAuth } from "../context/AuthContext";
import { isDemoModeActive } from "../lib/flags";
import { scheduleQueryKeys } from "./useSchedule";
import { calculateEndTime, parseTimeToMinutes, minutesToTimeString } from "../lib/timeUtils";
import { getPrimaryAttachmentWithStyle, getShotImagePath, resolveShotCoverImage } from "../lib/imageHelpers";
import { stripHtml } from "../lib/stripHtml";
import {
  getNextAvailableTime,
  sortEntriesByTime,
} from "../lib/cascadeEngine";
import { buildOverlapMap, resolveOverlaps } from "../lib/overlapUtils";
import {
  buildGaplessDurationChangeUpdates,
  buildGaplessTimeChangeUpdates,
} from "../lib/gaplessSchedule";

/**
 * Hook for subscribing to schedule entries with real-time updates.
 *
 * @param {string} clientId - Client ID
 * @param {string} projectId - Project ID
 * @param {string} scheduleId - Schedule ID
 * @returns {{ entries: Array, loading: boolean, error: Error | null }}
 */
export function useScheduleEntries(clientId, projectId, scheduleId) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!clientId || !projectId || !scheduleId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    const entriesRef = collection(
      db,
      ...scheduleEntriesPath(projectId, scheduleId, clientId)
    );
    // Use single orderBy to avoid composite index requirement.
    // Firestore sorts lexicographically, so we re-sort in-memory using parsed minutes.
    const q = query(entriesRef, orderBy("startTime", "asc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        // Sort by actual time (minutes), then by order.
        const sorted = sortEntriesByTime(list);
        setEntries(sorted);
        setLoading(false);
      },
      (err) => {
        console.error("[useScheduleEntries] Subscription error:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [clientId, projectId, scheduleId]);

  return { entries, loading, error };
}

/**
 * Hook for resolved schedule entries with shot data joins.
 * Fetches shot data for entries with type='shot' and computes
 * resolved fields like title, talent, products, location.
 *
 * @param {string} clientId - Client ID
 * @param {string} projectId - Project ID
 * @param {string} scheduleId - Schedule ID
 * @param {Map} shotsMap - Map of shot ID to shot data (from parent component)
 * @param {Map} talentMap - Map of talent ID to talent data
 * @param {Map} productsMap - Map of product ID to product data
 * @param {Map} locationsMap - Map of location ID to location data
 * @returns {{ resolvedEntries: Array, loading: boolean, error: Error | null }}
 */
export function useResolvedScheduleEntries(
  clientId,
  projectId,
  scheduleId,
  shotsMap = new Map(),
  talentMap = new Map(),
  productsMap = new Map(),
  locationsMap = new Map()
) {
  const { entries, loading, error } = useScheduleEntries(clientId, projectId, scheduleId);

  const resolvedEntries = useMemo(() => {
    if (!entries || entries.length === 0) return [];

    const formatProductLabel = (product) => {
      if (!product) return null;
      const name =
        product.familyName ||
        product.productName ||
        product.name ||
        product.styleName ||
        product.styleNumber ||
        "Product";
      const colour =
        product.colourName ||
        product.colorName ||
        product.colourwayName ||
        product.colorwayName ||
        product.colour ||
        product.color;
      const size = product.size || product.sizeLabel || product.sizeName;
      const detailParts = [];
      if (colour) detailParts.push(colour);
      if (size) detailParts.push(size);
      if (detailParts.length === 0) return name;
      return `${name} (${detailParts.join(" • ")})`;
    };

    const prefersDetailedLabel = (nextLabel, currentLabel) => {
      if (!nextLabel) return false;
      if (!currentLabel) return true;
      const nextDetailed = nextLabel.includes("(");
      const currentDetailed = currentLabel.includes("(");
      return nextDetailed && !currentDetailed;
    };

    // First, resolve entry data
    const resolved = entries.map((entry) => {
      const endTime = calculateEndTime(entry.startTime, entry.duration);

      // Base resolved entry
      const baseResolved = {
        ...entry,
        endTime,
        shotNumber: "",
        resolvedTitle: "",
        resolvedDetails: "",
        resolvedTalent: [],
        resolvedProducts: [],
        resolvedLocation: "",
        resolvedImage: null,
        resolvedImagePosition: undefined,
        resolvedDescription: "",
        resolvedNotes: "",
        resolvedTags: [],
        hasOverlap: false,
        overlapsWith: [],
      };

      if (entry.type === "shot" && entry.shotRef) {
        // Resolve from shot data
        const shot = shotsMap.get(entry.shotRef);
        if (shot) {
          // Resolve talent names (support both {talentId,name} objects and legacy ID arrays)
          const talentNames = (shot.talent || [])
            .map((talentItem) => {
              if (!talentItem) return null;
              if (typeof talentItem === "string") {
                const talent = talentMap.get(talentItem);
                return talent?.name || talentItem;
              }
              if (typeof talentItem === "object") {
                return talentItem.name || talentMap.get(talentItem.talentId)?.name || talentItem.talentId || null;
              }
              return null;
            })
            .filter(Boolean);

          const productLabels = [];
          const shotProducts = Array.isArray(shot.products)
            ? shot.products
            : shot.products && typeof shot.products === "object"
            ? Object.values(shot.products)
            : [];
          const labelByProductId = new Map();
          const addProductLabel = (key, label) => {
            if (!label) return;
            const existing = labelByProductId.get(key);
            if (!existing || prefersDetailedLabel(label, existing)) {
              labelByProductId.set(key, label);
            }
          };

          shotProducts.forEach((product) => {
            const label = formatProductLabel(product);
            const key = product?.productId || product?.id || label;
            if (key) addProductLabel(String(key), label);
          });

          const productIds = Array.isArray(shot.productIds) ? shot.productIds : [];
          productIds.forEach((productId) => {
            if (labelByProductId.has(productId)) return;
            const product = productsMap.get(productId);
            const label = formatProductLabel(product);
            if (label) addProductLabel(productId, label);
          });

          const productNames = Array.from(labelByProductId.values());
          const canonicalDescription = stripHtml(String(shot.description ?? ""));
          const legacyDescription = stripHtml(String(shot.type ?? ""));
          const resolvedShotDescription = canonicalDescription || legacyDescription || "";

          // Details field: read from shot.description (canonical) with fallback to shot.type (legacy).
          // Use stripped text so placeholder HTML/whitespace doesn't block the fallback.
          const resolvedDetails = resolvedShotDescription;

          // Resolve location (entry override wins)
          const entryLocation = entry.locationId
            ? locationsMap.get(entry.locationId)
            : null;
          const shotLocation = shot.locationId
            ? locationsMap.get(shot.locationId)
            : null;
          const locationName =
            entryLocation?.name || shotLocation?.name || shot.locationName || "";

          const entryNotes = entry.notes ? stripHtml(entry.notes) : "";
          const shotNotes = shot.notes ? stripHtml(shot.notes) : "";
          // Notes field: prioritize entry notes, then shot notes (not description)
          const resolvedNotes = entryNotes || shotNotes;
          // Description field: separate from notes for granular toggle control
          const resolvedDescription = resolvedShotDescription;
          // Tags: pass through from shot (array of {id, label, color})
          const resolvedTags = Array.isArray(shot.tags) ? shot.tags : [];

          const shotImage = getPrimaryAttachmentWithStyle(shot);
          return {
            ...baseResolved,
            shotNumber: shot.shotNumber ? String(shot.shotNumber) : "",
            resolvedTitle: shot.name || shot.shotNumber || `Shot ${entry.shotRef}`,
            resolvedDetails,
            resolvedTalent: talentNames,
            resolvedProducts: productNames,
            resolvedLocation: locationName,
            // Use unified resolver for consistent cover images across all views
            resolvedImage: resolveShotCoverImage(shot, shotProducts),
            resolvedImagePosition: shotImage?.objectPosition,
            description: "",
            resolvedDescription,
            resolvedNotes,
            resolvedTags,
          };
        }
      } else if (entry.type === "custom" && entry.customData) {
        // Resolve from custom data
        const entryLocation = entry.locationId
          ? locationsMap.get(entry.locationId)
          : null;
        const locationName = entryLocation?.name || entry.customData.location || "";
        const entryNotes = entry.notes ? stripHtml(entry.notes) : "";
        const customNotes = entry.customData.notes ? stripHtml(entry.customData.notes) : "";
        const resolvedNotes = entryNotes || customNotes;
        return {
          ...baseResolved,
          shotNumber: "",
          resolvedTitle: entry.customData.title || "Custom Item",
          resolvedTalent: entry.customData.talent || [],
          resolvedProducts: [],
          resolvedLocation: locationName,
          description: entry.description ? stripHtml(entry.description) : "",
          resolvedNotes,
        };
      }

      return baseResolved;
    });

    // Then compute overlaps
    return resolveOverlaps(resolved);
  }, [entries, shotsMap, talentMap, productsMap, locationsMap]);

  return { resolvedEntries, loading, error };
}

/**
 * Hook for creating a schedule entry.
 *
 * @param {string} clientId - Client ID
 * @param {string} projectId - Project ID
 * @param {string} scheduleId - Schedule ID
 * @param {object} options - Mutation options
 * @returns {object} Mutation result
 */
export function useCreateScheduleEntry(clientId, projectId, scheduleId, options = {}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (entryData) => {
      // Demo mode: return fake success
      if (isDemoModeActive()) {
        const fakeId = `demo-entry-${Date.now()}`;
        console.info("[Demo Mode] Entry creation blocked, returning fake ID:", fakeId);
        return { id: fakeId, ...entryData };
      }

      // Debug logging
      const pathSegments = scheduleEntriesPath(projectId, scheduleId, clientId);
      console.log("[useCreateScheduleEntry] Path segments:", pathSegments);
      console.log("[useCreateScheduleEntry] clientId:", clientId, "projectId:", projectId, "scheduleId:", scheduleId);

      const entriesRef = collection(
        db,
        ...pathSegments
      );

      // Sanitize customData to remove undefined values (Firestore rejects undefined)
      const sanitizedCustomData = entryData.customData
        ? Object.fromEntries(
            Object.entries(entryData.customData).filter(([_, v]) => v !== undefined)
          )
        : null;

      const fullData = {
        trackId: entryData.trackId,
        startTime: entryData.startTime || "09:00",
        duration: typeof entryData.duration === "number" ? entryData.duration : 15,
        order: entryData.order || 0,
        type: entryData.type || "custom",
        shotRef: entryData.shotRef || null,
        customData: sanitizedCustomData,
        ...(entryData.locationId !== undefined && { locationId: entryData.locationId }),
        ...(entryData.notes !== undefined && { notes: entryData.notes }),
        ...(entryData.appliesToTrackIds !== undefined && {
          appliesToTrackIds: entryData.appliesToTrackIds,
        }),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(entriesRef, fullData);
      return { id: docRef.id, ...fullData };
    },
    onSuccess: (newEntry, variables) => {
      queryClient.invalidateQueries({
        queryKey: scheduleQueryKeys.scheduleEntries(clientId, projectId, scheduleId),
      });

      if (options.onSuccess) {
        options.onSuccess(newEntry, variables);
      }
    },
    onError: (error, variables, context) => {
      const { code, message } = describeFirebaseError(error, "Failed to create entry");
      console.error("[useCreateScheduleEntry] Error:", error);
      toast.error({ title: "Failed to create entry", description: `${code}: ${message}` });

      if (options.onError) {
        options.onError(error, variables, context);
      }
    },
  });
}

/**
 * Hook for updating a schedule entry.
 *
 * @param {string} clientId - Client ID
 * @param {string} projectId - Project ID
 * @param {string} scheduleId - Schedule ID
 * @param {object} options - Mutation options
 * @returns {object} Mutation result
 */
export function useUpdateScheduleEntry(clientId, projectId, scheduleId, options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ entryId, updates }) => {
      // Demo mode: return fake success
      if (isDemoModeActive()) {
        console.info("[Demo Mode] Entry update blocked for:", entryId);
        return { entryId, updates };
      }

      const entryRef = doc(
        db,
        ...scheduleEntryPath(projectId, scheduleId, entryId, clientId)
      );
      await updateDoc(entryRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      return { entryId, updates };
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({
        queryKey: scheduleQueryKeys.scheduleEntries(clientId, projectId, scheduleId),
      });

      if (options.onSuccess) {
        options.onSuccess(data, variables, context);
      }
    },
    onError: (error, variables, context) => {
      const { code, message } = describeFirebaseError(error, "Failed to update entry");
      console.error("[useUpdateScheduleEntry] Error:", error);
      toast.error({ title: "Failed to update entry", description: `${code}: ${message}` });

      if (options.onError) {
        options.onError(error, variables, context);
      }
    },
  });
}

/**
 * Hook for deleting a schedule entry.
 *
 * @param {string} clientId - Client ID
 * @param {string} projectId - Project ID
 * @param {string} scheduleId - Schedule ID
 * @param {object} options - Mutation options
 * @returns {object} Mutation result
 */
export function useDeleteScheduleEntry(clientId, projectId, scheduleId, options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ entryId }) => {
      // Demo mode: return fake success
      if (isDemoModeActive()) {
        console.info("[Demo Mode] Entry deletion blocked for:", entryId);
        return { entryId };
      }

      const entryRef = doc(
        db,
        ...scheduleEntryPath(projectId, scheduleId, entryId, clientId)
      );
      await deleteDoc(entryRef);
      return { entryId };
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({
        queryKey: scheduleQueryKeys.scheduleEntries(clientId, projectId, scheduleId),
      });

      if (options.onSuccess) {
        options.onSuccess(data, variables, context);
      }
    },
    onError: (error, variables, context) => {
      const { code, message } = describeFirebaseError(error, "Failed to delete entry");
      console.error("[useDeleteScheduleEntry] Error:", error);
      toast.error({ title: "Failed to delete entry", description: `${code}: ${message}` });

      if (options.onError) {
        options.onError(error, variables, context);
      }
    },
  });
}

/**
 * Hook for batch updating multiple entries (e.g., after cascade).
 *
 * @param {string} clientId - Client ID
 * @param {string} projectId - Project ID
 * @param {string} scheduleId - Schedule ID
 * @param {object} options - Mutation options
 * @returns {object} Mutation result
 */
export function useBatchUpdateEntries(clientId, projectId, scheduleId, options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ updates }) => {
      // Demo mode: return fake success
      if (isDemoModeActive()) {
        console.info("[Demo Mode] Batch entry update blocked for:", updates.length, "entries");
        return { updates };
      }

      const batch = writeBatch(db);
      const BATCH_LIMIT = 500;

      // Process in batches of 500 (Firestore limit)
      for (let i = 0; i < updates.length; i += BATCH_LIMIT) {
        const batchUpdates = updates.slice(i, i + BATCH_LIMIT);
        const currentBatch = writeBatch(db);

        batchUpdates.forEach(({ entryId, ...entryUpdates }) => {
          const entryRef = doc(
            db,
            ...scheduleEntryPath(projectId, scheduleId, entryId, clientId)
          );
          currentBatch.update(entryRef, {
            ...entryUpdates,
            updatedAt: serverTimestamp(),
          });
        });

        await currentBatch.commit();
      }

      return { updates };
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({
        queryKey: scheduleQueryKeys.scheduleEntries(clientId, projectId, scheduleId),
      });

      if (options.onSuccess) {
        options.onSuccess(data, variables, context);
      }
    },
    onError: (error, variables, context) => {
      const { code, message } = describeFirebaseError(
        error,
        "Failed to batch update entries"
      );
      console.error("[useBatchUpdateEntries] Error:", error);
      toast.error({ title: "Failed to update entries", description: `${code}: ${message}` });

      if (options.onError) {
        options.onError(error, variables, context);
      }
    },
  });
}

/**
 * Hook for moving an entry (time change with optional cascade).
 *
 * @param {string} clientId - Client ID
 * @param {string} projectId - Project ID
 * @param {string} scheduleId - Schedule ID
 * @param {boolean} cascadeEnabled - Whether to cascade subsequent entries
 * @param {object} options - Mutation options
 * @returns {object} Mutation result with moveEntry function
 */
export function useMoveEntry(
  clientId,
  projectId,
  scheduleId,
  cascadeEnabled = true,
  options = {}
) {
  const updateEntry = useUpdateScheduleEntry(clientId, projectId, scheduleId, options);
  const batchUpdate = useBatchUpdateEntries(clientId, projectId, scheduleId, options);

  const moveEntry = useCallback(
    (entryId, newStartTime, allEntries) => {
      if (!cascadeEnabled) {
        // Simple update, no cascade
        return updateEntry.mutate({
          entryId,
          updates: { startTime: newStartTime },
        });
      }

      const updates = buildGaplessTimeChangeUpdates(allEntries, entryId, newStartTime);
      if (updates.length === 0) return;

      if (updates.length === 1) {
        const [{ entryId: targetId, ...entryUpdates }] = updates;
        return updateEntry.mutate({ entryId: targetId, updates: entryUpdates });
      }

      return batchUpdate.mutate({ updates });
    },
    [updateEntry, batchUpdate, cascadeEnabled]
  );

  return {
    moveEntry,
    isLoading: updateEntry.isPending || batchUpdate.isPending,
    error: updateEntry.error || batchUpdate.error,
  };
}

/**
 * Hook for resizing an entry (duration change with optional cascade).
 *
 * @param {string} clientId - Client ID
 * @param {string} projectId - Project ID
 * @param {string} scheduleId - Schedule ID
 * @param {boolean} cascadeEnabled - Whether to cascade subsequent entries
 * @param {object} options - Mutation options
 * @returns {object} Mutation result with resizeEntry function
 */
export function useResizeEntry(
  clientId,
  projectId,
  scheduleId,
  cascadeEnabled = true,
  options = {}
) {
  const updateEntry = useUpdateScheduleEntry(clientId, projectId, scheduleId, options);
  const batchUpdate = useBatchUpdateEntries(clientId, projectId, scheduleId, options);

  const resizeEntry = useCallback(
    (entryId, newDuration, allEntries) => {
      if (!cascadeEnabled) {
        // Simple update, no cascade
        return updateEntry.mutate({
          entryId,
          updates: { duration: newDuration },
        });
      }

      const updates = buildGaplessDurationChangeUpdates(allEntries, entryId, newDuration);
      if (updates.length === 0) return;

      if (updates.length === 1) {
        const [{ entryId: targetId, ...entryUpdates }] = updates;
        return updateEntry.mutate({ entryId: targetId, updates: entryUpdates });
      }

      return batchUpdate.mutate({ updates });
    },
    [updateEntry, batchUpdate, cascadeEnabled]
  );

  return {
    resizeEntry,
    isLoading: updateEntry.isPending || batchUpdate.isPending,
    error: updateEntry.error || batchUpdate.error,
  };
}

/**
 * Hook for moving an entry to a different track.
 *
 * @param {string} clientId - Client ID
 * @param {string} projectId - Project ID
 * @param {string} scheduleId - Schedule ID
 * @param {object} options - Mutation options
 * @returns {object} Mutation result with moveToTrack function
 */
export function useMoveEntryToTrack(clientId, projectId, scheduleId, options = {}) {
  const updateEntry = useUpdateScheduleEntry(clientId, projectId, scheduleId, options);

  const moveToTrack = useCallback(
    (entryId, newTrackId, newStartTime = null) => {
      const updates = { trackId: newTrackId };
      if (newStartTime) {
        updates.startTime = newStartTime;
      }
      return updateEntry.mutate({ entryId, updates });
    },
    [updateEntry]
  );

  return {
    moveToTrack,
    ...updateEntry,
  };
}

/**
 * Hook for adding a shot as a schedule entry.
 *
 * @param {string} clientId - Client ID
 * @param {string} projectId - Project ID
 * @param {string} scheduleId - Schedule ID
 * @param {object} options - Mutation options
 * @returns {object} Mutation result with addShot function
 */
export function useAddShotToSchedule(clientId, projectId, scheduleId, options = {}) {
  const createEntry = useCreateScheduleEntry(clientId, projectId, scheduleId, options);
  const pendingEndMinutesByTrackRef = useRef(new Map());

  const addShot = useCallback(
    (shotId, trackId, startTime, duration = 30) => {
      return createEntry.mutateAsync({
        trackId,
        startTime,
        duration,
        type: "shot",
        shotRef: shotId,
        customData: null,
      });
    },
    [createEntry]
  );

  const addShotAtEnd = useCallback(
    (shotId, trackId, allEntries, duration = 30) => {
      const baseStartTime = getNextAvailableTime(allEntries, trackId, 0);
      const baseStartMinutes = parseTimeToMinutes(baseStartTime);
      const pendingEndMinutes = pendingEndMinutesByTrackRef.current.get(trackId);
      const startMinutes =
        typeof pendingEndMinutes === "number"
          ? Math.max(baseStartMinutes, pendingEndMinutes)
          : baseStartMinutes;
      const startTime = minutesToTimeString(startMinutes);
      pendingEndMinutesByTrackRef.current.set(trackId, startMinutes + duration);

      return createEntry.mutateAsync({
        trackId,
        startTime,
        duration,
        type: "shot",
        shotRef: shotId,
        customData: null,
      });
    },
    [createEntry]
  );

  return {
    addShot,
    addShotAtEnd,
    ...createEntry,
  };
}

/**
 * Hook for adding a custom item to the schedule.
 *
 * @param {string} clientId - Client ID
 * @param {string} projectId - Project ID
 * @param {string} scheduleId - Schedule ID
 * @param {object} options - Mutation options
 * @returns {object} Mutation result with addCustomItem function
 */
export function useAddCustomItem(clientId, projectId, scheduleId, options = {}) {
  const createEntry = useCreateScheduleEntry(clientId, projectId, scheduleId, options);
  const pendingEndMinutesByTrackRef = useRef(new Map());

  const addCustomItem = useCallback(
    (customData, trackId, startTime, duration = 30, appliesToTrackIds = null) => {
      return createEntry.mutateAsync({
        trackId,
        startTime,
        duration,
        type: "custom",
        shotRef: null,
        customData,
        appliesToTrackIds,
      });
    },
    [createEntry]
  );

  const addCustomItemAtEnd = useCallback(
    (customData, trackId, allEntries, duration = 30, appliesToTrackIds = null) => {
      const baseStartTime = getNextAvailableTime(allEntries, trackId, 0);
      const baseStartMinutes = parseTimeToMinutes(baseStartTime);
      const pendingEndMinutes = pendingEndMinutesByTrackRef.current.get(trackId);
      const startMinutes =
        typeof pendingEndMinutes === "number"
          ? Math.max(baseStartMinutes, pendingEndMinutes)
          : baseStartMinutes;
      const startTime = minutesToTimeString(startMinutes);
      pendingEndMinutesByTrackRef.current.set(trackId, startMinutes + duration);

      return createEntry.mutateAsync({
        trackId,
        startTime,
        duration,
        type: "custom",
        shotRef: null,
        customData,
        appliesToTrackIds,
      });
    },
    [createEntry]
  );

  return {
    addCustomItem,
    addCustomItemAtEnd,
    ...createEntry,
  };
}

/**
 * Hook for bulk operations on entries.
 *
 * @param {string} clientId - Client ID
 * @param {string} projectId - Project ID
 * @param {string} scheduleId - Schedule ID
 * @param {object} options - Mutation options
 * @returns {object} Bulk operation functions
 */
export function useBulkEntryOperations(clientId, projectId, scheduleId, options = {}) {
  const queryClient = useQueryClient();

  const bulkDelete = useMutation({
    mutationFn: async ({ entryIds }) => {
      if (isDemoModeActive()) {
        console.info("[Demo Mode] Bulk deletion blocked for:", entryIds.length, "entries");
        return { entryIds };
      }

      const batch = writeBatch(db);
      entryIds.forEach((entryId) => {
        const entryRef = doc(
          db,
          ...scheduleEntryPath(projectId, scheduleId, entryId, clientId)
        );
        batch.delete(entryRef);
      });

      await batch.commit();
      return { entryIds };
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({
        queryKey: scheduleQueryKeys.scheduleEntries(clientId, projectId, scheduleId),
      });

      toast.success({
        title: `Deleted ${variables.entryIds.length} ${
          variables.entryIds.length === 1 ? "entry" : "entries"
        }`,
      });

      if (options.onSuccess) {
        options.onSuccess(data, variables, context);
      }
    },
    onError: (error) => {
      const { code, message } = describeFirebaseError(error, "Failed to delete entries");
      toast.error({ title: "Failed to delete entries", description: `${code}: ${message}` });
    },
  });

  const bulkMoveToTrack = useMutation({
    mutationFn: async ({ entryIds, trackId }) => {
      if (isDemoModeActive()) {
        console.info("[Demo Mode] Bulk move blocked for:", entryIds.length, "entries");
        return { entryIds, trackId };
      }

      const batch = writeBatch(db);
      entryIds.forEach((entryId) => {
        const entryRef = doc(
          db,
          ...scheduleEntryPath(projectId, scheduleId, entryId, clientId)
        );
        batch.update(entryRef, { trackId, updatedAt: serverTimestamp() });
      });

      await batch.commit();
      return { entryIds, trackId };
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({
        queryKey: scheduleQueryKeys.scheduleEntries(clientId, projectId, scheduleId),
      });

      if (options.onSuccess) {
        options.onSuccess(data, variables, context);
      }
    },
    onError: (error) => {
      const { code, message } = describeFirebaseError(error, "Failed to move entries");
      toast.error({ title: "Failed to move entries", description: `${code}: ${message}` });
    },
  });

  return {
    bulkDelete: bulkDelete.mutate,
    bulkMoveToTrack: bulkMoveToTrack.mutate,
    isBulkDeleting: bulkDelete.isPending,
    isBulkMoving: bulkMoveToTrack.isPending,
  };
}
