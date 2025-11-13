import { Page } from '@playwright/test';
import { TEST_CREDENTIALS } from '../fixtures/auth';

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
  const defaultCredentials = TEST_CREDENTIALS.producer;
  const baseURL = (process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173').replace(/\/$/, '');
  const {
    email = defaultCredentials.email,
    password = defaultCredentials.password,
    role = defaultCredentials.role,
    clientId = 'test-client'
  } = options;

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Navigate to the app with increased timeout for CI
      await page.goto(`${baseURL}/`, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // Check if we're already authenticated (redirected to dashboard/shots)
      const currentUrl = page.url();
      if (currentUrl.includes('/shots') || currentUrl.includes('/dashboard') || currentUrl.includes('/projects')) {
        console.log(`Already authenticated as ${email}`);
        return { email, password, role, clientId };
      }

      // Wait for login form to be visible with increased timeout
      const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
      await emailInput.waitFor({ state: 'visible', timeout: 15000 });

      // Clear and fill email
      await emailInput.clear();
      await emailInput.fill(email);

      // Clear and fill password
      const passwordInput = page.locator('input[type="password"], input[placeholder*="password" i]').first();
      await passwordInput.clear();
      await passwordInput.fill(password);

      // Small delay to ensure form is ready
      await page.waitForTimeout(500);

      // Click sign in button
      const signInButton = page.locator('button:has-text("Sign in"), button:has-text("Sign In"), button[type="submit"]').first();
      await signInButton.click();

      // Wait for authentication to complete and redirect with increased timeout
      await page.waitForURL(/\/(shots|dashboard|projects|planner)/, {
        timeout: 20000
      });

      // Wait for the page to fully load after auth
      await page.waitForLoadState('networkidle', { timeout: 15000 });

      console.log(`Successfully authenticated as ${email}`);
      return { email, password, role, clientId };

    } catch (error) {
      lastError = error as Error;
      console.log(`Authentication attempt ${attempt}/${maxRetries} failed for ${email}: ${lastError.message}`);

      if (attempt < maxRetries) {
        console.log(`Retrying authentication in 2 seconds...`);
        await page.waitForTimeout(2000);

        // Try to reload the page for next attempt
        try {
          await page.reload({ waitUntil: 'networkidle', timeout: 10000 });
        } catch (reloadError) {
          // If reload fails, continue to next attempt anyway
          console.log('Page reload failed, continuing with next attempt');
        }
      }
    }
  }

  // If we get here, all attempts failed
  throw new Error(`Failed to authenticate ${email} after ${maxRetries} attempts. Last error: ${lastError?.message}`);
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
