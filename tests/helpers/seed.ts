import { initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

/**
 * Test data seeding utilities for Firebase emulator.
 *
 * These functions help create test data in Firestore for E2E tests.
 * All data is scoped to the 'test-client' clientId.
 */

const CLIENT_ID = 'test-client';

let adminApp: App | null = null;
let firestoreDb: Firestore | null = null;

/**
 * Initialize Firebase Admin for emulator if not already initialized
 */
function getAdminApp(): App {
  if (adminApp) return adminApp;

  // Set emulator environment variables
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

  adminApp = initializeApp({
    projectId: 'demo-test-project',
  });

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
  shootDate?: Date;
  members?: Record<string, string>; // uid -> role
}): Promise<string> {
  const db = getDb();
  const projectRef = db.collection(`clients/${CLIENT_ID}/projects`).doc();

  await projectRef.set({
    name: data.name,
    shootDate: data.shootDate || new Date(),
    members: data.members || {},
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return projectRef.id;
}

/**
 * Create a test shot
 */
export async function createTestShot(projectId: string, data: {
  title: string;
  type?: string;
  status?: string;
  description?: string;
  products?: string[];
  talent?: string[];
  location?: string;
}): Promise<string> {
  const db = getDb();
  const shotRef = db.collection(`clients/${CLIENT_ID}/shots`).doc();

  await shotRef.set({
    projectId,
    title: data.title,
    type: data.type || 'On-Figure',
    status: data.status || 'planned',
    description: data.description || '',
    productIds: data.products || [],
    talentIds: data.talent || [],
    locationId: data.location || null,
    createdAt: new Date(),
    updatedAt: new Date(),
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
    shootDate: new Date('2024-11-15'),
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
