import { test, expect } from '@playwright/test';

// NOTE: These tests require Firebase authentication setup
// For now, we'll skip them until auth mocking is configured

test.describe.skip('UI Smoke', () => {
  test('homepage renders and primary CTA works', async ({ page }) => {
    await page.goto('/');
    const heading = page.getByRole('heading', { name: /dashboard|home|shots/i });
    await expect(heading).toBeVisible();
    const cta = page.getByRole('button', { name: /create shot|new|add/i });
    await expect(cta).toBeEnabled();
    await cta.click();
    const dialog = page.getByRole('dialog').or(page.getByRole('heading', { name: /new shot|details/i }));
    await expect(dialog).toBeVisible();
  });
});
