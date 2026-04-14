/**
 * TanStack Query hooks for activity feed operations
 *
 * Provides realtime activity subscriptions with intelligent caching,
 * automatic background refetching, and filtering capabilities.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { queryKeys } from "./useFirestoreQuery";
import { cleanupExpiredActivities } from "../lib/activityLogger";

/**
 * Hook for fetching project activities with realtime updates
 *
 * @param {string} clientId - Client ID
 * @param {string} projectId - Project ID
 * @param {object} filters - Filter options
 * @param {string[]} filters.types - Activity types to filter (e.g., ['shot_created', 'comment_added'])
 * @param {string[]} filters.actorIds - User IDs to filter
 * @param {Date} filters.startDate - Start date for range filter
 * @param {Date} filters.endDate - End date for range filter
 * @param {number} filters.limit - Max results (default: 100)
 * @param {object} options - Query options
 * @returns {object} Query result with data, loading, error states
 *
 * @example
 * const { data: activities, isLoading } = useActivities(
 *   clientId,
 *   projectId,
 *   { types: ['shot_created', 'comment_added'], limit: 50 }
 * );
 */
export function useActivities(clientId, projectId, filters = {}, options = {}) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.activities(clientId, projectId, filters);

  // Initial query with cache
  const result = useQuery({
    queryKey,
    queryFn: async () => {
      if (!clientId || !projectId) return [];

      const activitiesRef = collection(
        db,
        "clients",
        clientId,
        "projects",
        projectId,
        "activities"
      );

      // Build query with filters
      let q = query(activitiesRef);

      // Filter by type (Firestore 'in' operator limited to 10 items)
      if (filters.types && filters.types.length > 0 && filters.types.length <= 10) {
        q = query(q, where("type", "in", filters.types));
      }

      // Filter by actor (Firestore 'in' operator limited to 10 items)
      if (filters.actorIds && filters.actorIds.length > 0 && filters.actorIds.length <= 10) {
        q = query(q, where("actorId", "in", filters.actorIds));
      }

      // Sort by creation time (newest first)
      q = query(q, orderBy("createdAt", "desc"));

      // Limit results
      const resultLimit = filters.limit || 100;
      q = query(q, limit(resultLimit));

      const snapshot = await getDocs(q);
      let activities = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Client-side filtering (for cases where Firestore 'in' is limited)
      if (filters.types && filters.types.length > 10) {
        activities = activities.filter((a) => filters.types.includes(a.type));
      }

      if (filters.actorIds && filters.actorIds.length > 10) {
        activities = activities.filter((a) =>
          filters.actorIds.includes(a.actorId)
        );
      }

      // Date range filtering (client-side)
      if (filters.startDate) {
        activities = activities.filter((a) => {
          const activityDate = a.createdAt?.toDate?.() || new Date(a.createdAt);
          return activityDate >= filters.startDate;
        });
      }

      if (filters.endDate) {
        activities = activities.filter((a) => {
          const activityDate = a.createdAt?.toDate?.() || new Date(a.createdAt);
          return activityDate <= filters.endDate;
        });
      }

      return activities;
    },
    enabled: !!clientId && !!projectId,
    staleTime: 1000 * 60, // 1 minute - activities don't change frequently
    ...options,
  });

  // Set up realtime subscription
  useEffect(() => {
    if (!clientId || !projectId) return;

    const activitiesRef = collection(
      db,
      "clients",
      clientId,
      "projects",
      projectId,
      "activities"
    );

    // Build subscription query (same as initial query)
    let q = query(activitiesRef, orderBy("createdAt", "desc"));

    // Apply filters
    if (filters.types && filters.types.length > 0 && filters.types.length <= 10) {
      q = query(q, where("type", "in", filters.types));
    }

    if (filters.actorIds && filters.actorIds.length > 0 && filters.actorIds.length <= 10) {
      q = query(q, where("actorId", "in", filters.actorIds));
    }

    q = query(q, limit(filters.limit || 100));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let activities = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Apply client-side filters (same as initial query)
        if (filters.types && filters.types.length > 10) {
          activities = activities.filter((a) => filters.types.includes(a.type));
        }

        if (filters.actorIds && filters.actorIds.length > 10) {
          activities = activities.filter((a) =>
            filters.actorIds.includes(a.actorId)
          );
        }

        if (filters.startDate) {
          activities = activities.filter((a) => {
            const activityDate = a.createdAt?.toDate?.() || new Date(a.createdAt);
            return activityDate >= filters.startDate;
          });
        }

        if (filters.endDate) {
          activities = activities.filter((a) => {
            const activityDate = a.createdAt?.toDate?.() || new Date(a.createdAt);
            return activityDate <= filters.endDate;
          });
        }

        // Update cache with realtime data
        queryClient.setQueryData(queryKey, activities);
      },
      (error) => {
        console.error("[useActivities] Subscription error:", error);
      }
    );

    return () => unsubscribe();
  }, [
    clientId,
    projectId,
    queryClient,
    queryKey,
    filters.types,
    filters.actorIds,
    filters.startDate,
    filters.endDate,
    filters.limit,
  ]);

  // Opportunistic cleanup of expired activities (runs once per day per project)
  useEffect(() => {
    if (!clientId || !projectId) return;

    // Check if cleanup was run today
    const cleanupKey = `activities_cleanup_${projectId}`;
    const lastCleanup = localStorage.getItem(cleanupKey);
    const now = Date.now();

    // Only run once per day
    if (!lastCleanup || now - parseInt(lastCleanup) > 24 * 60 * 60 * 1000) {
      cleanupExpiredActivities(clientId, projectId)
        .then((deletedCount) => {
          if (deletedCount > 0) {
            console.log(
              `[useActivities] Cleaned up ${deletedCount} expired activities`
            );
            // Invalidate cache to refetch without deleted activities
            queryClient.invalidateQueries({ queryKey });
          }
          localStorage.setItem(cleanupKey, now.toString());
        })
        .catch((error) => {
          console.error("[useActivities] Cleanup error:", error);
        });
    }
  }, [clientId, projectId, queryClient, queryKey]);

  return result;
}
