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
 * Fields where a short before→after summary is meaningful.
 * For anything else we fall back to "X changed".
 */
const PRIMITIVE_SUMMARY_FIELDS = new Set([
  "name",
  "status",
  "description",
  "shotNumber",
  "gender",
  "productType",
  "styleName",
  "styleNumber",
  "email",
  "phone",
  "agency",
  "city",
  "province",
  "postal",
  "street",
]);

/**
 * Generate up to `max` human-readable change summaries for a version.
 *
 * Uses the version's own snapshot and the previous (older) version's snapshot
 * to derive before→after labels for primitive fields.  Complex fields fall
 * back to descriptive labels like "Notes changed".
 *
 * @param {object} version - The version document
 * @param {object|null} olderVersion - The next-older version (or null for first)
 * @param {number} [max=2] - Maximum summaries to return
 * @returns {string[]} Array of summary strings
 */
export function getChangeSummaries(version, olderVersion, max = 2) {
  const fields = version?.changedFields;
  if (!fields || fields.length === 0) {
    if (version?.changeType === "create") return ["Initial version"];
    return [];
  }

  const summaries = [];
  const currentSnap = version.snapshot || {};
  const previousSnap = olderVersion?.snapshot || {};

  for (const field of fields) {
    if (summaries.length >= max) break;

    const label = formatFieldName(field);
    const curr = currentSnap[field];
    const prev = previousSnap[field];

    // For primitives with short string values, show before→after
    if (
      PRIMITIVE_SUMMARY_FIELDS.has(field) &&
      isPrimitive(curr) &&
      isPrimitive(prev) &&
      prev !== undefined &&
      curr !== undefined
    ) {
      const prevStr = truncateValue(String(prev));
      const currStr = truncateValue(String(curr));
      if (prevStr !== currStr) {
        summaries.push(`${capitalize(label)}: ${prevStr} → ${currStr}`);
      } else {
        summaries.push(`${capitalize(label)} changed`);
      }
    } else {
      summaries.push(`${capitalize(label)} changed`);
    }
  }

  // If there are more fields than max, note it
  if (fields.length > max) {
    summaries.push(`+${fields.length - max} more`);
  }

  return summaries;
}

/**
 * Extract a plain-text notes preview snippet from a version's snapshot.
 *
 * Returns null if the version doesn't include notes changes, or if notes
 * are missing/empty. Returns "(Notes cleared)" if notes were explicitly
 * set to empty. Otherwise returns a whitespace-normalized, truncated
 * plain-text snippet.
 *
 * @param {object} version - Version document with snapshot and changedFields
 * @param {number} [maxLen=120] - Maximum characters before truncation
 * @returns {string|null} Preview string or null
 */
export function getNotesPreview(version, maxLen = 120) {
  if (!version) return null;

  const fields = version.changedFields;
  if (!fields || !fields.includes("notes")) return null;

  const notes = version.snapshot?.notes;

  // Notes were cleared
  if (notes === "" || notes === null || notes === undefined) {
    return "(Notes cleared)";
  }

  if (typeof notes !== "string") return null;

  // Strip HTML tags for plain-text preview
  const plain = notes
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();

  if (!plain) return "(Notes cleared)";

  if (plain.length <= maxLen) return plain;
  return plain.slice(0, maxLen - 1) + "\u2026";
}

/**
 * Extract before/after plain-text previews for Notes from two adjacent versions.
 *
 * Returns `null` if the version doesn't include a notes change.
 * "Before" comes from the older version's snapshot; "After" from the current.
 * When the older version is unavailable, `before` is null.
 *
 * @param {object} version - The version document (newer)
 * @param {object|null} olderVersion - The next-older version (or null)
 * @param {number} [maxLen=100] - Maximum characters per preview
 * @returns {{ before: string|null, after: string|null } | null}
 */
export function getNotesBeforeAfter(version, olderVersion, maxLen = 100) {
  if (!version) return null;

  const fields = version.changedFields;
  if (!fields || !fields.includes("notes")) return null;

  const stripHtml = (html) => {
    if (html === null || html === undefined || html === "") return null;
    if (typeof html !== "string") return null;
    const plain = html
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, " ")
      .trim();
    if (!plain) return null;
    if (plain.length <= maxLen) return plain;
    return plain.slice(0, maxLen - 1) + "\u2026";
  };

  const after = stripHtml(version.snapshot?.notes) ?? "(Notes cleared)";
  const before = olderVersion
    ? (stripHtml(olderVersion.snapshot?.notes) ?? "(No notes)")
    : null; // unknown — oldest version

  return { before, after };
}

/**
 * Strip HTML tags and decode entities from a notes string, returning plain text.
 * Shared helper used by both row previews and restore comparisons.
 *
 * @param {string|null|undefined} html - Raw HTML notes string
 * @param {number} [maxLen=120] - Maximum characters before truncation
 * @returns {string|null} Plain text or null if empty/missing
 */
export function stripNotesHtml(html, maxLen = 120) {
  if (html === null || html === undefined || html === "") return null;
  if (typeof html !== "string") return null;
  const plain = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return null;
  if (plain.length <= maxLen) return plain;
  return plain.slice(0, maxLen - 1) + "\u2026";
}

/**
 * Get a plain-text snapshot preview of notes stored in a version.
 *
 * Unlike getNotesBeforeAfter, this returns the snapshot's own state
 * (not a diff against an adjacent version). Suitable for row-level display.
 *
 * @param {object} version - Version document with snapshot
 * @param {number} [maxLen=120] - Max characters
 * @returns {string|null} Preview string or null if no notes in snapshot
 */
export function getNotesSnapshotPreview(version, maxLen = 120) {
  if (!version?.snapshot) return null;
  const notes = version.snapshot.notes;
  if (notes === "" || notes === null || notes === undefined) return "(No notes)";
  return stripNotesHtml(notes, maxLen) ?? "(No notes)";
}

/**
 * Compare current live entity notes against a target version's snapshot notes.
 *
 * Used exclusively by the restore confirm dialog to show CURRENT → TARGET.
 * Does NOT use adjacency logic.
 *
 * @param {object} currentEntityData - Live shot/entity data (from editor context)
 * @param {object} targetVersion - Version to restore to
 * @param {number} [maxLen=120] - Max characters per preview
 * @returns {{ current: string, target: string, notesWillChange: boolean } | null}
 */
export function getRestoreNotesComparison(currentEntityData, targetVersion, maxLen = 120) {
  if (!targetVersion?.snapshot) return null;

  // Only relevant if the target snapshot has notes
  const targetNotes = targetVersion.snapshot.notes;
  if (targetNotes === undefined) return null;

  const currentNotes = currentEntityData?.notes;

  const currentPlain = stripNotesHtml(currentNotes, maxLen) ?? "(No notes)";
  const targetPlain = stripNotesHtml(targetNotes, maxLen) ?? "(No notes)";

  // Normalize for equality comparison (full text, not truncated)
  const currentNorm = stripNotesHtml(currentNotes, 999999) ?? "";
  const targetNorm = stripNotesHtml(targetNotes, 999999) ?? "";

  return {
    current: currentPlain,
    target: targetPlain,
    notesWillChange: currentNorm !== targetNorm,
  };
}

/** @returns {boolean} */
function isPrimitive(value) {
  return value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

/** Truncate a display value to keep summaries compact. */
function truncateValue(str, maxLen = 24) {
  if (!str) return '""';
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "\u2026";
}

/** Capitalise the first character of a string. */
function capitalize(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
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

  // Firestore Timestamps have toDate(); plain ISO strings / numbers fall through to Date ctor.
  let date;
  try {
    date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return "Unknown time";
  } catch {
    return "Unknown time";
  }

  const now = new Date();
  const diffMs = now - date;

  // Handle future timestamps (clock skew or pending server timestamp)
  if (diffMs < 0) {
    return "Just now";
  }

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
