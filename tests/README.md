# Playwright Tests

This directory contains end-to-end tests for the Shot Builder application using Playwright.

## Test Files

- `sidebar-summary.spec.ts` - Tests for Shot Edit modal sidebar summary (status, schedule, tags) with autosave verification (requires Firebase emulators, skipped in CI unless `VITE_USE_FIREBASE_EMULATORS=1`)
- `smoke.spec.ts` - Basic smoke tests (currently skipped, awaiting auth setup)
- `a11y.spec.ts` - Accessibility tests
- `visual.spec.ts` - Visual regression tests

## Prerequisites

### 1. Install Dependencies

```bash
npm install
npx playwright install chromium  # Or install all browsers
```

### 2. Firebase Emulators (Required for authenticated tests)

The `sidebar-summary.spec.ts` tests require Firebase Authentication and Firestore emulators.

#### Install Java (Required for Firebase Emulators)

**macOS:**
```bash
# Using Homebrew
brew install openjdk@17

# Add to PATH (add to ~/.zshrc or ~/.bash_profile)
export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"
```

**Linux:**
```bash
sudo apt-get install openjdk-17-jdk
```

**Windows:**
Download and install from [java.com](https://www.java.com)

#### Start Firebase Emulators

```bash
# Start auth and firestore emulators
firebase emulators:start --only auth,firestore
```

The emulators will run on:
- Auth: http://localhost:9099
- Firestore: http://localhost:8080

### 3. Start Dev Server

In a separate terminal:

```bash
# Start with emulator mode enabled
VITE_USE_FIREBASE_EMULATORS=1 npm run dev
```

The dev server will run on http://localhost:5173

## Running Tests

### Run all tests (requires emulators)

```bash
VITE_USE_FIREBASE_EMULATORS=1 npx playwright test
```

### Run specific test file

```bash
VITE_USE_FIREBASE_EMULATORS=1 npx playwright test tests/sidebar-summary.spec.ts
```

### Run with UI mode (recommended for development)

```bash
VITE_USE_FIREBASE_EMULATORS=1 npx playwright test --ui
```

### Run in headed mode (see browser)

```bash
VITE_USE_FIREBASE_EMULATORS=1 npx playwright test --headed
```

### Run specific browser

```bash
VITE_USE_FIREBASE_EMULATORS=1 npx playwright test --project=chromium
VITE_USE_FIREBASE_EMULATORS=1 npx playwright test --project=firefox
VITE_USE_FIREBASE_EMULATORS=1 npx playwright test --project=webkit
```

## Test Helpers

### Authentication Helper (`helpers/auth.ts`)

Provides utilities for authenticating test users with Firebase Auth emulator:

```typescript
import { authenticateTestUser, setupFirebaseEmulators } from './helpers/auth';

test.beforeEach(async ({ page }) => {
  await setupFirebaseEmulators(page);
  await authenticateTestUser(page, {
    email: 'test@example.com',
    password: 'test-password-123',
    role: 'producer',
    clientId: 'test-client'
  });
});
```

## Test Artifacts

After running tests, the following artifacts are saved in `test-results/`:

- **Screenshots** - Captured on test failure
- **Videos** - Recorded for failed tests
- **Traces** - Full execution traces for debugging

### View test traces

```bash
npx playwright show-trace test-results/<test-name>/trace.zip
```

### View HTML report

```bash
npx playwright show-report
```

## Writing New Tests

1. Create a new `.spec.ts` file in the `tests/` directory
2. Import test utilities from `@playwright/test` and `./helpers/auth`
3. Use `test.describe()` to group related tests
4. Add authentication in `beforeEach()` if needed
5. Write test assertions using Playwright's `expect()` API

Example:

```typescript
import { test, expect } from '@playwright/test';
import { authenticateTestUser, setupFirebaseEmulators } from './helpers/auth';

test.describe('My Feature', () => {
  test.beforeEach(async ({ page }) => {
    await setupFirebaseEmulators(page);
    await authenticateTestUser(page);
  });

  test('should do something', async ({ page }) => {
    await page.goto('/my-feature');
    await expect(page.locator('h1')).toHaveText('My Feature');
  });
});
```

## Troubleshooting

### Java not found error

```
Error: Process `java -version` has exited with code 1
```

**Solution:** Install Java (see Prerequisites above)

### Port already in use

```
Error: Port 9099 is already in use
```

**Solution:** Stop existing emulator processes:
```bash
lsof -ti:9099 | xargs kill -9
lsof -ti:8080 | xargs kill -9
```

### Tests timing out

- Increase timeout in `playwright.config.ts`
- Check that emulators and dev server are running
- Verify `VITE_USE_FIREBASE_EMULATORS=1` is set

### Authentication failures

- Ensure Firebase emulators are running
- Check that test user credentials match
- Verify emulator ports (9099, 8080) are accessible

## CI/CD Integration

For GitHub Actions or other CI environments:

1. Install Java in the CI environment
2. Start Firebase emulators before tests
3. Set `VITE_USE_FIREBASE_EMULATORS=1`
4. Run Playwright tests
5. Upload test artifacts as CI artifacts

Example GitHub Actions workflow snippet:

```yaml
- name: Setup Java
  uses: actions/setup-java@v3
  with:
    distribution: 'temurin'
    java-version: '17'

- name: Start Firebase Emulators
  run: |
    firebase emulators:start --only auth,firestore &
    sleep 10

- name: Run Playwright tests
  env:
    VITE_USE_FIREBASE_EMULATORS: 1
  run: npx playwright test

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-results
    path: test-results/
```

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Firebase Emulators](https://firebase.google.com/docs/emulator-suite)
- [Shot Builder Documentation](../docs/)
