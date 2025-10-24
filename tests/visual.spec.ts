import { test, expect } from '@playwright/test';
test('shot grid baseline visual', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(200);
  await expect(page.locator('[data-test="shot-grid"]')).toHaveScreenshot('shot-grid.png');
});
