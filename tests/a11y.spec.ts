import { test, expect } from './fixtures/auth';
import AxeBuilder from '@axe-core/playwright';
import { SEED_PROJECT_ID } from './helpers/seedConstants';

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
    // Shots are project-scoped (/projects/:id/shots) — go straight to the seeded
    // project's shot list, mirroring shots-toolbar.spec / shots-crud.spec. The
    // legacy top-level /shots route no longer renders the list (the redesign
    // moved it under the project), so the old goto('/shots') timed out waiting
    // for <main> and the axe gate never ran.
    await producerPage.goto(`/projects/${SEED_PROJECT_ID}/shots`);
    await producerPage.locator('main, [role="main"]').first().waitFor({ state: 'visible', timeout: 10000 });

    // Hardening (Phase 7 Decision 7): fail loudly if the shot list did not land,
    // so the axe gate below can never silently no-op.
    expect(producerPage.url()).toContain(`/projects/${SEED_PROJECT_ID}/shots`);

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
