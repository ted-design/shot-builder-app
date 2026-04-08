import { chromium, type FullConfig } from '@playwright/test';
import { initializeApp, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

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
 * Sign in via the Auth emulator REST API (bypasses login UI entirely).
 *
 * The login page only has Google OAuth — no email/password form.
 * The emulator's signInWithPassword endpoint works because
 * createOrUpdateTestUser creates users with email+password.
 */
async function signInViaEmulatorApi(
  email: string,
  password: string,
): Promise<{ idToken: string; refreshToken: string; localId: string }> {
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099';
  const apiKey = process.env.VITE_FIREBASE_API_KEY || 'fake-api-key';

  const res = await fetch(
    `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Auth emulator signIn failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  if (!data.idToken) {
    throw new Error(`Auth emulator returned no idToken for ${email}`);
  }

  return { idToken: data.idToken, refreshToken: data.refreshToken, localId: data.localId };
}

/**
 * Authenticate a user and save Playwright storage state.
 *
 * Strategy: sign in via emulator REST API to get tokens, then inject
 * the auth state into the browser via Firebase's IndexedDB persistence
 * by calling signInWithCredential on the client-side Firebase SDK.
 */
async function authenticateAndSaveState(
  baseURL: string,
  email: string,
  password: string,
  outputPath: string
): Promise<void> {
  // Step 1: Get tokens from the emulator REST API
  const { idToken, refreshToken, localId } = await signInViaEmulatorApi(email, password);
  console.log(`Got emulator token for ${email} (uid: ${localId})`);

  // Step 2: Open a browser, navigate to the app, and inject the auth state
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(baseURL);
    await page.waitForLoadState('domcontentloaded');

    // Inject the auth credential into the client-side Firebase SDK.
    // The app uses connectAuthEmulator when VITE_USE_FIREBASE_EMULATORS=1,
    // so signInWithCredential will hit the emulator, not production.
    const signedIn = await page.evaluate(
      async ({ idToken: token, email: userEmail }) => {
        // Wait for Firebase to initialize (the app sets window.__BOOT_PHASE)
        const waitForFirebase = () =>
          new Promise<void>((resolve) => {
            const check = () => {
              // @ts-expect-error -- Firebase auth is on the module scope
              if (typeof window !== 'undefined' && window.__BOOT_PHASE === 'react-mounted') {
                resolve();
              } else {
                setTimeout(check, 200);
              }
            };
            check();
            // Fallback: resolve after 8s even if boot phase not detected
            setTimeout(resolve, 8000);
          });

        await waitForFirebase();

        try {
          // Dynamic import to access the app's Firebase instance
          const { auth } = await import('/src-vnext/shared/lib/firebase.ts');
          const { signInWithCredential, GoogleAuthProvider } = await import('firebase/auth');

          // Create a credential from the emulator-issued ID token
          const credential = GoogleAuthProvider.credential(token);
          const result = await signInWithCredential(auth, credential);
          return { success: true, uid: result.user.uid, email: result.user.email };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return { success: false, error: msg };
        }
      },
      { idToken, email },
    );

    if (!signedIn.success) {
      throw new Error(`Client-side signIn failed for ${email}: ${signedIn.error}`);
    }

    console.log(`Browser signed in as ${signedIn.email} (uid: ${signedIn.uid})`);

    // Step 3: Wait for the app to redirect to an authenticated route
    await page.waitForURL(/\/(shots|dashboard|projects|planner)/, { timeout: 15000 });
    await page.locator('nav, [role="navigation"]').first().waitFor({ state: 'visible', timeout: 10000 });

    // Step 4: Save storage state (cookies + localStorage + IndexedDB auth)
    await context.storageState({ path: outputPath });
    console.log(`Saved auth state for ${email} to ${outputPath}`);
  } catch (error) {
    // Save debug screenshot on failure
    const screenshotPath = path.join(__dirname, 'playwright', `.auth-debug-${email.split('@')[0]}.png`);
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

  for (const [roleName, userData] of Object.entries(TEST_USERS)) {
    try {
      // Create/update user with custom claims
      await createOrUpdateTestUser(
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

  console.log('========================================');
  console.log('✅ Global Setup Complete');
  console.log('========================================\n');
}

export default globalSetup;
