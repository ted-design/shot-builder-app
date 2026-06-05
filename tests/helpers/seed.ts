import { initializeApp, getApps, getApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import {
  SEED_CLIENT_ID,
  SEED_PROJECT_ID,
  SEED_PROJECT_NAME,
  SEED_SHOTS,
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
  name?: string;
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
    title: data.title ?? data.name ?? 'Untitled Shot',
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

  const batch = db.batch();
  for (const doc of shotsSnap.docs) batch.delete(doc.ref);
  batch.delete(db.collection(`clients/${CLIENT_ID}/projects`).doc(SEED_PROJECT_ID));
  await batch.commit();
}

/**
 * Seed the deterministic fixture the shots-crud spec reads: one team-visible
 * project + the app-shaped shots declared in seedConstants.ts. Cleared first so
 * the dataset is identical on every run (the emulator persists across a run).
 */
export async function seedShotsCrudScenario(): Promise<void> {
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
}
