/* eslint-disable react-hooks/rules-of-hooks */
import { test as base, type Page } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Playwright fixtures for role-based authentication.
 *
 * Each fixture loads the storage state saved by `tests/global.setup.ts`
 * (the global setup drives the emulator-only email/password login form and
 * saves IndexedDB + cookies per role to `tests/playwright/.auth/<role>.json`).
 *
 * Specs that need raw login (e.g. `tests/auth.spec.ts`) should import from
 * `@playwright/test` directly and use the helpers in `tests/helpers/auth.ts`.
 *
 * Usage:
 * ```typescript
 * import { test, expect } from './fixtures/auth';
 *
 * test('admin can manage users', async ({ adminPage }) => {
 *   await adminPage.goto('/admin');
 * });
 * ```
 */

const AUTH_DIR = path.join(__dirname, '..', 'playwright', '.auth');

function storageStatePath(role: string): string {
  return path.join(AUTH_DIR, `${role}.json`);
}

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

/**
 * Shared handler to suppress the noisy Firebase Installations error that
 * can surface when running against the emulator. Not a real failure.
 */
function installFirebaseErrorFilter(page: Page): void {
  page.on('pageerror', (error) => {
    if (!error.message.includes('Installations: Create Installation request failed')) {
      throw error;
    }
  });
  page.on('console', (msg) => {
    if (
      msg.type() === 'error' &&
      msg.text().includes('Installations: Create Installation request failed')
    ) {
      return;
    }
  });
}

async function buildRoleFixture(
  browser: import('@playwright/test').Browser,
  role: 'admin' | 'producer' | 'wardrobe' | 'crew' | 'viewer',
  use: (page: Page) => Promise<void>,
): Promise<void> {
  const context = await browser.newContext({ storageState: storageStatePath(role) });
  const page = await context.newPage();

  installFirebaseErrorFilter(page);

  await page.setViewportSize({ width: 1280, height: 720 });

  await use(page);

  await context.close();
}

// Extend base test with role-based page fixtures
export const test = base.extend<AuthFixtures>({
  /** Admin — full system access. */
  adminPage: async ({ browser }, use) => {
    await buildRoleFixture(browser, 'admin', use);
  },

  /** Producer — can create/edit shots, manage projects, export. */
  producerPage: async ({ browser }, use) => {
    await buildRoleFixture(browser, 'producer', use);
  },

  /** Wardrobe — can manage products and view/edit shots. */
  wardrobePage: async ({ browser }, use) => {
    await buildRoleFixture(browser, 'wardrobe', use);
  },

  /** Crew — view shots, limited edit. */
  crewPage: async ({ browser }, use) => {
    await buildRoleFixture(browser, 'crew', use);
  },

  /** Viewer — read-only access. */
  viewerPage: async ({ browser }, use) => {
    await buildRoleFixture(browser, 'viewer', use);
  },
});

/**
 * Helper to get test user credentials.
 * Useful for tests that need to perform authentication flows explicitly
 * (e.g. `tests/auth.spec.ts`, which exercises the real login form).
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
