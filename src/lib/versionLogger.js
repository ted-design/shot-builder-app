/**
 * Version logging utilities for Shot Builder
 *
 * Provides safe, non-blocking version history logging to Firestore.
 * CRITICAL: Version logging failures must NEVER break core functionality.
 *
 * Pattern follows activityLogger.js - always non-blocking, never throws.
 */

import {
  collection,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { isDemoModeActive } from "./flags";
import { VERSION_RETENTION_DAYS } from "../types/versioning";

/**
 * Calculate the fields that changed between two objects
 *
 * @param {object} previousData - Previous document state
 * @param {object} currentData - Current document state
 * @returns {string[]} List of field names that changed
 */
function getChangedFields(previousData, currentData) {
  if (!previousData || !currentData) {
    return [];
  }

  const changedFields = [];
  const allKeys = new Set([
    ...Object.keys(previousData),
    ...Object.keys(currentData),
  ]);

  for (const key of allKeys) {
    // Skip internal/timestamp fields
    if (["id", "createdAt", "updatedAt", "deleted", "deletedAt"].includes(key)) {
      continue;
    }

    const prevValue = previousData[key];
    const currValue = currentData[key];

    // Simple comparison - stringify for deep comparison
    if (JSON.stringify(prevValue) !== JSON.stringify(currValue)) {
      changedFields.push(key);
    }
  }

  return changedFields;
}

/**
 * Create a clean snapshot of a document for storage
 * Removes internal fields and handles Firestore Timestamps
 *
 * @param {object} data - Document data
 * @returns {object} Clean snapshot
 */
function createCleanSnapshot(data) {
  if (!data) return {};

  const snapshot = { ...data };

  // Remove internal fields that shouldn't be versioned
  delete snapshot.id;

  // Convert Firestore Timestamps to ISO strings for storage
  for (const [key, value] of Object.entries(snapshot)) {
    if (value && typeof value === "object" && value.toDate) {
      snapshot[key] = value.toDate().toISOString();
    }
  }

  return snapshot;
}

/**
 * Create a version snapshot for an entity
 *
 * This is the core versioning function. It safely handles errors
 * to ensure versioning never breaks core functionality.
 *
 * @param {string} clientId - Client ID
 * @param {string} entityType - Entity type (shots, productFamilies, talent, locations)
 * @param {string} entityId - Entity document ID
 * @param {object} previousData - Previous document state (before update)
 * @param {object} currentData - Current document state (after update)
 * @param {object} user - User who made the change
 * @param {string} user.uid - User ID
 * @param {string} user.displayName - User display name
 * @param {string} user.email - User email (fallback for name)
 * @param {string|null} user.photoURL - User avatar URL
 * @param {string} changeType - Type of change (create, update, rollback)
 * @returns {Promise<string|null>} Version ID or null if failed
 *
 * @example
 * await createVersionSnapshot(
 *   clientId,
 *   'shots',
 *   shotId,
 *   previousShotData,
 *   currentShotData,
 *   user,
 *   'update'
 * );
 */
export async function createVersionSnapshot(
  clientId,
  entityType,
  entityId,
  previousData,
  currentData,
  user,
  changeType = "update"
) {
  // Feature flag check (can be disabled in development)
  if (import.meta.env.VITE_DISABLE_VERSION_LOGGING === "true") {
    return null;
  }

  // Demo mode: skip version logging
  if (isDemoModeActive()) {
    console.info("[Demo Mode] Version logging skipped:", entityType, entityId);
    return "demo-version-id";
  }

  try {
    if (!clientId || !entityType || !entityId) {
      console.warn("[Version Logger] Missing clientId, entityType, or entityId");
      return null;
    }

    if (!user || !user.uid) {
      console.warn("[Version Logger] Missing user information");
      return null;
    }

    // Calculate changed fields
    const changedFields = getChangedFields(previousData, currentData);

    // Skip if nothing changed (shouldn't happen, but safety check)
    if (changeType === "update" && changedFields.length === 0) {
      console.log("[Version Logger] No fields changed, skipping version");
      return null;
    }

    // Create clean snapshot of the document state
    const snapshot = createCleanSnapshot(currentData);

    // Calculate expiration date
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + VERSION_RETENTION_DAYS * 24 * 60 * 60 * 1000
    );

    const versionsRef = collection(
      db,
      "clients",
      clientId,
      entityType,
      entityId,
      "versions"
    );

    const versionData = {
      snapshot,
      createdAt: serverTimestamp(),
      createdBy: user.uid,
      createdByName: user.displayName || user.email || "Unknown User",
      createdByAvatar: user.photoURL || null,
      changeType,
      changedFields,
      expiresAt,
    };

    const docRef = await addDoc(versionsRef, versionData);

    console.log(
      `[Version Logger] Created version ${docRef.id} for ${entityType}/${entityId}`,
      { changeType, changedFields }
    );

    return docRef.id;
  } catch (error) {
    // CRITICAL: Never throw errors from version logging
    // Logging failures should not break core functionality
    console.error("[Version Logger] Failed to create version:", error);

    // Optional: Send to error monitoring
    if (typeof window !== "undefined" && window.Sentry) {
      window.Sentry.captureException(error, {
        tags: { component: "version-logger" },
        extra: { entityType, entityId, changeType },
      });
    }

    return null;
  }
}

/**
 * Restore an entity to a previous version
 *
 * @param {string} clientId - Client ID
 * @param {string} entityType - Entity type (shots, productFamilies, talent, locations)
 * @param {string} entityId - Entity document ID
 * @param {string} versionId - Version ID to restore
 * @param {object} user - User performing the restore
 * @returns {Promise<{success: boolean, error?: string}>} Result
 *
 * @example
 * const result = await restoreVersion(clientId, 'shots', shotId, versionId, user);
 * if (result.success) {
 *   toast.success({ title: "Version restored" });
 * }
 */
export async function restoreVersion(
  clientId,
  entityType,
  entityId,
  versionId,
  user
) {
  // Demo mode: return fake success
  if (isDemoModeActive()) {
    console.info("[Demo Mode] Version restore blocked:", versionId);
    return { success: true };
  }

  try {
    if (!clientId || !entityType || !entityId || !versionId) {
      return { success: false, error: "Missing required parameters" };
    }

    if (!user || !user.uid) {
      return { success: false, error: "User not authenticated" };
    }

    // 1. Fetch the version to restore
    const versionRef = doc(
      db,
      "clients",
      clientId,
      entityType,
      entityId,
      "versions",
      versionId
    );
    const versionDoc = await getDoc(versionRef);

    if (!versionDoc.exists()) {
      return { success: false, error: "Version not found" };
    }

    const versionData = versionDoc.data();
    const snapshotToRestore = versionData.snapshot;

    if (!snapshotToRestore) {
      return { success: false, error: "Version snapshot is empty" };
    }

    // 2. Get the current document state (for creating rollback version)
    const entityRef = doc(db, "clients", clientId, entityType, entityId);
    const entityDoc = await getDoc(entityRef);

    if (!entityDoc.exists()) {
      return { success: false, error: "Entity not found" };
    }

    const currentData = { id: entityId, ...entityDoc.data() };

    // 3. Update the entity with the snapshot data
    const updateData = {
      ...snapshotToRestore,
      updatedAt: serverTimestamp(),
    };

    // Remove fields that shouldn't be restored
    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.createdBy;

    await updateDoc(entityRef, updateData);

    // 4. Create a new version entry marking this as a rollback
    await createVersionSnapshot(
      clientId,
      entityType,
      entityId,
      currentData,
      { ...currentData, ...snapshotToRestore },
      user,
      "rollback"
    );

    console.log(
      `[Version Logger] Restored ${entityType}/${entityId} to version ${versionId}`
    );

    return { success: true };
  } catch (error) {
    console.error("[Version Logger] Failed to restore version:", error);

    if (typeof window !== "undefined" && window.Sentry) {
      window.Sentry.captureException(error, {
        tags: { component: "version-logger" },
        extra: { entityType, entityId, versionId },
      });
    }

    return {
      success: false,
      error: error.message || "Failed to restore version",
    };
  }
}

/**
 * Create initial version when an entity is first created
 *
 * @param {string} clientId - Client ID
 * @param {string} entityType - Entity type
 * @param {string} entityId - Entity document ID
 * @param {object} entityData - The created entity data
 * @param {object} user - User who created the entity
 * @returns {Promise<string|null>} Version ID or null if failed
 */
export async function createInitialVersion(
  clientId,
  entityType,
  entityId,
  entityData,
  user
) {
  return createVersionSnapshot(
    clientId,
    entityType,
    entityId,
    null, // No previous data for initial version
    entityData,
    user,
    "create"
  );
}
