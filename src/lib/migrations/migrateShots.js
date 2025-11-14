/**
 * Migration utility for converting shots from single referenceImagePath to attachments array
 *
 * Usage:
 *   import { migrateShotsToAttachments } from './lib/migrations/migrateShots';
 *   await migrateShotsToAttachments({ db, clientId, dryRun: false });
 */

import { collection, query, getDocs, writeBatch, doc } from "firebase/firestore";
import { nanoid } from "nanoid";

/**
 * Convert old referenceImagePath/Crop to new attachments format
 */
export function convertLegacyImageToAttachment(shot, userId = null) {
  if (!shot.referenceImagePath) {
    return null;
  }

  const now = Date.now();
  const attachment = {
    id: nanoid(),
    path: shot.referenceImagePath,
    isPrimary: true,
    uploadedAt: shot.createdAt || now,
    uploadedBy: shot.createdBy || userId || null,
    order: 0,
    cropData: null,
  };

  // Convert old crop position to new crop data format if exists
  if (shot.referenceImageCrop && shot.referenceImageCrop.x != null && shot.referenceImageCrop.y != null) {
    attachment.cropData = {
      x: shot.referenceImageCrop.x,
      y: shot.referenceImageCrop.y,
      width: 100, // Full width (no crop)
      height: 100, // Full height (no crop)
      zoom: 1,
      rotation: 0,
      aspect: null, // Free-form
    };
  }

  return attachment;
}

/**
 * Migrate all shots for a client from referenceImagePath to attachments
 *
 * @param {Object} options
 * @param {Firestore} options.db - Firestore instance
 * @param {string} options.clientId - Client ID
 * @param {boolean} options.dryRun - If true, only count affected shots without writing
 * @param {Function} options.onProgress - Optional callback for progress updates
 * @returns {Promise<{total: number, migrated: number, skipped: number, errors: Array}>}
 */
export async function migrateShotsToAttachments({ db, clientId, dryRun = true, onProgress }) {
  if (!db) throw new Error("Firestore instance required");
  if (!clientId) throw new Error("Client ID required");

  console.info(`[Migration] Starting shots migration for client: ${clientId} (dryRun: ${dryRun})`);

  const results = {
    total: 0,
    migrated: 0,
    skipped: 0,
    errors: [],
  };

  try {
    // Fetch all shots for this client
    const shotsRef = collection(db, "clients", clientId, "shots");
    const shotsQuery = query(shotsRef);
    const snapshot = await getDocs(shotsQuery);

    results.total = snapshot.size;
    console.info(`[Migration] Found ${results.total} shots to process`);

    if (results.total === 0) {
      return results;
    }

    const batch = writeBatch(db);
    let batchCount = 0;
    const BATCH_SIZE = 500; // Firestore batch limit

    for (const shotDoc of snapshot.docs) {
      const shot = { id: shotDoc.id, ...shotDoc.data() };

      try {
        // Skip if already has attachments
        if (shot.attachments && shot.attachments.length > 0) {
          results.skipped++;
          if (onProgress) onProgress({ ...results, current: results.migrated + results.skipped });
          continue;
        }

        // Skip if no legacy image
        if (!shot.referenceImagePath) {
          results.skipped++;
          if (onProgress) onProgress({ ...results, current: results.migrated + results.skipped });
          continue;
        }

        // Convert legacy image to attachment
        const attachment = convertLegacyImageToAttachment(shot);
        if (!attachment) {
          results.skipped++;
          if (onProgress) onProgress({ ...results, current: results.migrated + results.skipped });
          continue;
        }

        if (!dryRun) {
          // Update shot with attachments array
          const shotRef = doc(db, "clients", clientId, "shots", shotDoc.id);
          batch.update(shotRef, {
            attachments: [attachment],
            updatedAt: Date.now(),
          });

          batchCount++;

          // Commit batch if we hit the limit
          if (batchCount >= BATCH_SIZE) {
            await batch.commit();
            console.info(`[Migration] Committed batch of ${batchCount} shots`);
            batchCount = 0;
          }
        }

        results.migrated++;
        if (onProgress) onProgress({ ...results, current: results.migrated + results.skipped });

      } catch (error) {
        console.error(`[Migration] Error processing shot ${shot.id}:`, error);
        results.errors.push({
          shotId: shot.id,
          shotName: shot.name || "Unknown",
          error: error.message,
        });
      }
    }

    // Commit any remaining shots in the batch
    if (!dryRun && batchCount > 0) {
      await batch.commit();
      console.info(`[Migration] Committed final batch of ${batchCount} shots`);
    }

    console.info(`[Migration] Complete. Total: ${results.total}, Migrated: ${results.migrated}, Skipped: ${results.skipped}, Errors: ${results.errors.length}`);

    return results;

  } catch (error) {
    console.error("[Migration] Fatal error:", error);
    throw error;
  }
}

/**
 * Migrate a single shot (useful for on-demand migration)
 */
export async function migrateSingleShot({ db, clientId, shotId, userId }) {
  if (!db || !clientId || !shotId) {
    throw new Error("Missing required parameters");
  }

  const shotRef = doc(db, "clients", clientId, "shots", shotId);
  const shotDoc = await getDocs(shotRef);

  if (!shotDoc.exists()) {
    throw new Error(`Shot ${shotId} not found`);
  }

  const shot = { id: shotDoc.id, ...shotDoc.data() };

  // Skip if already migrated
  if (shot.attachments && shot.attachments.length > 0) {
    return { migrated: false, reason: "Already has attachments" };
  }

  // Skip if no legacy image
  if (!shot.referenceImagePath) {
    return { migrated: false, reason: "No legacy image to migrate" };
  }

  const attachment = convertLegacyImageToAttachment(shot, userId);
  if (!attachment) {
    return { migrated: false, reason: "Failed to convert legacy image" };
  }

  await shotRef.update({
    attachments: [attachment],
    updatedAt: Date.now(),
  });

  return { migrated: true, attachment };
}
