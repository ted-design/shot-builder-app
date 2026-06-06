import { test, expect } from '@playwright/test';
import { TEST_CREDENTIALS } from './fixtures/auth';
import { authenticateTestUser, signOut } from './helpers/auth';

/**
 * Authentication-flow E2E tests — the genuine login lifecycle that can ONLY be
 * exercised by driving the real form: sign-in, sign-out, redirect-when-unauth,
 * session persistence across reload, and the invalid-credential error path.
 * These are the tests that depend on the interactive-login helper
 * (helpers/auth.ts authenticateTestUser / signOut).
 *
 * Role-access (RBAC) coverage deliberately lives elsewhere via the storageState
 * fixtures — smoke.spec.ts (producer/viewer) and shots-crud / pulls-crud
 * (project-scoped role behavior) — because those need an authed session, not a
 * live login flow. The admin-page access test stays deferred alongside
 * smoke.spec.ts's test.fixme: the admin route renders an <h1>Team</h1> with no
 * stable admin-named heading in the emulator build (see tests/QUARANTINE.md).
 *
 * Selectors are scoped to [data-testid="emulator-login-form"] so they never hit
 * the Google OAuth button — "Sign in with Google" also matches :has-text("Sign in")
 * and is rendered earlier in the DOM.
 */

const EMU_FORM = '[data-testid="emulator-login-form"]';

test.describe('Authentication Flow', () => {
  test('user can sign in with email and password', async ({ page }) => {
    await page.goto('/');

    const emailInput = page.locator(`${EMU_FORM} input[type="email"]`).first();
    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await emailInput.fill(TEST_CREDENTIALS.producer.email);

    const passwordInput = page.locator(`${EMU_FORM} input[type="password"]`).first();
    await passwordInput.fill(TEST_CREDENTIALS.producer.password);

    await page.locator(`${EMU_FORM} button[type="submit"]`).first().click();

    // Authed signals (not a single redirect race): the emulator form unmounts,
    // we leave /login, and the app nav renders.
    await page.locator(EMU_FORM).waitFor({ state: 'detached', timeout: 30000 });
    await page.waitForFunction(
      () => !window.location.pathname.startsWith('/login'),
      undefined,
      { timeout: 30000 }
    );
    await expect(page.locator('nav, [role="navigation"]').first()).toBeVisible();
    // The only real post-login landing is /projects (routes/index.tsx index →
    // <Navigate to="/projects">; LoginPage `from` defaults to /projects).
    expect(page.url()).toMatch(/\/projects/);
  });

  test('user can sign out', async ({ page }) => {
    await authenticateTestUser(page, {
      email: TEST_CREDENTIALS.producer.email,
      password: TEST_CREDENTIALS.producer.password,
      role: TEST_CREDENTIALS.producer.role,
    });

    await signOut(page);

    expect(page.url()).toMatch(/\/login/);
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
  });

  test('unauthenticated user is redirected to login', async ({ page }) => {
    // Hit a protected route with no session — RequireAuth must bounce to /login.
    // Use /projects (a real RequireAuth child). NOTE: /shots is NOT a top-level
    // route — it falls through to the catch-all NotFoundPage, which sits OUTSIDE
    // RequireAuth and would render a 404 instead of redirecting.
    await page.goto('/projects');

    await page.waitForFunction(
      () => window.location.pathname.startsWith('/login'),
      undefined,
      { timeout: 10000 }
    );
    await expect(page.locator(`${EMU_FORM} input[type="email"]`).first()).toBeVisible();
  });

  test('session persists across page reloads', async ({ page }) => {
    await authenticateTestUser(page, {
      email: TEST_CREDENTIALS.producer.email,
      password: TEST_CREDENTIALS.producer.password,
      role: TEST_CREDENTIALS.producer.role,
    });

    expect(page.url()).toMatch(/\/projects/);

    // A session established through the real login flow must survive a reload
    // (Firebase rehydrates auth from IndexedDB).
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('nav, [role="navigation"]').first()).toBeVisible({ timeout: 15000 });

    const afterReloadUrl = page.url();
    expect(afterReloadUrl).not.toMatch(/\/login/);
    expect(afterReloadUrl).toMatch(/\/projects/);
  });

  test('invalid credentials show error message', async ({ page }) => {
    await page.goto('/');

    const emailInput = page.locator(`${EMU_FORM} input[type="email"]`).first();
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill('invalid@example.com');
    await page.locator(`${EMU_FORM} input[type="password"]`).first().fill('wrong-password');
    await page.locator(`${EMU_FORM} button[type="submit"]`).first().click();

    // LoginPage renders the Firebase error in a dedicated element; the emulator
    // returns "Firebase: Error (auth/invalid-credential)." Scope to the error
    // element (not a page-wide text regex) so stray future copy can't pass it.
    await expect(page.locator('[data-testid="login-error"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="login-error"]')).toHaveText(/error|invalid|incorrect|failed/i);

    // Stays on /login — the emulator form is still mounted.
    await expect(page.locator(EMU_FORM)).toBeVisible();
    expect(page.url()).toMatch(/\/login/);
  });
});
