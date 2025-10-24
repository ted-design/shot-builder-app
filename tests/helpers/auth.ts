import { Page } from '@playwright/test';

export interface AuthOptions {
  email?: string;
  password?: string;
  role?: string;
  clientId?: string;
}

/**
 * Authenticate a test user using Firebase Auth emulator.
 *
 * Prerequisites:
 * - Firebase emulators must be running (auth, firestore)
 * - Set VITE_USE_FIREBASE_EMULATORS=1 environment variable
 *
 * @param page - Playwright page instance
 * @param options - Authentication options
 * @returns User credentials used for authentication
 */
export async function authenticateTestUser(
  page: Page,
  options: AuthOptions = {}
): Promise<{ email: string; password: string; role: string; clientId: string }> {
  const {
    email = 'test@example.com',
    password = 'test-password-123',
    role = 'producer',
    clientId = 'test-client'
  } = options;

  // Navigate to the app
  await page.goto('http://localhost:5173');

  // Wait for the page to load
  await page.waitForLoadState('networkidle');

  // Check if we're already authenticated (redirected to dashboard/shots)
  const currentUrl = page.url();
  if (currentUrl.includes('/shots') || currentUrl.includes('/dashboard') || currentUrl.includes('/projects')) {
    return { email, password, role, clientId };
  }

  // Wait for login form to be visible
  const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
  await emailInput.waitFor({ state: 'visible', timeout: 5000 });

  // Fill in email and password
  await emailInput.fill(email);

  const passwordInput = page.locator('input[type="password"], input[placeholder*="password" i]').first();
  await passwordInput.fill(password);

  // Click sign in button
  const signInButton = page.locator('button:has-text("Sign in"), button:has-text("Sign In"), button[type="submit"]').first();
  await signInButton.click();

  // Wait for authentication to complete and redirect
  await page.waitForURL(/\/(shots|dashboard|projects|planner)/, { timeout: 10000 });

  // Wait for the page to fully load after auth
  await page.waitForLoadState('networkidle');

  return { email, password, role, clientId };
}

/**
 * Setup Firebase emulator environment for tests.
 * Call this in beforeEach or beforeAll to ensure emulator mode is enabled.
 *
 * @param page - Playwright page instance
 */
export async function setupFirebaseEmulators(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Set flag to use emulators (if your app checks for this)
    localStorage.setItem('FIREBASE_USE_EMULATORS', '1');
  });
}

/**
 * Clear authentication state.
 *
 * @param page - Playwright page instance
 */
export async function signOut(page: Page): Promise<void> {
  // Look for sign out button or user menu
  const userMenu = page.locator('button[aria-label*="user" i], button:has-text("Sign out")').first();
  const userMenuExists = await userMenu.count() > 0;

  if (userMenuExists) {
    await userMenu.click();

    const signOutButton = page.locator('button:has-text("Sign out"), a:has-text("Sign out")').first();
    const signOutExists = await signOutButton.count() > 0;

    if (signOutExists) {
      await signOutButton.click();
      await page.waitForURL(/\/(login|signin|auth)/, { timeout: 5000 });
    }
  }

  // Clear all storage
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}
