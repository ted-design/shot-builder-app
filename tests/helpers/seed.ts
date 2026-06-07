import { initializeApp, getApps, getApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import {
  SEED_CLIENT_ID,
  SEED_PROJECT_ID,
  SEED_PROJECT_NAME,
  SEED_SHOTS,
  SEED_PULL,
  SEED_PULL_ITEM,
} from './seedConstants';

/**
 * Test data seeding utilities for Firebase emulator.
 *
 * These functions help create test data in Firestore for E2E tests.
 * All data is scoped to the 'test-client' clientId.
 */

const CLIENT_ID = SEED_CLIENT_ID;

let adminApp: App | null = null;
let firestoreDb: Firestore | null = null;

/**
 * Initialize Firebase Admin for emulator if not already initialized
 */
function getAdminApp(): App {
  if (adminApp) return adminApp;

  // Set emulator environment variables (only if not already set by the caller,
  // e.g. global.setup.ts, which initializes the same admin app first).
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099';

  // Reuse the already-initialized default app when present (global.setup.ts
  // initializes firebase-admin first). Initializing a second default app throws
  // "default app already exists". The projectId MUST be 'demo-test' — the same
  // emulator partition the app reads (VITE_FIREBASE_PROJECT_ID=demo-test) and
  // that global.setup.ts uses. A mismatched projectId (the previous
  // 'demo-test-project') writes to an isolated partition the app never reads.
  adminApp = getApps().length ? getApp() : initializeApp({ projectId: 'demo-test' });

  return adminApp;
}

/**
 * Get Firestore instance
 */
function getDb(): Firestore {
  if (firestoreDb) return firestoreDb;

  getAdminApp();
  firestoreDb = getFirestore();

  return firestoreDb;
}

/**
 * Create a test project
 */
export async function createTestProject(data: {
  name: string;
  /** Optional deterministic doc id so specs can deep-link to it. */
  id?: string;
  shootDates?: Date[];
  /**
   * Firestore rules let a producer read a project only when visibility is
   * 'team' (or absent). Default to 'team' so the producer fixture can see it.
   */
  visibility?: 'team' | 'private';
}): Promise<string> {
  const db = getDb();
  const col = db.collection(`clients/${CLIENT_ID}/projects`);
  const projectRef = data.id ? col.doc(data.id) : col.doc();

  await projectRef.set({
    name: data.name,
    clientId: CLIENT_ID,
    status: 'active',
    visibility: data.visibility || 'team',
    // App reads `shootDates` (plural, normalized) — the old singular `shootDate`
    // was silently ignored by mapProject.
    shootDates: data.shootDates ?? [],
    notes: null,
    createdBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return projectRef.id;
}

/**
 * Create a test shot
 */
export async function createTestShot(projectId: string, data: {
  title?: string;
  /** Optional deterministic doc id so specs can deep-link to it. */
  id?: string;
  type?: string;
  status?: string;
  description?: string | null;
  products?: string[];
  talent?: string[];
  location?: string | null;
  date?: Date | null;
  sortOrder?: number;
  shotNumber?: string | null;
}): Promise<string> {
  const db = getDb();
  const col = db.collection(`clients/${CLIENT_ID}/shots`);
  const shotRef = data.id ? col.doc(data.id) : col.doc();

  // Mirror CreateShotDialog's write contract. The shot-list query filters
  // `where('deleted','==',false)` and orders by `date` — a doc MISSING either
  // field is excluded from the list, so both are always set here.
  await shotRef.set({
    title: data.title ?? 'Untitled Shot',
    description: data.description ?? null,
    projectId,
    clientId: CLIENT_ID,
    status: data.status || 'todo',
    type: data.type || 'On-Figure',
    deleted: false,
    date: data.date ?? null,
    sortOrder: data.sortOrder ?? Date.now(),
    shotNumber: data.shotNumber ?? null,
    products: data.products || [],
    productIds: data.products || [],
    talent: data.talent || [],
    talentIds: data.talent || [],
    locationId: data.location ?? null,
    notes: null,
    referenceLinks: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: '',
  });

  return shotRef.id;
}

/**
 * Create a test product family
 */
export async function createTestProductFamily(data: {
  styleName: string;
  styleNumber: string;
  category?: string;
  skus?: Array<{ color: string; size: string; sku: string }>;
}): Promise<string> {
  const db = getDb();
  const familyRef = db.collection(`clients/${CLIENT_ID}/productFamilies`).doc();

  await familyRef.set({
    styleName: data.styleName,
    styleNumber: data.styleNumber,
    category: data.category || 'Apparel',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Create SKUs if provided
  if (data.skus && data.skus.length > 0) {
    const batch = db.batch();

    for (const skuData of data.skus) {
      const skuRef = familyRef.collection('skus').doc();
      batch.set(skuRef, {
        color: skuData.color,
        size: skuData.size,
        sku: skuData.sku,
        createdAt: new Date(),
      });
    }

    await batch.commit();
  }

  return familyRef.id;
}

/**
 * Create a test talent profile
 */
export async function createTestTalent(data: {
  name: string;
  email?: string;
  phone?: string;
  sizes?: Record<string, string>;
}): Promise<string> {
  const db = getDb();
  const talentRef = db.collection(`clients/${CLIENT_ID}/talent`).doc();

  await talentRef.set({
    name: data.name,
    email: data.email || '',
    phone: data.phone || '',
    sizes: data.sizes || {},
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return talentRef.id;
}

/**
 * Create a test location
 */
export async function createTestLocation(data: {
  name: string;
  address?: string;
  notes?: string;
}): Promise<string> {
  const db = getDb();
  const locationRef = db.collection(`clients/${CLIENT_ID}/locations`).doc();

  await locationRef.set({
    name: data.name,
    address: data.address || '',
    notes: data.notes || '',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return locationRef.id;
}

/**
 * Create a test pull sheet
 */
export async function createTestPull(projectId: string, data: {
  name: string;
  items?: Array<{
    productFamilyId: string;
    styleNumber: string;
    styleName: string;
    quantity: number;
  }>;
}): Promise<string> {
  const db = getDb();
  const pullRef = db.collection(`clients/${CLIENT_ID}/projects/${projectId}/pulls`).doc();

  await pullRef.set({
    name: data.name,
    items: data.items || [],
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return pullRef.id;
}

/**
 * Clear all test data for a clean slate
 */
export async function clearTestData(): Promise<void> {
  const db = getDb();

  // Get all collections under test-client
  const collections = [
    'projects',
    'shots',
    'productFamilies',
    'talent',
    'locations',
  ];

  const batch = db.batch();

  for (const collectionName of collections) {
    const snapshot = await db.collection(`clients/${CLIENT_ID}/${collectionName}`).get();

    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);

      // Also delete subcollections if needed
      if (collectionName === 'projects') {
        const pullsSnapshot = await doc.ref.collection('pulls').get();
        for (const pullDoc of pullsSnapshot.docs) {
          batch.delete(pullDoc.ref);
        }
      }

      if (collectionName === 'productFamilies') {
        const skusSnapshot = await doc.ref.collection('skus').get();
        for (const skuDoc of skusSnapshot.docs) {
          batch.delete(skuDoc.ref);
        }
      }
    }
  }

  await batch.commit();
}

/**
 * Seed a complete test scenario with projects, shots, products, etc.
 */
export async function seedCompleteScenario(): Promise<{
  projectId: string;
  shotIds: string[];
  productIds: string[];
  talentIds: string[];
  locationIds: string[];
}> {
  // Create project
  const projectId = await createTestProject({
    name: 'Fall 2024 Campaign',
    shootDates: [new Date('2024-11-15')],
  });

  // Create locations
  const studioId = await createTestLocation({
    name: 'Main Studio',
    address: '123 Studio St, Brooklyn, NY',
  });

  const outdoorId = await createTestLocation({
    name: 'Central Park',
    address: 'Central Park, Manhattan, NY',
  });

  // Create talent
  const model1Id = await createTestTalent({
    name: 'Sarah Johnson',
    email: 'sarah@models.com',
    sizes: { top: 'S', bottom: '27', shoes: '8' },
  });

  const model2Id = await createTestTalent({
    name: 'Mike Chen',
    email: 'mike@models.com',
    sizes: { top: 'M', bottom: '32', shoes: '10' },
  });

  // Create product families
  const sweater1Id = await createTestProductFamily({
    styleName: 'Cable Knit Sweater',
    styleNumber: 'SW-001',
    category: 'Knitwear',
    skus: [
      { color: 'Cream', size: 'S', sku: 'SW-001-CRM-S' },
      { color: 'Cream', size: 'M', sku: 'SW-001-CRM-M' },
      { color: 'Navy', size: 'S', sku: 'SW-001-NVY-S' },
    ],
  });

  const jeans1Id = await createTestProductFamily({
    styleName: 'Slim Fit Jeans',
    styleNumber: 'JN-002',
    category: 'Bottoms',
    skus: [
      { color: 'Dark Wash', size: '27', sku: 'JN-002-DW-27' },
      { color: 'Light Wash', size: '32', sku: 'JN-002-LW-32' },
    ],
  });

  // Create shots
  const shot1Id = await createTestShot(projectId, {
    title: 'Hero Sweater Look',
    type: 'On-Figure',
    status: 'planned',
    products: [sweater1Id],
    talent: [model1Id],
    location: studioId,
  });

  const shot2Id = await createTestShot(projectId, {
    title: 'Casual Jeans Outfit',
    type: 'On-Figure',
    status: 'planned',
    products: [jeans1Id, sweater1Id],
    talent: [model2Id],
    location: outdoorId,
  });

  const shot3Id = await createTestShot(projectId, {
    title: 'Sweater Detail Shot',
    type: 'Detail',
    status: 'planned',
    products: [sweater1Id],
    location: studioId,
  });

  return {
    projectId,
    shotIds: [shot1Id, shot2Id, shot3Id],
    productIds: [sweater1Id, jeans1Id],
    talentIds: [model1Id, model2Id],
    locationIds: [studioId, outdoorId],
  };
}

/**
 * Clear the shots-crud E2E fixture: every shot under the seed project (including
 * ones created by the specs themselves) plus the project doc. Safe to call
 * repeatedly; run before re-seeding so a persisted emulator does not accumulate
 * duplicate shots across runs.
 */
export async function clearShotsCrudData(): Promise<void> {
  const db = getDb();

  const shotsSnap = await db
    .collection(`clients/${CLIENT_ID}/shots`)
    .where('projectId', '==', SEED_PROJECT_ID)
    .get();

  const refs = shotsSnap.docs.map((doc) => doc.ref);
  refs.push(db.collection(`clients/${CLIENT_ID}/projects`).doc(SEED_PROJECT_ID));

  // Delete in chunks — a Firestore batch is capped at 500 ops. A persisted local
  // emulator can accumulate test-created shots across runs (CI is fresh each time).
  const CHUNK = 250;
  for (let i = 0; i < refs.length; i += CHUNK) {
    const batch = db.batch();
    for (const ref of refs.slice(i, i + CHUNK)) batch.delete(ref);
    await batch.commit();
  }
}

/**
 * Seed the deterministic fixture the shots-crud spec reads: one team-visible
 * project + the app-shaped shots declared in seedConstants.ts. Cleared first so
 * the dataset is identical on every run (the emulator persists across a run).
 *
 * VIEWER ACCESS: pass `viewerUid` to grant the viewer test user project
 * membership (a doc at `.../projects/<id>/members/<uid>` with role 'viewer').
 * The shot detail page (ShotDetailPage → useShotDetailBundle) subscribes to the
 * project's `lanes` subcollection, whose firestore.rules read gate is
 * `hasProjectRole(...,['producer','crew','warehouse','viewer'])` OR
 * producerCanAccessProject (producer-global only). A viewer's GLOBAL role
 * satisfies neither, so without this member doc the lanes read is denied,
 * useShotDetailBundle folds that into a fatal page error, and the detail page
 * never renders for a viewer. Producer needs no member doc — its global role
 * satisfies producerCanAccessProject on a team project. Granting membership does
 * NOT make the viewer an editor: the UI's canEdit/canManageShots uses the
 * user's GLOBAL role (rbac.ts), so the viewer still renders the read-only path.
 */
export async function seedShotsCrudScenario(
  opts: { viewerUid?: string } = {},
): Promise<void> {
  await clearShotsCrudData();

  await createTestProject({
    id: SEED_PROJECT_ID,
    name: SEED_PROJECT_NAME,
    visibility: 'team',
  });

  let order = 1;
  for (const shot of SEED_SHOTS) {
    await createTestShot(SEED_PROJECT_ID, {
      id: shot.id,
      title: shot.title,
      status: 'todo',
      sortOrder: order,
      shotNumber: String(order),
    });
    order += 1;
  }

  // Grant the viewer user project membership so firestore.rules permits it to
  // read the project's lanes (and project doc) — see the VIEWER ACCESS note
  // above. Keyed by uid because hasProjectRole resolves members/<request.auth.uid>.
  if (opts.viewerUid) {
    await getDb()
      .collection(`clients/${CLIENT_ID}/projects/${SEED_PROJECT_ID}/members`)
      .doc(opts.viewerUid)
      .set({
        role: 'viewer',
        clientId: CLIENT_ID,
        projectId: SEED_PROJECT_ID,
        addedAt: new Date(),
      });
  }
}

/**
 * Clear every pull under the seed project (including ones the pulls-crud spec
 * creates itself) at `clients/test-client/projects/e2e-seed-project/pulls`.
 * Mirrors clearShotsCrudData's chunked delete. Does NOT touch the project doc
 * or its shots — only the pulls subcollection.
 */
export async function clearPullsCrudData(): Promise<void> {
  const db = getDb();

  const pullsSnap = await db
    .collection(`clients/${CLIENT_ID}/projects/${SEED_PROJECT_ID}/pulls`)
    .get();

  const refs = pullsSnap.docs.map((doc) => doc.ref);

  // Delete in chunks — a Firestore batch is capped at 500 ops. A persisted local
  // emulator can accumulate test-created pulls across runs (CI is fresh each time).
  const CHUNK = 250;
  for (let i = 0; i < refs.length; i += CHUNK) {
    const batch = db.batch();
    for (const ref of refs.slice(i, i + CHUNK)) batch.delete(ref);
    await batch.commit();
  }
}

/**
 * Seed the deterministic fixture the pulls-crud spec reads: ONE app-shaped pull
 * with ONE item, at `clients/test-client/projects/e2e-seed-project/pulls/<id>`.
 * Cleared first so the dataset is identical on every run.
 *
 * ORDERING DEPENDENCY: assumes the seed PROJECT (e2e-seed-project) already
 * exists — it is created by seedShotsCrudScenario(). global.setup.ts MUST call
 * seedShotsCrudScenario() BEFORE seedPullsCrudScenario(). The pull doc shape
 * mirrors createPullFromShots.ts (the canonical app writer) so usePulls/mapPull
 * render it: Date values coerce to Firestore Timestamps; familyId + size are
 * non-empty (mapItem/mapSize drop items/sizes missing them); 'colourName' uses
 * British spelling.
 *
 * WAREHOUSE ACCESS: pass `warehouseUid` to grant the warehouse test user project
 * membership (a doc at `.../projects/<id>/members/<uid>` with role 'warehouse').
 * firestore.rules gates pull read on hasProjectRole(...,['producer','crew',
 * 'warehouse','viewer']) and pull write on hasProjectRole(...,['producer',
 * 'warehouse']); the warehouse user's GLOBAL role satisfies neither isAdmin nor
 * producerCanAccessProject (producer-global only), so without this member doc the
 * warehouse fulfillment test cannot even read the seeded pull. Producer needs no
 * member doc — its global role satisfies producerCanAccessProject on a team project.
 */
export async function seedPullsCrudScenario(
  opts: { warehouseUid?: string } = {},
): Promise<void> {
  const db = getDb();

  // Fail loud, not silent: the ordering dependency above is only a comment. If
  // global.setup ever reorders or skips seedShotsCrudScenario, the pull would be
  // written into a nonexistent project (the admin SDK doesn't enforce parent
  // existence) and the list test would see zero cards with no clue why.
  const projectSnap = await db
    .doc(`clients/${CLIENT_ID}/projects/${SEED_PROJECT_ID}`)
    .get();
  if (!projectSnap.exists) {
    throw new Error(
      `seedPullsCrudScenario: seed project ${SEED_PROJECT_ID} not found — run seedShotsCrudScenario() first`,
    );
  }

  await clearPullsCrudData();

  const pullRef = db
    .collection(`clients/${CLIENT_ID}/projects/${SEED_PROJECT_ID}/pulls`)
    .doc(SEED_PULL.id);

  const now = new Date();

  await pullRef.set({
    name: SEED_PULL.name,
    title: null,
    projectId: SEED_PROJECT_ID,
    clientId: CLIENT_ID,
    shotIds: [],
    items: [
      {
        id: 'e2e-seed-pull-item',
        familyId: SEED_PULL_ITEM.familyId,
        familyName: SEED_PULL_ITEM.familyName,
        colourId: null,
        colourName: SEED_PULL_ITEM.colourName,
        sizes: [
          {
            size: SEED_PULL_ITEM.size,
            quantity: SEED_PULL_ITEM.quantity,
            fulfilled: 0,
            status: 'pending',
          },
        ],
        fulfillmentStatus: 'pending',
        notes: null,
      },
    ],
    status: 'draft',
    shareEnabled: false,
    shareAllowResponses: false,
    shareToken: null,
    createdAt: now,
    updatedAt: now,
  });

  // Grant the warehouse user project membership so firestore.rules permits it to
  // read + fulfill the pull (see the WAREHOUSE ACCESS note above). Keyed by uid
  // because hasProjectRole resolves the member doc at members/<request.auth.uid>.
  if (opts.warehouseUid) {
    await db
      .collection(`clients/${CLIENT_ID}/projects/${SEED_PROJECT_ID}/members`)
      .doc(opts.warehouseUid)
      .set({
        role: 'warehouse',
        clientId: CLIENT_ID,
        projectId: SEED_PROJECT_ID,
        addedAt: now,
      });
  }
}
