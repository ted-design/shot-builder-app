import { test, expect } from './fixtures/auth';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility tests using axe-core.
 * Tests WCAG 2.0 Level A and AA compliance.
 */

test.describe('Accessibility Tests', () => {
  test('dashboard page has no critical a11y violations', async ({ producerPage }) => {
    await producerPage.goto('/');
    await producerPage.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page: producerPage })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    // Log violations for debugging
    if (results.violations.length > 0) {
      console.log('Accessibility violations found:');
      results.violations.forEach(violation => {
        console.log(`- ${violation.id}: ${violation.description}`);
        console.log(`  Impact: ${violation.impact}`);
        console.log(`  Nodes: ${violation.nodes.length}`);
      });
    }

    expect(results.violations).toEqual([]);
  });

  test('products page has no critical a11y violations', async ({ producerPage }) => {
    await producerPage.goto('/products');
    await producerPage.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page: producerPage })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    if (results.violations.length > 0) {
      console.log('Accessibility violations found on Products page:');
      results.violations.forEach(violation => {
        console.log(`- ${violation.id}: ${violation.description}`);
      });
    }

    expect(results.violations).toEqual([]);
  });

  test('shots page has no critical a11y violations', async ({ producerPage }) => {
    // First need to have an active project
    await producerPage.goto('/');
    await producerPage.waitForLoadState('networkidle');

    // Try to navigate to shots
    await producerPage.goto('/shots');
    await producerPage.waitForLoadState('networkidle');

    const currentUrl = producerPage.url();

    // Only run a11y test if we successfully loaded shots page
    if (currentUrl.includes('/shots')) {
      const results = await new AxeBuilder({ page: producerPage })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      if (results.violations.length > 0) {
        console.log('Accessibility violations found on Shots page:');
        results.violations.forEach(violation => {
          console.log(`- ${violation.id}: ${violation.description}`);
        });
      }

      expect(results.violations).toEqual([]);
    }
  });

  test('admin page has no critical a11y violations', async ({ adminPage }) => {
    await adminPage.goto('/admin');
    await adminPage.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page: adminPage })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    if (results.violations.length > 0) {
      console.log('Accessibility violations found on Admin page:');
      results.violations.forEach(violation => {
        console.log(`- ${violation.id}: ${violation.description}`);
      });
    }

    expect(results.violations).toEqual([]);
  });
});
