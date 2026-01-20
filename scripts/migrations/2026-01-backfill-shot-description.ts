/**
 * Migration: Backfill shot.description from shot.type
 *
 * PURPOSE:
 * Legacy shots stored the "Description" field value in shot.type.
 * This migration copies shot.type to shot.description for shots where
 * description is missing/empty but type has a value.
 *
 * BEHAVIOR:
 * - Scans all shot documents in clients/{clientId}/shots
 * - For each shot:
 *   - If description is empty/missing AND type is non-empty string:
 *     -> Sets description = type (original value, not trimmed)
 *   - Otherwise skips
 * - Idempotent: safe to re-run; already-migrated shots will be skipped
 *
 * USAGE:
 *   # Dry run (default - no writes, requires explicit clientId):
 *   npx tsx scripts/migrations/2026-01-backfill-shot-description.ts --clientId=my-client
 *
 *   # Actually perform writes:
 *   npx tsx scripts/migrations/2026-01-backfill-shot-description.ts --clientId=my-client --write
 *
 * ARGUMENTS:
 *   --clientId=<id>  (REQUIRED) Client/tenant ID to target
 *   --write          Actually perform writes (default: dry-run)
 *
 * ENVIRONMENT VARIABLES (optional):
 *   MIGRATION_BATCH_SIZE - Batch size for writes (default: 200)
 */

import { getApp, getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { FieldValue, Firestore, getFirestore } from "firebase-admin/firestore";

// Parse CLI arguments
function parseArgs(): { clientId: string | null; write: boolean } {
  const args = process.argv.slice(2);
  let clientId: string | null = null;
  let write = false;

  for (const arg of args) {
    if (arg.startsWith("--clientId=")) {
      clientId = arg.slice("--clientId=".length).trim();
    } else if (arg === "--write") {
      write = true;
    }
  }

  return { clientId, write };
}

function printUsageAndExit(): never {
  console.error("");
  console.error("ERROR: --clientId is required");
  console.error("");
  console.error("Usage:");
  console.error("  npx tsx scripts/migrations/2026-01-backfill-shot-description.ts --clientId=<id> [--write]");
  console.error("");
  console.error("Arguments:");
  console.error("  --clientId=<id>  (REQUIRED) Client/tenant ID to target");
  console.error("  --write          Actually perform writes (default: dry-run)");
  console.error("");
  console.error("Examples:");
  console.error("  # Dry run for 'unbound-merino' client:");
  console.error("  npx tsx scripts/migrations/2026-01-backfill-shot-description.ts --clientId=unbound-merino");
  console.error("");
  console.error("  # Write mode for 'unbound-merino' client:");
  console.error("  npx tsx scripts/migrations/2026-01-backfill-shot-description.ts --clientId=unbound-merino --write");
  console.error("");
  process.exit(1);
}

// Configuration
const BATCH_SIZE = Number.parseInt(process.env.MIGRATION_BATCH_SIZE || "200", 10);
const { clientId: CLIENT_ID, write: WRITE_FLAG } = parseArgs();

// Validate required arguments
if (!CLIENT_ID) {
  printUsageAndExit();
}

const DRY_RUN = !WRITE_FLAG;

function ensureApp() {
  if (getApps().length) return getApp();
  return initializeApp({ credential: applicationDefault() });
}

interface MigrationStats {
  scanned: number;
  updated: number;
  skippedHasDescription: number;
  skippedNoType: number;
  skippedNonString: number;
  errors: number;
}

function printHeader(clientId: string, dryRun: boolean): void {
  console.info("");
  console.info("=".repeat(60));
  console.info("MIGRATION: Backfill shot.description from shot.type");
  console.info("=".repeat(60));
  console.info("Client ID:               %s", clientId);
  console.info("Firestore path:          clients/%s/shots", clientId);
  console.info("Mode:                    %s", dryRun ? "DRY RUN (no writes)" : "WRITE MODE");
  console.info("Batch size:              %d", BATCH_SIZE);
  console.info("=".repeat(60));
  console.info("");
}

async function backfillDescriptionFromType(db: Firestore, clientId: string): Promise<MigrationStats> {
  const stats: MigrationStats = {
    scanned: 0,
    updated: 0,
    skippedHasDescription: 0,
    skippedNoType: 0,
    skippedNonString: 0,
    errors: 0,
  };

  const shotsRef = db.collection(`clients/${clientId}/shots`);
  const snapshot = await shotsRef.get();

  console.info("[migration] Loaded %d shots", snapshot.size);
  console.info("");

  let batch = db.batch();
  let batchSize = 0;

  for (const doc of snapshot.docs) {
    stats.scanned += 1;
    const data = doc.data();

    // Extract and validate type field
    const typeVal = typeof data.type === "string" ? data.type.trim() : "";
    const descVal = typeof data.description === "string" ? data.description.trim() : "";

    // Skip if type is not a string
    if (typeof data.type !== "string" && data.type !== undefined && data.type !== null) {
      stats.skippedNonString += 1;
      continue;
    }

    // Skip if description already has a value
    if (descVal !== "") {
      stats.skippedHasDescription += 1;
      continue;
    }

    // Skip if type is empty/missing
    if (typeVal === "") {
      stats.skippedNoType += 1;
      continue;
    }

    // This shot needs migration: copy type to description
    stats.updated += 1;

    console.info(
      "[migration] %s shot %s: description = %s",
      DRY_RUN ? "Would update" : "Updating",
      doc.id,
      JSON.stringify(data.type.substring(0, 50) + (data.type.length > 50 ? "..." : ""))
    );

    if (DRY_RUN) {
      continue;
    }

    // Use original type value (not trimmed) for the migration.
    // NOTE: We intentionally only update `description`, not `type`. This is because:
    // 1. `type` still has the original value and old code continues to work
    // 2. `description` now has the same value as `type` (the canonical field)
    // 3. New code reads from `description` with fallback to `type`
    // 4. Going forward, writes update both fields to keep them in sync
    batch.update(doc.ref, {
      description: data.type,
      updatedAt: FieldValue.serverTimestamp(),
    });
    batchSize += 1;

    // Commit batch when it reaches the limit
    if (batchSize >= BATCH_SIZE) {
      try {
        await batch.commit();
        console.info("[migration] Committed batch of %d updates", batchSize);
      } catch (error) {
        console.error("[migration] Batch commit failed:", error);
        // Firestore batches are atomic - if commit fails, ALL operations in the batch are rolled back.
        // Therefore, counting all batchSize operations as errors is correct.
        stats.errors += batchSize;
      }
      batch = db.batch();
      batchSize = 0;
    }
  }

  // Commit remaining updates
  if (!DRY_RUN && batchSize > 0) {
    try {
      await batch.commit();
      console.info("[migration] Committed final batch of %d updates", batchSize);
    } catch (error) {
      console.error("[migration] Final batch commit failed:", error);
      // Firestore batches are atomic - if commit fails, ALL operations are rolled back
      stats.errors += batchSize;
    }
  }

  return stats;
}

function printSummary(stats: MigrationStats, dryRun: boolean, clientId: string): void {
  console.info("");
  console.info("=".repeat(60));
  console.info("MIGRATION SUMMARY");
  console.info("=".repeat(60));
  console.info("Client ID:               %s", clientId);
  console.info("Mode:                    %s", dryRun ? "DRY RUN" : "WRITE");
  console.info("Scanned:                 %d", stats.scanned);
  console.info("Updated:                 %d", stats.updated);
  console.info("Skipped (has desc):      %d", stats.skippedHasDescription);
  console.info("Skipped (no type):       %d", stats.skippedNoType);
  console.info("Skipped (non-string):    %d", stats.skippedNonString);
  console.info("Errors:                  %d", stats.errors);
  console.info("=".repeat(60));

  if (dryRun && stats.updated > 0) {
    console.info("");
    console.info("To apply these changes, run with --write flag:");
    console.info("  npx tsx scripts/migrations/2026-01-backfill-shot-description.ts --clientId=%s --write", clientId);
  }
}

(async () => {
  try {
    // Print header first (CLIENT_ID is validated above)
    printHeader(CLIENT_ID!, DRY_RUN);

    const app = ensureApp();
    const db = getFirestore(app);
    db.settings({ ignoreUndefinedProperties: true });

    const stats = await backfillDescriptionFromType(db, CLIENT_ID!);
    printSummary(stats, DRY_RUN, CLIENT_ID!);

    if (stats.errors > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("[migration] Fatal error:", error);
    process.exitCode = 1;
  }
})();
