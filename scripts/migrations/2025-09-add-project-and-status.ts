import { getApp, getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { FieldValue, Firestore, getFirestore } from "firebase-admin/firestore";

const SHOT_STATUS_VALUES = new Set(["todo", "in_progress", "complete", "on_hold"]);
const DEFAULT_PROJECT_ID = "default-project";

const BATCH_SIZE = Number.parseInt(process.env.MIGRATION_BATCH_SIZE || "200", 10);
const CLIENT_ID = process.env.MIGRATION_CLIENT_ID || process.env.CLIENT_ID || "unbound-merino";
const FORCED_PROJECT_ID = process.env.MIGRATION_PROJECT_ID || process.env.PROJECT_ID || "";
const DRY_RUN = process.env.DRY_RUN === "1" || process.argv.includes("--dry-run");

function ensureApp() {
  if (getApps().length) return getApp();
  return initializeApp({ credential: applicationDefault() });
}

function normaliseStatus(value: unknown): string {
  return typeof value === "string" && SHOT_STATUS_VALUES.has(value) ? value : "todo";
}

async function resolveDefaultProjectId(db: Firestore, clientId: string): Promise<string> {
  if (FORCED_PROJECT_ID) return FORCED_PROJECT_ID;
  const snapshot = await db
    .collection(`clients/${clientId}/projects`)
    .orderBy("createdAt", "asc")
    .limit(1)
    .get();
  if (!snapshot.empty) {
    const doc = snapshot.docs[0];
    return doc.id;
  }
  return DEFAULT_PROJECT_ID;
}

async function backfillShots(db: Firestore, clientId: string) {
  const targetProjectId = await resolveDefaultProjectId(db, clientId);
  console.info(
    "[migration] Using project %s for backfill (client=%s)",
    targetProjectId,
    clientId
  );

  const shotsRef = db.collection(`clients/${clientId}/shots`);
  const snapshot = await shotsRef.get();
  console.info("[migration] Loaded %d shots", snapshot.size);

  let processed = 0;
  let mutated = 0;
  let batch = db.batch();
  let batchSize = 0;

  for (const doc of snapshot.docs) {
    processed += 1;
    const data = doc.data();
    const updates: Record<string, unknown> = {};

    if (!data.projectId) {
      updates.projectId = targetProjectId;
    }

    const resolvedStatus = normaliseStatus(data.status);
    if (resolvedStatus !== data.status) {
      updates.status = resolvedStatus;
    }

    if (typeof data.notes !== "string" && typeof data.description === "string") {
      updates.notes = data.description;
    }

    if (Object.keys(updates).length === 0) {
      continue;
    }

    updates.updatedAt = FieldValue.serverTimestamp();

    mutated += 1;
    console.info(
      "[migration] Updating shot %s (projectId=%s, status=%s)",
      doc.id,
      updates.projectId ?? data.projectId ?? targetProjectId,
      updates.status ?? data.status ?? "todo"
    );

    if (DRY_RUN) {
      continue;
    }

    batch.update(doc.ref, updates);
    batchSize += 1;

    if (batchSize >= BATCH_SIZE) {
      await batch.commit();
      console.info("[migration] Committed batch of %d updates", batchSize);
      batch = db.batch();
      batchSize = 0;
    }
  }

  if (!DRY_RUN && batchSize > 0) {
    await batch.commit();
    console.info("[migration] Committed final batch of %d updates", batchSize);
  }

  console.info(
    "[migration] Completed. processed=%d mutated=%d dryRun=%s",
    processed,
    mutated,
    DRY_RUN ? "yes" : "no"
  );
}

(async () => {
  try {
    const app = ensureApp();
    const db = getFirestore(app);
    db.settings({ ignoreUndefinedProperties: true });
    await backfillShots(db, CLIENT_ID);
  } catch (error) {
    console.error("[migration] Failed", error);
    process.exitCode = 1;
  }
})();
