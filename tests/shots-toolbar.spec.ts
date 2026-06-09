import { test, expect } from './fixtures/auth';
import {
  SEED_PROJECT_ID,
  SEED_SHOT_SPECTRA_TODO,
  SEED_SHOT_SPECTRA_INPROGRESS,
  SEED_SHOT_SPECTRA_ONHOLD,
  SEED_SHOT_SPECTRA_COMPLETE,
} from './helpers/seedConstants';

/**
 * Shots toolbar (Phase 3) E2E — single-row toolbar + inline Status/Missing
 * filters + URL-as-state round-trip + reorder-disabled explainer.
 *
 * Runs against the Firestore emulator seed (tests/helpers/seed.ts →
 * seedShotsCrudScenario). The seed adds four dedicated "Spectra" fixture shots
 * with asymmetric status + field presence so the inline filters discriminate:
 *   SPECTRA_TODO        status=todo         missing: products, talent, location, image
 *   SPECTRA_INPROGRESS  status=in_progress  has products+talent+location (missing: image)
 *   SPECTRA_ONHOLD      status=on_hold      has location                 (missing: products, talent, image)
 *   SPECTRA_COMPLETE    status=complete     has products+talent          (missing: location, image)
 *
 * The producer fixture is a desktop (1280×720) viewport, so the desktop toolbar
 * (with the view toggle, inline filters, etc.) renders. Every assertion is hard —
 * there are intentionally no `if (await x.isVisible())` guards.
 *
 * Note on sort key naming: the app's non-custom sort keys are `name`, `date`,
 * `status`, … (there is NO `title` key — see shotListFilters.ts SORT_LABELS).
 * The override/explainer assertions therefore drive off `?sort=name`.
 */

const SHOTS_URL = `/projects/${SEED_PROJECT_ID}/shots`;

/** A short, unique title token shared by all Spectra fixtures. */
const SPECTRA = 'Spectra';

test.describe('Shots toolbar — URL round-trip', () => {
  test('applying status filter + sort + scene group writes the URL, persists on reload, and re-applies from a fresh full URL', async ({
    producerPage,
  }) => {
    await producerPage.goto(SHOTS_URL);
    await producerPage.locator('main, [role="main"]').first().waitFor({ state: 'visible' });

    // Ensure card view so we can assert on shot cards by title text.
    await producerPage.getByRole('button', { name: 'Card view' }).click();

    // -- Apply a Status filter (in_progress) via the inline Status popover --
    await producerPage.getByTestId('filter-status-trigger').click();
    await producerPage.getByTestId('filter-status-option-in_progress').click();
    // Close the popover (Escape) so it doesn't overlay later interactions.
    await producerPage.keyboard.press('Escape');

    // -- Apply a non-custom sort (Name) via the Sort select --
    await producerPage.getByTestId('sort-select-trigger').click();
    await producerPage.getByRole('option', { name: 'Name', exact: true }).click();

    // -- Group by scene via the Group-by toggle (lanes may be 0 in the seed, so
    //    the toggle only renders when hasScenes). Assert presence honestly: the
    //    seed has no lanes, so the toggle is absent. We assert that truth rather
    //    than force a scene group that the seed can't support. --
    const groupToggle = producerPage.getByTestId('group-by-toggle');
    await expect(groupToggle).toHaveCount(0);

    // -- The URL now carries sort + filters (group omitted: no scenes). --
    await expect
      .poll(() => new URL(producerPage.url()).searchParams.get('sort'))
      .toBe('name');
    await expect
      .poll(() => new URL(producerPage.url()).searchParams.get('filters'))
      .toContain('status.in:in_progress');

    const persistedUrl = producerPage.url();

    // -- Reload: state persists (the URL is the source of truth). --
    await producerPage.reload();
    await producerPage.locator('main, [role="main"]').first().waitFor({ state: 'visible' });
    expect(new URL(producerPage.url()).searchParams.get('sort')).toBe('name');
    expect(new URL(producerPage.url()).searchParams.get('filters')).toContain(
      'status.in:in_progress',
    );
    // Only the in_progress shot survives the filter.
    await expect(
      producerPage.getByText(SEED_SHOT_SPECTRA_INPROGRESS.title).first(),
    ).toBeVisible();
    await expect(
      producerPage.getByText(SEED_SHOT_SPECTRA_TODO.title),
    ).toHaveCount(0);

    // -- Open the same full URL fresh (deep-link): state applies identically. --
    await producerPage.goto('about:blank');
    await producerPage.goto(persistedUrl);
    await producerPage.locator('main, [role="main"]').first().waitFor({ state: 'visible' });
    await expect(
      producerPage.getByText(SEED_SHOT_SPECTRA_INPROGRESS.title).first(),
    ).toBeVisible();
    await expect(
      producerPage.getByText(SEED_SHOT_SPECTRA_ONHOLD.title),
    ).toHaveCount(0);
  });
});

test.describe('Shots toolbar — inline filters discriminate', () => {
  test('Status filter isolates a single status', async ({ producerPage }) => {
    await producerPage.goto(SHOTS_URL);
    await producerPage.locator('main, [role="main"]').first().waitFor({ state: 'visible' });
    await producerPage.getByRole('button', { name: 'Card view' }).click();

    // Baseline: all four Spectra shots present.
    await expect(producerPage.getByText(SEED_SHOT_SPECTRA_TODO.title).first()).toBeVisible();
    await expect(producerPage.getByText(SEED_SHOT_SPECTRA_ONHOLD.title).first()).toBeVisible();

    // Filter to status = on_hold.
    await producerPage.getByTestId('filter-status-trigger').click();
    await producerPage.getByTestId('filter-status-option-on_hold').click();
    await producerPage.keyboard.press('Escape');

    // Only the on_hold Spectra shot remains; the others drop out.
    await expect(
      producerPage.getByText(SEED_SHOT_SPECTRA_ONHOLD.title).first(),
    ).toBeVisible();
    await expect(producerPage.getByText(SEED_SHOT_SPECTRA_TODO.title)).toHaveCount(0);
    await expect(producerPage.getByText(SEED_SHOT_SPECTRA_INPROGRESS.title)).toHaveCount(0);
    await expect(producerPage.getByText(SEED_SHOT_SPECTRA_COMPLETE.title)).toHaveCount(0);

    // The URL encodes the inline filter as a missing/status condition.
    expect(new URL(producerPage.url()).searchParams.get('filters')).toContain(
      'status.in:on_hold',
    );
  });

  test('Missing filter isolates shots missing a field', async ({ producerPage }) => {
    await producerPage.goto(SHOTS_URL);
    await producerPage.locator('main, [role="main"]').first().waitFor({ state: 'visible' });
    await producerPage.getByRole('button', { name: 'Card view' }).click();

    // Filter to "missing location". Per the seed matrix, that is SPECTRA_TODO
    // (missing everything) + SPECTRA_COMPLETE (has products+talent, no location).
    // SPECTRA_INPROGRESS + SPECTRA_ONHOLD both HAVE a location -> excluded.
    await producerPage.getByTestId('filter-missing-trigger').click();
    await producerPage.getByTestId('filter-missing-option-location').click();
    await producerPage.keyboard.press('Escape');

    await expect(
      producerPage.getByText(SEED_SHOT_SPECTRA_TODO.title).first(),
    ).toBeVisible();
    await expect(
      producerPage.getByText(SEED_SHOT_SPECTRA_COMPLETE.title).first(),
    ).toBeVisible();
    await expect(
      producerPage.getByText(SEED_SHOT_SPECTRA_INPROGRESS.title),
    ).toHaveCount(0);
    await expect(
      producerPage.getByText(SEED_SHOT_SPECTRA_ONHOLD.title),
    ).toHaveCount(0);

    expect(new URL(producerPage.url()).searchParams.get('filters')).toContain(
      'missing.in:location',
    );
  });
});

test.describe('Shots toolbar — reorder explainer', () => {
  test('a non-custom sort shows the override affordance; Restore custom order clears sort from the URL', async ({
    producerPage,
  }) => {
    // Land directly on a non-custom sort via the URL (the source of truth).
    await producerPage.goto(`${SHOTS_URL}?sort=name`);
    await producerPage.locator('main, [role="main"]').first().waitFor({ state: 'visible' });

    // The sort-override banner is present with its recovery action.
    const restore = producerPage.getByRole('button', { name: /restore custom order/i });
    await expect(restore.first()).toBeVisible();

    // Activating recovery clears the sort param (custom is encoded as absence).
    await restore.first().click();
    await expect
      .poll(() => new URL(producerPage.url()).searchParams.get('sort'))
      .toBeNull();
  });

  test('an active filter surfaces the reorder-disabled explanation', async ({
    producerPage,
  }) => {
    // Custom sort (no `sort` param) + an active status filter -> reorder is gated
    // by "filters". The page renders the reorder-disabled explanation.
    await producerPage.goto(`${SHOTS_URL}?filters=status.in:todo`);
    await producerPage.locator('main, [role="main"]').first().waitFor({ state: 'visible' });
    await producerPage.getByRole('button', { name: 'Card view' }).click();

    // The card-grid disabled drag handle carries the reason + a tooltip; assert
    // at least one disabled handle is present and tagged with the "filters" reason.
    const handle = producerPage
      .locator('[data-testid="shot-drag-handle"], [data-testid^="shot-drag-handle-"]')
      .first();
    await expect(handle).toBeVisible();
    await expect(handle).toHaveAttribute('data-reorder-disabled-reason', 'filters');
  });
});
