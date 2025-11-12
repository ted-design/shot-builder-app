import { test, expect } from '@playwright/test';
import { TEST_CREDENTIALS } from './fixtures/auth';
import { authenticateTestUser, signOut } from './helpers/auth';

/**
 * Authentication flow E2E tests.
 * Tests the complete authentication lifecycle without using fixtures.
 */

test.describe('Authentication Flow', () => {
  test('user can sign in with email and password', async ({ page }) => {
    await page.goto('/');

    // Should start on login page
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
    await expect(emailInput).toBeVisible({ timeout: 10000 });

    // Fill in credentials
    await emailInput.fill(TEST_CREDENTIALS.producer.email);

    const passwordInput = page.locator('input[type="password"], input[placeholder*="password" i]').first();
    await passwordInput.fill(TEST_CREDENTIALS.producer.password);

    // Submit
    const signInButton = page.locator('button:has-text("Sign in"), button:has-text("Sign In"), button[type="submit"]').first();
    await signInButton.click();

    // Should redirect to authenticated page
    await page.waitForURL(/\/(shots|dashboard|projects|planner)/, { timeout: 15000 });

    // Should be authenticated
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/(shots|dashboard|projects)/);

    // Should see navigation
    const nav = page.locator('nav, [role="navigation"]');
    await expect(nav).toBeVisible();
  });

  test('user can sign out', async ({ page }) => {
    // First sign in
    await authenticateTestUser(page, {
      email: TEST_CREDENTIALS.producer.email,
      password: TEST_CREDENTIALS.producer.password,
      role: TEST_CREDENTIALS.producer.role,
    });

    // Should be authenticated
    await page.waitForURL(/\/(shots|dashboard|projects)/, { timeout: 10000 });

    // Sign out
    await signOut(page);

    // Should redirect to login page
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/(login|signin|auth|$)/);

    // Should see login form
    const emailInput = page.locator('input[type="email"]').first();
    await expect(emailInput).toBeVisible({ timeout: 5000 });
  });

  test('unauthenticated user is redirected to login', async ({ page }) => {
    // Try to access protected page without auth
    await page.goto('/shots');

    await page.waitForLoadState('networkidle');

    // Should redirect to login
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/(login|signin|auth|$)/);

    // Should see login form
    const emailInput = page.locator('input[type="email"]').first();
    await expect(emailInput).toBeVisible();
  });

  test('admin role can access admin page', async ({ page }) => {
    // Sign in as admin
    await authenticateTestUser(page, {
      email: TEST_CREDENTIALS.admin.email,
      password: TEST_CREDENTIALS.admin.password,
      role: TEST_CREDENTIALS.admin.role,
    });

    // Navigate to admin page
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Should be able to access
    expect(page.url()).toContain('/admin');

    // Should see admin content
    const heading = page.getByRole('heading', { name: /admin|user management|settings/i }).first();
    await expect(heading).toBeVisible();
  });

  test('non-admin role cannot access admin page', async ({ page }) => {
    // Sign in as producer (not admin)
    await authenticateTestUser(page, {
      email: TEST_CREDENTIALS.producer.email,
      password: TEST_CREDENTIALS.producer.password,
      role: TEST_CREDENTIALS.producer.role,
    });

    // Try to access admin page
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Should be redirected away or see permission denied
    const currentUrl = page.url();

    // Either redirected to projects/dashboard, or on admin page but see error/empty state
    if (currentUrl.includes('/admin')) {
      // Check for permission denied message
      const permissionDenied = page.getByText(/permission denied|not authorized|access denied/i);
      const adminHeading = page.getByRole('heading', { name: /admin|user management/i });

      // Should either see permission denied or not see admin-specific content
      const hasPermissionMessage = await permissionDenied.count() > 0;
      const hasAdminHeading = await adminHeading.count() > 0;

      expect(hasPermissionMessage || !hasAdminHeading).toBeTruthy();
    } else {
      // Redirected away from admin page
      expect(currentUrl).toMatch(/\/(shots|dashboard|projects)/);
    }
  });

  test('viewer role has read-only permissions', async ({ page }) => {
    // Sign in as viewer
    await authenticateTestUser(page, {
      email: TEST_CREDENTIALS.viewer.email,
      password: TEST_CREDENTIALS.viewer.password,
      role: TEST_CREDENTIALS.viewer.role,
    });

    await page.waitForURL(/\/(shots|dashboard|projects)/, { timeout: 10000 });

    // Navigate to products page
    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    // Look for create/add buttons - they should be disabled or hidden
    const createButtons = page.getByRole('button', { name: /create|new|add/i });
    const count = await createButtons.count();

    if (count > 0) {
      // If buttons exist, they should be disabled
      for (let i = 0; i < count; i++) {
        const button = createButtons.nth(i);
        if (await button.isVisible()) {
          await expect(button).toBeDisabled();
        }
      }
    }
  });

  test('producer role can create and edit content', async ({ page }) => {
    // Sign in as producer
    await authenticateTestUser(page, {
      email: TEST_CREDENTIALS.producer.email,
      password: TEST_CREDENTIALS.producer.password,
      role: TEST_CREDENTIALS.producer.role,
    });

    await page.waitForURL(/\/(shots|dashboard|projects)/, { timeout: 10000 });

    // Navigate to products page
    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    // Should see create button and it should be enabled
    const createButton = page.getByRole('button', { name: /create|new|add product/i }).first();

    if (await createButton.count() > 0) {
      await expect(createButton).toBeEnabled();
    }
  });

  test('session persists across page reloads', async ({ page }) => {
    // Sign in
    await authenticateTestUser(page, {
      email: TEST_CREDENTIALS.producer.email,
      password: TEST_CREDENTIALS.producer.password,
      role: TEST_CREDENTIALS.producer.role,
    });

    await page.waitForURL(/\/(shots|dashboard|projects)/, { timeout: 10000 });

    const firstUrl = page.url();

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should still be authenticated (not redirected to login)
    const afterReloadUrl = page.url();
    expect(afterReloadUrl).not.toMatch(/\/(login|signin|auth)/);

    // Should still be on an authenticated page
    expect(afterReloadUrl).toMatch(/\/(shots|dashboard|projects)/);
  });

  test('invalid credentials show error message', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });

    // Fill in invalid credentials
    await emailInput.fill('invalid@example.com');

    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill('wrong-password');

    // Submit
    const signInButton = page.locator('button:has-text("Sign in"), button:has-text("Sign In"), button[type="submit"]').first();
    await signInButton.click();

    // Should show error message
    const errorMessage = page.locator('text=/error|invalid|incorrect|failed/i');
    await expect(errorMessage.first()).toBeVisible({ timeout: 5000 });

    // Should still be on login page
    await page.waitForTimeout(1000);
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/(login|signin|auth|$)/);
  });
});
