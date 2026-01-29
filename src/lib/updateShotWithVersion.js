/**
 * Centralized shot update with automatic version snapshot creation.
 *
 * Replaces direct updateDoc calls in shot editor components so that
 * every shot mutation flows through the existing versionLogger system.
 *
 * CRITICAL: Version logging failures must NEVER break core functionality.
 * The updateDoc write is the primary operation; versioning is fire-and-forget.
 */

import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { shotsPath } from "./paths";
import { createVersionSnapshot } from "./versionLogger";

/**
 * Update a shot document and create a version snapshot.
 *
 * @param {object} params
 * @param {string} params.clientId - Client ID
 * @param {string} params.shotId - Shot document ID
 * @param {object} params.patch - Fields to update (excluding updatedAt/updatedBy)
 * @param {object} params.shot - Current shot object (used as previousData for version diff)
 * @param {object} params.user - Firebase user object { uid, displayName, email, photoURL }
 * @param {string} [params.source] - DEV-only label for logging (e.g. "ShotLooksCanvas")
 * @returns {Promise<void>}
 */
export async function updateShotWithVersion({
  clientId,
  shotId,
  patch,
  shot,
  user,
  source = "unknown",
}) {
  if (!clientId || !shotId) {
    throw new Error("[updateShotWithVersion] Missing clientId or shotId");
  }

  // Build Firestore update payload
  const updatePayload = {
    ...patch,
    updatedAt: serverTimestamp(),
  };

  // Only write updatedBy if user exists (never write null)
  if (user?.uid) {
    updatePayload.updatedBy = user.uid;
  }

  const shotRef = doc(db, ...shotsPath(clientId), shotId);
  await updateDoc(shotRef, updatePayload);

  // Create version snapshot (non-blocking, fire-and-forget)
  if (user && shot) {
    const previousData = { id: shotId, ...shot };
    const currentData = { ...previousData, ...patch };

    createVersionSnapshot(
      clientId,
      "shots",
      shotId,
      previousData,
      currentData,
      user,
      "update"
    ).then((versionId) => {
      if (import.meta.env.DEV && import.meta.env.VITE_LOG_SHOT_VERSIONS === "true") {
        const fields = Object.keys(patch).filter(
          (k) => !["updatedAt", "updatedBy"].includes(k)
        );
        console.log(
          `[SHOT-VERSION] shotId=${shotId} source=${source} fields=${fields.join(",")} versionWritten=${!!versionId}`
        );
      }
    }).catch((error) => {
      console.error(`[updateShotWithVersion] Version snapshot failed (source=${source}):`, error);
    });
  }
}
