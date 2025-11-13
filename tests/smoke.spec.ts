import { test, expect } from './fixtures/auth';

/**
 * Smoke tests for Shot Builder app.
 * These tests verify core functionality with authenticated users.
 */

test.describe('UI Smoke Tests', () => {
  test('producer can access dashboard and create shot', async ({ producerPage }) => {
    // Navigate to app (should redirect to projects/dashboard)
    await producerPage.goto('/');

    // Wait for navigation to be visible
    await producerPage.locator('nav, [role="navigation"]').first().waitFor({ state: 'visible', timeout: 10000 });

    // Should be on an authenticated page (projects, dashboard, or shots)
    const currentUrl = producerPage.url();
    expect(currentUrl).toMatch(/\/(shots|dashboard|projects)/);

    // Look for navigation elements
    const nav = producerPage.locator('nav, [role="navigation"]');
    await expect(nav).toBeVisible();

    // Try to find a "Create" or "New Shot" button
    const createButton = producerPage.getByRole('button', { name: /create|new shot|add shot/i }).first();

    if (await createButton.isVisible()) {
      await expect(createButton).toBeEnabled();

      // Click to open create dialog
      await createButton.click();

      // Look for modal/dialog
      const dialog = producerPage.getByRole('dialog').or(
        producerPage.locator('[role="dialog"]')
      ).or(
        producerPage.getByRole('heading', { name: /new shot|shot details|create shot/i })
      );

      await expect(dialog.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('admin can access admin page', async ({ adminPage }) => {
    // Try to navigate to admin page
    await adminPage.goto('/admin');

    // Wait for admin content to be visible
    await adminPage.locator('main, [role="main"]').first().waitFor({ state: 'visible', timeout: 10000 });

    // Should be on admin page (not redirected away)
    expect(adminPage.url()).toContain('/admin');

    // Look for admin-specific elements
    const heading = adminPage.getByRole('heading', { name: /admin|user management|settings/i }).first();
    await expect(heading).toBeVisible();
  });

  test('producer can navigate between pages', async ({ producerPage }) => {
    // Start at home
    await producerPage.goto('/');
    await producerPage.locator('nav, [role="navigation"]').first().waitFor({ state: 'visible', timeout: 10000 });

    // Navigate to products page
    const productsLink = producerPage.getByRole('link', { name: /products/i }).first();
    if (await productsLink.isVisible()) {
      await productsLink.click();
      // Wait for products page content
      await producerPage.locator('main, [role="main"]').first().waitFor({ state: 'visible', timeout: 10000 });
      expect(producerPage.url()).toContain('/products');
    }

    // Navigate to talent page
    const talentLink = producerPage.getByRole('link', { name: /talent/i }).first();
    if (await talentLink.isVisible()) {
      await talentLink.click();
      // Wait for talent page content
      await producerPage.locator('main, [role="main"]').first().waitFor({ state: 'visible', timeout: 10000 });
      expect(producerPage.url()).toContain('/talent');
    }
  });

  test('viewer has read-only access', async ({ viewerPage }) => {
    await viewerPage.goto('/');
    // Wait for navigation to be visible
    await viewerPage.locator('nav, [role="navigation"]').first().waitFor({ state: 'visible', timeout: 10000 });

    // Viewer should be able to view content
    const currentUrl = viewerPage.url();
    expect(currentUrl).toMatch(/\/(shots|dashboard|projects)/);

    // But should not see create/edit buttons (or they should be disabled)
    const createButtons = viewerPage.getByRole('button', { name: /create|new|add/i });
    const count = await createButtons.count();

    // Either no create buttons visible, or they're disabled
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const button = createButtons.nth(i);
        if (await button.isVisible()) {
          await expect(button).toBeDisabled();
        }
      }
    }
  });
});
