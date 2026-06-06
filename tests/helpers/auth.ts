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
      // Navigate to the app with increased timeout for CI.
      // Use 'domcontentloaded', NOT 'networkidle': against the Firebase emulator
      // the app opens long-lived streaming connections (Firestore listeners,
      // Installations) that never go idle, so 'networkidle' can hang until timeout.
      await page.goto(`${baseURL}/`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Check if we're already authenticated (redirected to dashboard/shots)
      const currentUrl = page.url();
      if (currentUrl.includes('/shots') || currentUrl.includes('/dashboard') || currentUrl.includes('/projects')) {
        console.log(`Already authenticated as ${email}`);
        return { email, password, role, clientId };
      }

      // Wait for login form to be visible with increased timeout.
      // Prefer the emulator-only form (data-testid="emulator-login-form") which is
      // rendered when VITE_USE_FIREBASE_EMULATORS=1 — this avoids accidentally
      // targeting the Google OAuth button (which also contains the text "Sign in").
      const emailInput = page.locator(
        '[data-testid="emulator-login-form"] input[type="email"], input[type="email"], input[placeholder*="email" i]'
      ).first();
      await emailInput.waitFor({ state: 'visible', timeout: 15000 });

      // Clear and fill email
      await emailInput.clear();
      await emailInput.fill(email);

      // Clear and fill password
      const passwordInput = page.locator(
        '[data-testid="emulator-login-form"] input[type="password"], input[type="password"], input[placeholder*="password" i]'
      ).first();
      await passwordInput.clear();
      await passwordInput.fill(password);

      // Small delay to ensure form is ready
      await page.waitForTimeout(500);

      // Click the emulator form's submit button. Match ONLY type="submit"
      // buttons — NEVER a :has-text("Sign in") selector: the Google OAuth button
      // ("Sign in with Google") contains the text "Sign in" AND is rendered
      // earlier in the DOM, so `.first()` across a :has-text list would click
      // Google (opening a popup) and the form would never submit. The Google
      // button is type="button", so a type="submit" filter excludes it. This is
      // the proven-safe selector global.setup.ts uses.
      const signInButton = page.locator(
        '[data-testid="emulator-login-form"] button[type="submit"], button[type="submit"]'
      ).first();
      await signInButton.click();

      // Wait for authed SIGNALS rather than racing a single client-side redirect.
      // The post-login redirect is driven in-app (onIdTokenChanged → claims →
      // navigate('/projects')); waiting on page.waitForURL alone is flaky because
      // that chain can lag behind the emulator's never-idle connections. Instead
      // wait for concrete evidence the session took hold: (1) the emulator login
      // form unmounts, (2) we are no longer on /login, (3) the app nav renders.
      // This is an authed-signal variant of global.setup.ts's waitForURL + nav
      // check, hardened against the redirect race rather than relying on the URL.
      await page.locator('[data-testid="emulator-login-form"]').waitFor({
        state: 'detached',
        timeout: 30000
      });
      await page.waitForFunction(
        () => !window.location.pathname.startsWith('/login'),
        undefined,
        { timeout: 30000 }
      );

      // Wait for authenticated UI to appear (ensures Firebase auth state is loaded)
      await page.locator('nav, header, [role="navigation"]').first().waitFor({
        state: 'visible',
        timeout: 10000
      });

      console.log(`Successfully authenticated as ${email}`);
      return { email, password, role, clientId };

    } catch (error) {
      lastError = error as Error;
      console.log(`Authentication attempt ${attempt}/${maxRetries} failed for ${email}: ${lastError.message}`);

      if (attempt < maxRetries) {
        console.log(`Retrying authentication in 2 seconds...`);
        await page.waitForTimeout(2000);

        // Try to reload the page for next attempt (domcontentloaded, not
        // networkidle — see the goto note above re: never-idle emulator sockets)
        try {
          await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
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
 * Sign the current user out through the real app control and wait until the
 * session is actually cleared.
 *
 * The sign-out control lives in the sidebar user section (SidebarUserSection)
 * as an icon-only button with aria-label="Sign out" — there is NO separate
 * user-menu trigger to open first, and it has no visible text (so a
 * :has-text("Sign out") selector would not match it). It renders on desktop
 * when the sidebar is expanded, which is the default state.
 *
 * @param page - Playwright page instance
 */
export async function signOut(page: Page): Promise<void> {
  const signOutButton = page.locator('button[aria-label="Sign out"]').first();
  await signOutButton.waitFor({ state: 'visible', timeout: 10000 });
  await signOutButton.click();

  // App signOut() → auth.signOut() → onIdTokenChanged(null) → RequireAuth
  // redirects to /login. Wait for that redirect and the login form to reappear,
  // proving the session is genuinely gone (the modular SDK stores auth in
  // IndexedDB, so observing the real redirect is the reliable signal).
  await page.waitForFunction(
    () => window.location.pathname.startsWith('/login'),
    undefined,
    { timeout: 10000 }
  );
  await page.locator('input[type="email"]').first().waitFor({
    state: 'visible',
    timeout: 10000
  });
}
