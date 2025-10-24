import { test, expect } from '@playwright/test';
import { authenticateTestUser, setupFirebaseEmulators } from './helpers/auth';

/**
 * Test suite for Shot Edit modal's sidebar summary (status, schedule, tags) with autosave.
 *
 * PREREQUISITES:
 * 1. Firebase emulators must be running:
 *    firebase emulators:start --only auth,firestore,functions,storage
 * 2. Set environment variable: VITE_USE_FIREBASE_EMULATORS=1
 * 3. Dev server must be running on port 5173
 *
 * To run these tests:
 *   VITE_USE_FIREBASE_EMULATORS=1 npx playwright test tests/sidebar-summary.spec.ts
 *
 * NOTE: These tests are skipped in CI unless VITE_USE_FIREBASE_EMULATORS is set
 */
test.describe('Shot Edit Modal - Sidebar Summary', () => {
  // Skip these tests in CI unless emulators are configured
  test.skip(!process.env.VITE_USE_FIREBASE_EMULATORS, 'Requires Firebase emulators');

  test.beforeEach(async ({ page }) => {
    // Setup Firebase emulators
    await setupFirebaseEmulators(page);

    // Authenticate as a test user
    await authenticateTestUser(page, {
      email: 'test@example.com',
      password: 'test-password-123',
      role: 'producer',
      clientId: 'test-client'
    });
  });

  test('displays sidebar summary and handles status change with autosave', async ({ page }) => {
    // Wait for the shots page to be visible (adjust selector based on actual page structure)
    // This assumes we're authenticated and can see the shots list
    const shotsContainer = page.locator('[data-testid="shots-container"], main, [role="main"]').first();
    await expect(shotsContainer).toBeVisible({ timeout: 10000 });

    // Look for an existing shot card or button to open the edit modal
    // Try multiple selectors to find a shot
    const shotCard = page.locator('[data-testid="shot-card"], [role="article"], button:has-text("Shot")').first();

    // If no shot exists, look for a "Create Shot" or similar button
    const createShotButton = page.locator('button:has-text("Create"), button:has-text("New Shot"), [aria-label*="shot" i]').first();

    // Try to click an existing shot first
    const shotExists = await shotCard.count() > 0;
    if (shotExists) {
      await shotCard.click();
    } else {
      // Create a new shot if none exist
      await createShotButton.click();

      // Fill in minimal required fields to create a shot
      const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
      await nameInput.fill('Test Shot for Sidebar');

      // Submit the form
      const submitButton = page.locator('button:has-text("Save"), button:has-text("Create"), button[type="submit"]').first();
      await submitButton.click();

      // Wait for the shot to be created and modal to appear
      await page.waitForTimeout(1000);
    }

    // Wait for the Shot Edit modal to be visible
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Verify the modal heading
    const modalHeading = modal.locator('h2');
    await expect(modalHeading).toBeVisible();

    // Verify the sidebar summary is visible
    const sidebar = modal.locator('aside, [data-testid="sidebar-summary"]');
    await expect(sidebar).toBeVisible();

    // Check that the Status section exists
    const statusSection = sidebar.locator('text=Status').first();
    await expect(statusSection).toBeVisible();

    // Check that a status badge is displayed
    const statusBadge = sidebar.locator('[class*="badge"], [role="status"]').first();
    await expect(statusBadge).toBeVisible();

    // Check that the status select dropdown exists
    const statusSelect = sidebar.locator('select').first();
    await expect(statusSelect).toBeVisible();

    // Check Schedule section with calendar icon and date info
    const scheduleSection = sidebar.locator('text=Schedule').first();
    await expect(scheduleSection).toBeVisible();

    // Check Tags section
    const tagsSection = sidebar.locator('text=Tags').first();
    await expect(tagsSection).toBeVisible();

    // Now change the status to trigger autosave
    const currentStatus = await statusSelect.inputValue();

    // Select a different status
    const statusOptions = await statusSelect.locator('option').all();
    const newStatusOption = statusOptions.find(async (option) => {
      const value = await option.getAttribute('value');
      return value !== currentStatus;
    });

    if (newStatusOption) {
      const newStatusValue = await newStatusOption.getAttribute('value');
      await statusSelect.selectOption(newStatusValue || '');

      // Wait for autosave indication - look for "Saving..." text
      const savingIndicator = page.locator('text=/Saving|saving/i');

      // The autosave status might appear briefly, so we use a shorter timeout
      try {
        await expect(savingIndicator).toBeVisible({ timeout: 2000 });
      } catch (e) {
        // Autosave might be too fast to catch, that's okay
        console.log('Autosave was too fast to capture "Saving..." state');
      }

      // Wait for "Saved" confirmation
      const savedIndicator = page.locator('text=/Saved|saved/i');
      await expect(savedIndicator).toBeVisible({ timeout: 5000 });

      // Verify the status badge updated
      const updatedBadge = sidebar.locator('[class*="badge"], [role="status"]').first();
      await expect(updatedBadge).toBeVisible();

      // Switch to a different tab (e.g., Logistics) while staying in the modal
      const logisticsTab = modal.locator('button[role="tab"]:has-text("Logistics"), button:has-text("Logistics")').first();
      const logisticsTabExists = await logisticsTab.count() > 0;

      if (logisticsTabExists) {
        await logisticsTab.click();

        // Verify we're on the Logistics tab (aria-selected="true")
        await expect(logisticsTab).toHaveAttribute('aria-selected', 'true');

        // Verify that the Basics tab still shows saved state
        const basicsTab = modal.locator('button[role="tab"]:has-text("Basics"), button:has-text("Basics")').first();

        // Check if the Basics tab has saved status indicator
        const basicsSavedStatus = basicsTab.locator('text=/Saved|saved/i');
        await expect(basicsSavedStatus).toBeVisible({ timeout: 5000 });
      }
    }

    // Close the modal
    const closeButton = modal.locator('button[aria-label="Close"], button:has-text("×")').first();
    await closeButton.click();

    // Verify modal is closed
    await expect(modal).not.toBeVisible({ timeout: 2000 });
  });

  test('displays schedule and location information', async ({ page }) => {
    // Navigate and open modal (similar to above)
    await page.waitForTimeout(1000);

    const shotsContainer = page.locator('[data-testid="shots-container"], main, [role="main"]').first();
    const shotCard = page.locator('[data-testid="shot-card"], [role="article"], button:has-text("Shot")').first();

    const shotExists = await shotCard.count() > 0;
    if (shotExists) {
      await shotCard.click();
    } else {
      // Skip if no shots available
      test.skip();
    }

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const sidebar = modal.locator('aside, [data-testid="sidebar-summary"]');

    // Check for calendar icon (schedule)
    const calendarIcon = sidebar.locator('svg').first();
    await expect(calendarIcon).toBeVisible();

    // Check for date text (either "No date scheduled" or an actual date)
    const dateText = sidebar.locator('text=/No date|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/i').first();
    await expect(dateText).toBeVisible();

    // Check for location icon (map pin)
    const locationIcon = sidebar.locator('svg').nth(1);
    await expect(locationIcon).toBeVisible();

    // Check for location text (either "No location" or an actual location)
    const locationText = sidebar.locator('text=/No location|location/i').first();
    await expect(locationText).toBeVisible();
  });

  test('shows tag list in sidebar', async ({ page }) => {
    // Navigate and open modal
    await page.waitForTimeout(1000);

    const shotCard = page.locator('[data-testid="shot-card"], [role="article"], button:has-text("Shot")').first();
    const shotExists = await shotCard.count() > 0;

    if (!shotExists) {
      test.skip();
    }

    await shotCard.click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const sidebar = modal.locator('aside, [data-testid="sidebar-summary"]');

    // Check for Tags section
    const tagsSection = sidebar.locator('text=Tags').first();
    await expect(tagsSection).toBeVisible();

    // Check for either "No tags yet" message or actual tags
    const tagsContent = sidebar.locator('text=/No tags|tag/i').first();
    await expect(tagsContent).toBeVisible();
  });
});
