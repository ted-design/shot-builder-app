import { applicationDefault, getApp, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, Firestore, getFirestore } from "firebase-admin/firestore";
import { buildCallSheetLayoutV2 } from "../../src/lib/callsheet/layoutV2";

const BATCH_SIZE = Number.parseInt(process.env.MIGRATION_BATCH_SIZE || "200", 10);
const CLIENT_ID = process.env.MIGRATION_CLIENT_ID || process.env.CLIENT_ID || "unbound-merino";
const FORCED_PROJECT_ID = process.env.MIGRATION_PROJECT_ID || process.env.PROJECT_ID || "";
const DRY_RUN = process.env.DRY_RUN === "1" || process.argv.includes("--dry-run");
const FORCE = process.env.FORCE === "1" || process.argv.includes("--force");

function ensureApp() {
  if (getApps().length) return getApp();
  return initializeApp({ credential: applicationDefault() });
}

async function resolveProjectIds(db: Firestore, clientId: string): Promise<string[]> {
  if (FORCED_PROJECT_ID) return [FORCED_PROJECT_ID];
  const snapshot = await db.collection(`clients/${clientId}/projects`).get();
  return snapshot.docs.map((doc) => doc.id);
}

function hasV2Layout(docData: FirebaseFirestore.DocumentData | undefined): boolean {
  const schemaVersion = docData?.schemaVersion ?? docData?.layout?.schemaVersion;
  return schemaVersion === 2;
}

async function migrateProjectSchedules(db: Firestore, clientId: string, projectId: string) {
  const schedulesRef = db.collection(`clients/${clientId}/projects/${projectId}/schedules`);
  const schedulesSnap = await schedulesRef.get();
  console.info("[migration] project=%s schedules=%d", projectId, schedulesSnap.size);

  let processed = 0;
  let mutated = 0;
  let batch = db.batch();
  let batchSize = 0;

  for (const scheduleDoc of schedulesSnap.docs) {
    processed += 1;
    const scheduleId = scheduleDoc.id;
    const scheduleData = scheduleDoc.data() || {};
    const scheduleBasePath = `clients/${clientId}/projects/${projectId}/schedules/${scheduleId}`;
    const layoutRef = db.doc(`${scheduleBasePath}/callSheet/layout`);
    const legacyConfigRef = db.doc(`${scheduleBasePath}/callSheet/config`);

    const [existingLayoutSnap, legacyConfigSnap] = await Promise.all([
      layoutRef.get(),
      legacyConfigRef.get().catch(() => null),
    ]);

    if (!FORCE && existingLayoutSnap.exists && hasV2Layout(existingLayoutSnap.data())) {
      continue;
    }

    const legacyCallSheetConfig = legacyConfigSnap?.exists ? legacyConfigSnap.data() : null;
    const layout = buildCallSheetLayoutV2({
      schedule: scheduleData,
      legacyCallSheetConfig,
    });

    mutated += 1;
    console.info(
      "[migration] %s schedule=%s -> callsheet layout v2 (dryRun=%s, force=%s)",
      existingLayoutSnap.exists ? "updating" : "creating",
      scheduleId,
      DRY_RUN ? "yes" : "no",
      FORCE ? "yes" : "no"
    );

    if (DRY_RUN) {
      continue;
    }

    const now = FieldValue.serverTimestamp();
    const payload: Record<string, unknown> = {
      projectId,
      scheduleId,
      schemaVersion: layout.schemaVersion,
      layout,
      updatedAt: now,
    };
    if (!existingLayoutSnap.exists) {
      payload.createdAt = now;
      payload.createdBy = scheduleData.createdBy ?? null;
    }

    batch.set(layoutRef, payload, { merge: true });
    batchSize += 1;

    if (batchSize >= BATCH_SIZE) {
      await batch.commit();
      console.info("[migration] Committed batch of %d writes", batchSize);
      batch = db.batch();
      batchSize = 0;
    }
  }

  if (!DRY_RUN && batchSize > 0) {
    await batch.commit();
    console.info("[migration] Committed final batch of %d writes", batchSize);
  }

  console.info(
    "[migration] project=%s done processed=%d mutated=%d dryRun=%s",
    projectId,
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

    const projectIds = await resolveProjectIds(db, CLIENT_ID);
    console.info("[migration] client=%s projects=%d", CLIENT_ID, projectIds.length);

    for (const projectId of projectIds) {
      await migrateProjectSchedules(db, CLIENT_ID, projectId);
    }
  } catch (error) {
    console.error("[migration] Failed", error);
    process.exitCode = 1;
  }
})();

