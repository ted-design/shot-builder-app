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
 * Authenticate a user and save storage state
 */
async function authenticateAndSaveState(
  baseURL: string,
  email: string,
  password: string,
  outputPath: string
): Promise<void> {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Listen for console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error(`Browser console error: ${msg.text()}`);
    }
  });

  // Listen for page errors
  page.on('pageerror', error => {
    console.error(`Page error: ${error.message}`);
  });

  try {
    // Navigate to app
    await page.goto(baseURL);

    // Wait for login page to load
    await page.waitForLoadState('domcontentloaded');

    // Check if already on authenticated page (shouldn't be, but just in case)
    const currentUrl = page.url();
    console.log(`Current URL after navigation: ${currentUrl}`);

    if (currentUrl.includes('/shots') || currentUrl.includes('/dashboard') || currentUrl.includes('/projects')) {
      console.log(`Already authenticated for ${email}`);
      await context.storageState({ path: outputPath });
      return;
    }

    // Take screenshot for debugging
    const screenshotPath = path.join(__dirname, 'playwright', `.auth-debug-${email.split('@')[0]}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Saved debug screenshot to ${screenshotPath}`);

    // Log page title and visible text
    const title = await page.title();
    console.log(`Page title: ${title}`);

    // Check if login form elements exist
    const emailInputExists = await page.locator('input[type="email"], input[placeholder*="email" i]').count();
    const passwordInputExists = await page.locator('input[type="password"], input[placeholder*="password" i]').count();
    const submitButtonExists = await page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Sign In")').count();

    console.log(`Email input found: ${emailInputExists} element(s)`);
    console.log(`Password input found: ${passwordInputExists} element(s)`);
    console.log(`Submit button found: ${submitButtonExists} element(s)`);

    // Fill in login form with increased timeout
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
    await emailInput.waitFor({ state: 'visible', timeout: 30000 });
    await emailInput.fill(email);

    const passwordInput = page.locator('input[type="password"], input[placeholder*="password" i]').first();
    await passwordInput.fill(password);

    // Click sign in button
    const signInButton = page.locator('button:has-text("Sign in"), button:has-text("Sign In"), button[type="submit"]').first();
    await signInButton.click();

    // Wait for redirect to authenticated page
    await page.waitForURL(/\/(shots|dashboard|projects|planner)/, { timeout: 15000 });

    // Wait for authenticated UI to appear
    await page.locator('nav, [role="navigation"]').first().waitFor({ state: 'visible', timeout: 10000 });

    // Save authentication state
    await context.storageState({ path: outputPath });
    console.log(`Saved auth state for ${email} to ${outputPath}`);
  } catch (error) {
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
