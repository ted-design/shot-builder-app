# E2E Testing Guide

This document explains how to run end-to-end (E2E) tests for Shot Builder using Playwright and Firebase emulators.

## Overview

Shot Builder uses **Playwright** for E2E testing with **Firebase Auth and Firestore emulators** for authentication and data storage. This approach provides:

- Fast test execution (no network calls to production Firebase)
- Isolated test environment (no interference with production data)
- Consistent test data (seed data for reliable tests)
- Role-based authentication (test different user permissions)

## Prerequisites

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Firebase Emulators

E2E tests require Firebase emulators to be running. Open a terminal and run:

```bash
firebase emulators:start --only auth,firestore
```

This starts:
- **Auth Emulator**: `localhost:9099`
- **Firestore Emulator**: `localhost:8080`
- **Emulator UI**: `localhost:4000`

**Keep this terminal running** while you run tests.

### 3. Start Dev Server

In a **second terminal**, start the Vite dev server:

```bash
npm run dev
```

This starts the app on `http://localhost:5173`.

**Keep this terminal running** while you run tests.

## Running Tests

With both emulators and dev server running, you can run E2E tests:

### Run All E2E Tests

```bash
npm run test:e2e
```

### Run Tests with UI (Interactive Mode)

```bash
npm run test:e2e:ui
```

This opens the Playwright UI where you can:
- Select which tests to run
- Watch tests execute in real-time
- Debug test failures
- View screenshots and videos

### Run Tests in Headed Mode (See Browser)

```bash
npm run test:e2e:headed
```

This runs tests with the browser visible (useful for debugging).

### Debug a Specific Test

```bash
npm run test:e2e:debug
```

This runs tests in debug mode with Playwright Inspector.

### Run Tests in Specific Browser

```bash
npm run test:e2e:chromium  # Chromium only
npx playwright test --project=firefox  # Firefox only
npx playwright test --project=webkit   # Safari only
```

### View Test Report

After tests run, view the HTML report:

```bash
npm run test:e2e:report
```

## Test Structure

### Test Files

- `tests/auth.spec.ts` - Authentication flow tests
- `tests/smoke.spec.ts` - Core functionality smoke tests
- `tests/a11y.spec.ts` - Accessibility tests with axe-core
- `tests/shots-crud.spec.ts` - Shot lifecycle tests (create, edit, delete, filters, export)
- `tests/pulls-crud.spec.ts` - Pull sheet workflow tests
- `tests/sidebar-summary.spec.ts` - Shot edit modal sidebar tests with autosave
- `tests/image-crop-editor.spec.js` - Image Crop Editor feature tests (zoom, rotation, pan, aspect ratios)

### Test Helpers

- `tests/global.setup.ts` - Global setup (creates test users, authenticates)
- `tests/fixtures/auth.ts` - Role-based page fixtures
- `tests/helpers/auth.ts` - Authentication utilities
- `tests/helpers/seed.ts` - Test data seeding functions

### Test Users

The global setup creates 5 test users:

| Role | Email | Password |
|------|-------|----------|
| **Admin** | admin@test.shotbuilder.app | test-password-admin-123 |
| **Producer** | producer@test.shotbuilder.app | test-password-producer-123 |
| **Wardrobe** | wardrobe@test.shotbuilder.app | test-password-wardrobe-123 |
| **Crew** | crew@test.shotbuilder.app | test-password-crew-123 |
| **Viewer** | viewer@test.shotbuilder.app | test-password-viewer-123 |

All users are in the `test-client` organization.

## Writing Tests

### Using Role-Based Fixtures

Tests can use pre-authenticated page fixtures for different roles:

```typescript
import { test, expect } from './fixtures/auth';

test('producer can create shots', async ({ producerPage }) => {
  await producerPage.goto('/shots');

  const createButton = producerPage.getByRole('button', { name: /create/i });
  await expect(createButton).toBeEnabled();
});

test('admin can manage users', async ({ adminPage }) => {
  await adminPage.goto('/admin');

  const heading = adminPage.getByRole('heading', { name: /admin/i });
  await expect(heading).toBeVisible();
});
```

Available fixtures:
- `adminPage` - Full system access
- `producerPage` - Can create/edit shots, manage projects
- `wardrobePage` - Can manage products, view/edit shots
- `crewPage` - Limited edit access
- `viewerPage` - Read-only access

### Testing Authentication Flows

For tests that need to test the authentication flow itself:

```typescript
import { test, expect } from '@playwright/test';
import { authenticateTestUser, TEST_CREDENTIALS } from './helpers/auth';

test('user can sign in', async ({ page }) => {
  await page.goto('/');

  // Fill in login form
  await page.locator('input[type="email"]').fill(TEST_CREDENTIALS.producer.email);
  await page.locator('input[type="password"]').fill(TEST_CREDENTIALS.producer.password);
  await page.locator('button:has-text("Sign in")').click();

  // Should redirect to dashboard
  await page.waitForURL(/\/(shots|dashboard|projects)/);
});
```

### Seeding Test Data

Use the seeding helpers to create test data:

```typescript
import { test } from './fixtures/auth';
import { seedCompleteScenario } from './helpers/seed';

test('user can view shots', async ({ producerPage }) => {
  // Seed test data
  const { projectId, shotIds } = await seedCompleteScenario();

  // Navigate to shots page
  await producerPage.goto('/shots');

  // Test with seeded data
  // ...
});
```

## Troubleshooting

### Tests Fail with "Connection Refused"

**Problem**: Tests can't connect to emulators or dev server.

**Solution**:
1. Ensure Firebase emulators are running: `firebase emulators:start --only auth,firestore`
2. Ensure dev server is running: `npm run dev`
3. Check that ports are correct:
   - Dev server: `http://localhost:5173`
   - Auth emulator: `localhost:9099`
   - Firestore emulator: `localhost:8080`

### Tests Fail with "User Not Found"

**Problem**: Test users not created.

**Solution**: The global setup should create test users automatically. If this fails:
1. Check emulators are running
2. Delete `tests/playwright/.auth/` directory
3. Run tests again to trigger setup

### Tests Hang or Timeout

**Problem**: Tests wait forever for elements that don't appear.

**Solution**:
1. Run with `--headed` to see what's happening: `npm run test:e2e:headed`
2. Check for console errors in the browser
3. Verify test data exists (use seeding helpers)
4. Increase timeout if needed: `expect(element).toBeVisible({ timeout: 10000 })`

### Authentication State Not Persisting

**Problem**: Tests lose authentication between steps.

**Solution**:
1. Use role-based fixtures (`producerPage`, `adminPage`, etc.) which handle auth state
2. Check that `tests/playwright/.auth/*.json` files exist
3. Clear storage and re-run global setup

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Start Firebase emulators
        run: |
          npm install -g firebase-tools
          firebase emulators:start --only auth,firestore &
          sleep 10

      - name: Build app
        run: npm run build

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload test report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

## Best Practices

### 1. Use Role-Based Fixtures

Always use the role-based page fixtures (`producerPage`, `adminPage`, etc.) instead of manually authenticating in each test.

### 2. Seed Test Data

Use the seeding helpers to create consistent test data instead of relying on existing data.

### 3. Clean Up After Tests

Tests should clean up data they create (or use isolated test data):

```typescript
import { clearTestData } from './helpers/seed';

test.afterEach(async () => {
  await clearTestData();
});
```

### 4. Use Descriptive Test Names

Write test names that clearly describe what's being tested:

```typescript
// Good
test('producer can create shot with products and talent', async ({ producerPage }) => {

// Bad
test('test1', async ({ producerPage }) => {
```

### 5. Wait for Stable State

Always wait for the page to reach a stable state before assertions:

```typescript
await page.waitForLoadState('networkidle');
await page.waitForURL(/\/shots/);
```

### 6. Handle Asynchronous Operations

Use proper waits for async operations:

```typescript
// Wait for specific element
await expect(page.getByRole('button', { name: /create/i })).toBeVisible();

// Wait for navigation
await page.waitForURL(/\/shots/);

// Wait for API response
await page.waitForResponse(response => response.url().includes('/api/shots'));
```

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite)
- [Axe-core (Accessibility Testing)](https://github.com/dequelabs/axe-core)
- [Shot Builder Testing Strategy](./TESTING_STRATEGY.md) (to be created)
