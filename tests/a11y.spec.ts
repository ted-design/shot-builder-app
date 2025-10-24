import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// NOTE: A11y tests require Firebase authentication setup
// For now, we'll skip them until auth mocking is configured

test.skip('home has no critical a11y violations', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
});
