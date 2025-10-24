import { test, expect } from '@playwright/test';
test.describe('UI Smoke', () => {
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
