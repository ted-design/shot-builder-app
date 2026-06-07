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

  // Un-fixme'd 2026-06-06: the prior assertion was a stale selector, not a
  // seed/data gap. AdminPage renders fine for the emulator admin (the users read
  // rule is `clientMatches && isAuthed`, and the admin user carries
  // clientId='test-client'), but its heading is `<h1>Team</h1>` (PageHeader
  // title="Team"), not /admin|user management|settings/. Assert the real admin
  // surface instead. RequireRole(['admin']) gates /admin, so reaching it + seeing
  // the admin-only "Invite User" action proves admin access (not just any page).
  test('admin can access admin page', async ({ adminPage }) => {
    await adminPage.goto('/admin');

    // Wait for admin content to be visible.
    await adminPage.locator('main, [role="main"]').first().waitFor({ state: 'visible', timeout: 10000 });

    // Should be on the admin page (a non-admin would be redirected by RequireRole).
    expect(adminPage.url()).toContain('/admin');

    // The admin page header ("Team") + the admin-only "Invite User" action.
    // Two "Invite User" buttons render (the PageHeader action + the TeamRosterTab
    // empty-state CTA when the roster is empty, as it is in the emulator), so
    // scope to the first to avoid a strict-mode match — either one proves the
    // admin surface rendered.
    await expect(
      adminPage.getByRole('heading', { name: /team/i }).first(),
    ).toBeVisible();
    await expect(
      adminPage.getByRole('button', { name: /invite user/i }).first(),
    ).toBeVisible();
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
