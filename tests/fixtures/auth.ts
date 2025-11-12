/* eslint-disable react-hooks/rules-of-hooks */
import { test as base, type Page } from '@playwright/test';
import * as path from 'path';

/**
 * Playwright fixtures for role-based authentication.
 *
 * These fixtures provide pre-authenticated page contexts for different user roles.
 * Each fixture uses the storage state saved during global setup.
 *
 * Usage:
 * ```typescript
 * import { test, expect } from './fixtures/auth';
 *
 * test('admin can manage users', async ({ adminPage }) => {
 *   await adminPage.goto('/admin');
 *   // Test admin-specific functionality
 * });
 *
 * test('producer can create shots', async ({ producerPage }) => {
 *   await producerPage.goto('/shots');
 *   // Test producer-specific functionality
 * });
 * ```
 */

// Re-export everything from @playwright/test
export * from '@playwright/test';

// Define custom fixtures type
type AuthFixtures = {
  adminPage: Page;
  producerPage: Page;
  wardrobePage: Page;
  crewPage: Page;
  viewerPage: Page;
};

// Extend base test with role-based page fixtures
export const test = base.extend<AuthFixtures>({
  /**
   * Page fixture for admin user
   * Full system access, can manage users and settings
   */
  adminPage: async ({ browser }, use) => {
    const storageState = path.join(__dirname, '../playwright/.auth/admin.json');
    const context = await browser.newContext({ storageState });
    const page = await context.newPage();

    // Set viewport for consistency
    await page.setViewportSize({ width: 1280, height: 720 });

    await use(page);

    await context.close();
  },

  /**
   * Page fixture for producer user
   * Can create/edit shots, manage projects, export
   */
  producerPage: async ({ browser }, use) => {
    const storageState = path.join(__dirname, '../playwright/.auth/producer.json');
    const context = await browser.newContext({ storageState });
    const page = await context.newPage();

    await page.setViewportSize({ width: 1280, height: 720 });

    await use(page);

    await context.close();
  },

  /**
   * Page fixture for wardrobe user
   * Can manage products, view/edit shots
   */
  wardrobePage: async ({ browser }, use) => {
    const storageState = path.join(__dirname, '../playwright/.auth/wardrobe.json');
    const context = await browser.newContext({ storageState });
    const page = await context.newPage();

    await page.setViewportSize({ width: 1280, height: 720 });

    await use(page);

    await context.close();
  },

  /**
   * Page fixture for crew user
   * Can view shots, limited edit access
   */
  crewPage: async ({ browser }, use) => {
    const storageState = path.join(__dirname, '../playwright/.auth/crew.json');
    const context = await browser.newContext({ storageState });
    const page = await context.newPage();

    await page.setViewportSize({ width: 1280, height: 720 });

    await use(page);

    await context.close();
  },

  /**
   * Page fixture for viewer user
   * Read-only access to most content
   */
  viewerPage: async ({ browser }, use) => {
    const storageState = path.join(__dirname, '../playwright/.auth/viewer.json');
    const context = await browser.newContext({ storageState });
    const page = await context.newPage();

    await page.setViewportSize({ width: 1280, height: 720 });

    await use(page);

    await context.close();
  },
});

/**
 * Helper to get test user credentials
 * Useful for tests that need to perform authentication flows
 */
export const TEST_CREDENTIALS = {
  admin: {
    email: 'admin@test.shotbuilder.app',
    password: 'test-password-admin-123',
    role: 'admin',
  },
  producer: {
    email: 'producer@test.shotbuilder.app',
    password: 'test-password-producer-123',
    role: 'producer',
  },
  wardrobe: {
    email: 'wardrobe@test.shotbuilder.app',
    password: 'test-password-wardrobe-123',
    role: 'wardrobe',
  },
  crew: {
    email: 'crew@test.shotbuilder.app',
    password: 'test-password-crew-123',
    role: 'crew',
  },
  viewer: {
    email: 'viewer@test.shotbuilder.app',
    password: 'test-password-viewer-123',
    role: 'viewer',
  },
};
