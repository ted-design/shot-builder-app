import { test, expect } from '@playwright/test';

// NOTE: Visual tests require Firebase authentication setup
// For now, we'll skip them until auth mocking is configured

test.skip('shot grid baseline visual', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(200);
  await expect(page.locator('[data-test="shot-grid"]')).toHaveScreenshot('shot-grid.png');
});
