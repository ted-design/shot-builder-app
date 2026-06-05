import { chromium, type FullConfig } from '@playwright/test';
import { initializeApp, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { seedShotsCrudScenario, seedPullsCrudScenario } from './helpers/seed';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Global setup for Playwright E2E tests with Firebase Auth emulator.
 *
 * This setup:
 * 1. Connects to Firebase Auth emulator
 * 2. Creates test users for each role (admin, producer, wardrobe, crew, viewer)
 * 3. Sets custom claims on each user
 * 4. Authenticates each user and saves storage state
 *
 * Prerequisites:
 * - Firebase emulators must be running: `firebase emulators:start`
 * - Set FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST environment variables
 */

// Test user credentials for different roles
export const TEST_USERS = {
  admin: {
    email: 'admin@test.shotbuilder.app',
    password: 'test-password-admin-123',
    role: 'admin',
    clientId: 'test-client',
  },
  producer: {
    email: 'producer@test.shotbuilder.app',
    password: 'test-password-producer-123',
    role: 'producer',
    clientId: 'test-client',
  },
  wardrobe: {
    email: 'wardrobe@test.shotbuilder.app',
    password: 'test-password-wardrobe-123',
    role: 'wardrobe',
    clientId: 'test-client',
  },
  warehouse: {
    email: 'warehouse@test.shotbuilder.app',
    password: 'test-password-warehouse-123',
    role: 'warehouse',
    clientId: 'test-client',
  },
  crew: {
    email: 'crew@test.shotbuilder.app',
    password: 'test-password-crew-123',
    role: 'crew',
    clientId: 'test-client',
  },
  viewer: {
    email: 'viewer@test.shotbuilder.app',
    password: 'test-password-viewer-123',
    role: 'viewer',
    clientId: 'test-client',
  },
};

let adminApp: App | null = null;

/**
 * Initialize Firebase Admin SDK for emulator
 */
async function initializeFirebaseAdmin() {
  if (adminApp) return adminApp;

  // For emulator, we don't need real credentials
  // Use 'demo-test' to match the emulator project ID
  adminApp = initializeApp({
    projectId: 'demo-test',
  });

  // Point to emulator
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

  return adminApp;
}

/**
 * Create or update a test user in Firebase Auth emulator
 */
async function createOrUpdateTestUser(
  email: string,
  password: string,
  role: string,
  clientId: string
): Promise<string> {
  const auth = getAuth();

  let userRecord;
  try {
    // Try to get existing user
    userRecord = await auth.getUserByEmail(email);
    console.log(`User ${email} already exists, updating...`);
  } catch (error) {
    // User doesn't exist, create it
    console.log(`Creating user ${email}...`);
    userRecord = await auth.createUser({
      email,
      password,
      emailVerified: true,
    });
  }

  // Set custom claims
  await auth.setCustomUserClaims(userRecord.uid, {
    role,
    clientId,
  });

  console.log(`Set custom claims for ${email}: role=${role}, clientId=${clientId}`);

  return userRecord.uid;
}

/**
 * Authenticate a user and save Playwright storage state.
 *
 * Strategy: drive the real login page in a browser. The page renders a
 * test-only email/password form when VITE_USE_FIREBASE_EMULATORS=1 is set
 * at build/dev time (see src-vnext/features/auth/components/LoginPage.tsx).
 * This lets the app's own modular Firebase SDK handle persistence
 * (IndexedDB under `firebaseLocalStorageDb`), so the storage state saved
 * here contains an auth session the modular SDK can rehydrate on reload.
 *
 * NOTE: `context.storageState()` includes IndexedDB since Playwright 1.51.
 * If running older Playwright this is a silent no-op; upgrade is required.
 */
async function authenticateAndSaveState(
  baseURL: string,
  email: string,
  password: string,
  outputPath: string,
): Promise<void> {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture browser-side diagnostics so a white-screen / init crash is visible
  // in the CI job log (the screenshot artifact is not uploaded for this path).
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(err.message));

  const dumpPageState = async (whenLabel: string) => {
    try {
      const url = page.url();
      const title = await page.title().catch(() => '<no title>');
      const rootHtml = await page
        .locator('#root')
        .innerHTML()
        .catch(() => '<no #root>');
      const bodyText = await page
        .locator('body')
        .innerText()
        .catch(() => '');
      console.error(
        `\n----- PAGE DIAGNOSTIC (${whenLabel}) for ${email} -----\n` +
          `url: ${url}\n` +
          `title: ${title}\n` +
          `#root innerHTML length: ${rootHtml.length}\n` +
          `body text (first 300): ${bodyText.slice(0, 300)}\n` +
          `console errors (${consoleErrors.length}): ${JSON.stringify(consoleErrors.slice(0, 10))}\n` +
          `page errors (${pageErrors.length}): ${JSON.stringify(pageErrors.slice(0, 10))}\n` +
          `#root innerHTML (first 800): ${rootHtml.slice(0, 800)}\n` +
          `-------------------------------------------------------\n`,
      );
    } catch (diagErr) {
      console.error(`Failed to dump page state (${whenLabel}):`, diagErr);
    }
  };

  try {
    await page.goto(baseURL);

    // The emulator-only login form is only rendered when the dev/preview
    // server was started with VITE_USE_FIREBASE_EMULATORS=1. It's gated
    // at build time, not runtime, so if the flag isn't set this will
    // time out with a clear message.
    const emailInput = page
      .locator('[data-testid="emulator-login-form"] input[type="email"], input[type="email"]')
      .first();
    await emailInput.waitFor({ state: 'visible', timeout: 20000 });

    await emailInput.fill(email);
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill(password);

    const submitButton = page
      .locator('[data-testid="emulator-login-form"] button[type="submit"], button[type="submit"]')
      .first();
    await submitButton.click();

    await page.waitForURL(/\/(shots|dashboard|projects|planner)/, { timeout: 30000 });
    await page
      .locator('nav, [role="navigation"]')
      .first()
      .waitFor({ state: 'visible', timeout: 10000 });

    // Save storage state (cookies + localStorage + IndexedDB).
    // IndexedDB is where modular Firebase Auth persists the user session.
    await context.storageState({ path: outputPath, indexedDB: true });
    console.log(`Saved auth state for ${email} to ${outputPath}`);
  } catch (error) {
    await dumpPageState('on failure');
    const screenshotPath = path.join(
      __dirname,
      'playwright',
      `.auth-debug-${email.split('@')[0]}.png`,
    );
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
    console.error(`Failed to authenticate ${email}:`, error);
    throw error;
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }
}

/**
 * Global setup function
 */
async function globalSetup(config: FullConfig) {
  console.log('\n========================================');
  console.log('🚀 Starting Playwright Global Setup');
  console.log('========================================\n');

  // Check if emulators are running
  console.log('Checking Firebase emulators...');
  const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099';
  const firestoreEmulatorHost = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';

  console.log(`Auth Emulator: ${authEmulatorHost}`);
  console.log(`Firestore Emulator: ${firestoreEmulatorHost}`);

  // Set environment variables for emulators
  process.env.FIREBASE_AUTH_EMULATOR_HOST = authEmulatorHost;
  process.env.FIRESTORE_EMULATOR_HOST = firestoreEmulatorHost;

  // Initialize Firebase Admin
  console.log('\nInitializing Firebase Admin SDK...');
  await initializeFirebaseAdmin();

  // Create output directory for auth states
  const authDir = path.join(__dirname, 'playwright', '.auth');
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Get base URL from config
  const baseURL = config.projects[0].use.baseURL || 'http://localhost:5173';
  console.log(`Base URL: ${baseURL}\n`);

  // Create test users and authenticate each one
  console.log('Creating test users and authenticating...\n');

  // Capture each role's uid — the pulls-crud fixture needs the warehouse uid to
  // grant it project membership (see below); without a members doc the warehouse
  // user satisfies neither producerCanAccessProject (global producer only) nor
  // hasProjectRole, so firestore.rules would deny it read/write on the pull.
  const roleUids: Record<string, string> = {};

  for (const [roleName, userData] of Object.entries(TEST_USERS)) {
    try {
      // Create/update user with custom claims
      roleUids[roleName] = await createOrUpdateTestUser(
        userData.email,
        userData.password,
        userData.role,
        userData.clientId
      );

      // Authenticate and save state
      const statePath = path.join(authDir, `${roleName}.json`);
      await authenticateAndSaveState(baseURL, userData.email, userData.password, statePath);

      console.log(`✅ ${roleName.toUpperCase()} user ready\n`);
    } catch (error) {
      console.error(`❌ Failed to set up ${roleName} user:`, error);
      throw error;
    }
  }

  // Seed the deterministic Firestore fixture the CRUD specs read (one
  // team-visible project + app-shaped shots). Runs after users are created and
  // before any spec, so all specs share one seeded dataset. Reuses the same
  // firebase-admin app (projectId 'demo-test') initialized above — the seed
  // helper guards against a double initializeApp.
  console.log('Seeding Firestore fixtures (shots-crud)...');
  try {
    await seedShotsCrudScenario();
    // Seed the pulls-crud fixture AFTER shots-crud — seedPullsCrudScenario
    // assumes the seed project (created by seedShotsCrudScenario) already exists.
    // Pass the warehouse uid so the seed can grant it project membership: pull
    // read/write under firestore.rules requires hasProjectRole(...,'warehouse')
    // (warehouse's global role satisfies neither isAdmin nor producerCanAccessProject).
    await seedPullsCrudScenario({ warehouseUid: roleUids.warehouse });
    console.log('✅ Firestore fixtures seeded\n');
  } catch (error) {
    console.error('❌ Failed to seed Firestore fixtures:', error);
    throw error;
  }

  console.log('========================================');
  console.log('✅ Global Setup Complete');
  console.log('========================================\n');
}

export default globalSetup;
