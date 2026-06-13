import { test, expect } from './fixtures/auth';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility tests using axe-core.
 *
 * Phase 7 scope (Decision 4): this suite is un-quarantined as the guard for the
 * contrast token fix and is therefore SCOPED TO THE `color-contrast` RULE ONLY.
 * The phase owns the muted/subtle text-token contrast fix; pre-existing
 * NON-contrast violations (link-name, region, form labels, aria, etc.) are
 * tracked as Phase 8 rows, not Phase 7 blockers — so the gate tests exactly
 * what this phase fixes and cannot red on unrelated debt.
 *
 * Phase 8 follow-up (owner: Phase 8): broaden back to the full
 * `.withTags(['wcag2a','wcag2aa'])` ruleset once the pre-existing non-contrast
 * violations are inventoried + fixed. See tests/QUARANTINE.md.
 */

test.describe('Accessibility Tests', () => {
  test('dashboard page has no critical a11y violations', async ({ producerPage }) => {
    await producerPage.goto('/');
    // Wait for page content to be ready
    await producerPage.locator('nav, [role="navigation"]').first().waitFor({ state: 'visible', timeout: 10000 });

    const results = await new AxeBuilder({ page: producerPage })
      .withRules(['color-contrast'])
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
    // Wait for page content to be ready
    await producerPage.locator('main, [role="main"]').first().waitFor({ state: 'visible', timeout: 10000 });

    const results = await new AxeBuilder({ page: producerPage })
      .withRules(['color-contrast'])
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
    await producerPage.locator('nav, [role="navigation"]').first().waitFor({ state: 'visible', timeout: 10000 });

    // Try to navigate to shots
    await producerPage.goto('/shots');
    await producerPage.locator('main, [role="main"]').first().waitFor({ state: 'visible', timeout: 10000 });

    const currentUrl = producerPage.url();

    // Hardening (Phase 7 Decision 7): fail loudly if /shots navigation did not
    // land — without this the conditional below silently no-ops and the axe
    // gate passes without ever running, defeating the un-quarantine.
    expect(currentUrl).toContain('/shots');

    // Only run a11y test if we successfully loaded shots page
    if (currentUrl.includes('/shots')) {
      const results = await new AxeBuilder({ page: producerPage })
        .withRules(['color-contrast'])
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
    // Wait for admin page content to be ready
    await adminPage.locator('main, [role="main"]').first().waitFor({ state: 'visible', timeout: 10000 });

    const results = await new AxeBuilder({ page: adminPage })
      .withRules(['color-contrast'])
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
