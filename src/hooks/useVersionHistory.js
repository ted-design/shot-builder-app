/**
 * Hook for fetching and managing version history
 *
 * Provides real-time subscription to document version history with
 * support for viewing past versions and restoring to previous states.
 */

import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { restoreVersion } from "../lib/versionLogger";
import { toast } from "../lib/toast";
import { MAX_VERSIONS_PER_QUERY } from "../types/versioning";

/**
 * Query key factory for version history
 */
export const versionQueryKeys = {
  versions: (clientId, entityType, entityId) => [
    "versions",
    clientId,
    entityType,
    entityId,
  ],
};

/**
 * Hook for fetching version history of an entity
 *
 * @param {string} clientId - Client ID
 * @param {string} entityType - Entity type (shots, productFamilies, talent, locations)
 * @param {string} entityId - Entity document ID
 * @param {object} options - Hook options
 * @param {boolean} options.enabled - Whether to enable the query (default: true)
 * @param {number} options.limit - Max versions to fetch (default: 50)
 * @returns {object} { versions, isLoading, error, refetch }
 *
 * @example
 * const { versions, isLoading } = useVersionHistory(clientId, 'shots', shotId);
 * versions.forEach(v => console.log(v.changedFields, v.createdByName));
 */
export function useVersionHistory(clientId, entityType, entityId, options = {}) {
  const queryClient = useQueryClient();
  const queryKey = versionQueryKeys.versions(clientId, entityType, entityId);
  const maxVersions = options.limit || MAX_VERSIONS_PER_QUERY;

  // Subscribe to real-time updates
  useEffect(() => {
    if (!clientId || !entityType || !entityId || options.enabled === false) {
      return;
    }

    const versionsRef = collection(
      db,
      "clients",
      clientId,
      entityType,
      entityId,
      "versions"
    );

    const versionsQuery = query(
      versionsRef,
      orderBy("createdAt", "desc"),
      limit(maxVersions)
    );

    const unsubscribe = onSnapshot(
      versionsQuery,
      (snapshot) => {
        const versions = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        queryClient.setQueryData(queryKey, versions);
      },
      (error) => {
        console.error("[useVersionHistory] Subscription error:", error);
      }
    );

    return () => unsubscribe();
  }, [clientId, entityType, entityId, maxVersions, options.enabled, queryClient, queryKey]);

  // Query for initial data and cache management
  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!clientId || !entityType || !entityId) {
        return [];
      }

      const versionsRef = collection(
        db,
        "clients",
        clientId,
        entityType,
        entityId,
        "versions"
      );

      const versionsQuery = query(
        versionsRef,
        orderBy("createdAt", "desc"),
        limit(maxVersions)
      );

      const snapshot = await getDocs(versionsQuery);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    },
    enabled:
      options.enabled !== false && Boolean(clientId && entityType && entityId),
    staleTime: 30 * 1000, // Consider fresh for 30 seconds
    cacheTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });

  const versions = useMemo(() => data || [], [data]);

  return {
    versions,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook for restoring an entity to a previous version
 *
 * @param {string} clientId - Client ID
 * @param {string} entityType - Entity type
 * @param {string} entityId - Entity document ID
 * @param {object} options - Mutation options
 * @returns {object} { restore, isRestoring }
 *
 * @example
 * const { restore, isRestoring } = useRestoreVersion(clientId, 'shots', shotId);
 * await restore(versionId);
 */
export function useRestoreVersion(clientId, entityType, entityId, options = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (versionId) => {
      if (!user) {
        throw new Error("User not authenticated");
      }

      const result = await restoreVersion(
        clientId,
        entityType,
        entityId,
        versionId,
        user
      );

      if (!result.success) {
        throw new Error(result.error || "Failed to restore version");
      }

      return result;
    },
    onSuccess: () => {
      // Invalidate entity queries to refetch updated data
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          // Invalidate queries that match the entity type
          return (
            Array.isArray(key) &&
            key[0] === entityType.replace("Families", "") && // Handle productFamilies -> products
            key[1] === clientId
          );
        },
      });

      toast.success({
        title: "Version restored",
        description: "The document has been restored to the selected version.",
      });

      if (options.onSuccess) {
        options.onSuccess();
      }
    },
    onError: (error) => {
      console.error("[useRestoreVersion] Error:", error);
      toast.error({
        title: "Failed to restore version",
        description: error.message || "An unexpected error occurred.",
      });

      if (options.onError) {
        options.onError(error);
      }
    },
  });

  return {
    restore: mutation.mutateAsync,
    isRestoring: mutation.isPending,
  };
}

/**
 * Get a human-readable summary of changed fields
 *
 * @param {string[]} changedFields - Array of field names
 * @returns {string} Human-readable summary
 */
export function formatChangedFields(changedFields) {
  if (!changedFields || changedFields.length === 0) {
    return "No changes recorded";
  }

  if (changedFields.length === 1) {
    return `Updated ${formatFieldName(changedFields[0])}`;
  }

  if (changedFields.length === 2) {
    return `Updated ${formatFieldName(changedFields[0])} and ${formatFieldName(changedFields[1])}`;
  }

  const firstTwo = changedFields.slice(0, 2).map(formatFieldName).join(", ");
  const remaining = changedFields.length - 2;
  return `Updated ${firstTwo} and ${remaining} more`;
}

/**
 * Format a field name for display
 *
 * @param {string} fieldName - Field name (camelCase)
 * @returns {string} Human-readable field name
 */
function formatFieldName(fieldName) {
  // Map common field names to readable versions
  const fieldLabels = {
    name: "name",
    description: "description",
    notes: "notes",
    status: "status",
    date: "date",
    talent: "talent",
    products: "products",
    location: "location",
    locationId: "location",
    locationName: "location",
    referenceImagePath: "reference image",
    attachments: "attachments",
    tags: "tags",
    styleName: "style name",
    styleNumber: "style number",
    productType: "product type",
    gender: "gender",
    sizes: "sizes",
    colorNames: "colors",
    email: "email",
    phone: "phone",
    agency: "agency",
    headshotPath: "headshot",
    street: "address",
    city: "city",
    province: "province",
    postal: "postal code",
  };

  return fieldLabels[fieldName] || fieldName.replace(/([A-Z])/g, " $1").toLowerCase().trim();
}

/**
 * Format a timestamp for display in version history
 *
 * @param {import('firebase/firestore').Timestamp} timestamp - Firestore timestamp
 * @returns {string} Formatted date string
 */
export function formatVersionTimestamp(timestamp) {
  if (!timestamp) return "Unknown time";

  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return "Just now";
  }

  if (diffMins < 60) {
    return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  }

  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  }

  // For older versions, show full date
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    hour: "numeric",
    minute: "2-digit",
  });
}
