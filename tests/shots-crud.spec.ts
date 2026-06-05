import { test, expect } from './fixtures/auth';
import {
  SEED_PROJECT_ID,
  SEED_SHOT_AURORA,
  SEED_SHOT_BOREALIS,
  SEED_SHOT_EDITABLE,
} from './helpers/seedConstants';

/**
 * Shot CRUD E2E tests — exercises the real, project-scoped shot lifecycle
 * against the Firestore emulator seed (see tests/helpers/seed.ts +
 * tests/global.setup.ts → seedShotsCrudScenario).
 *
 * Every test hard-asserts against the actual app UI. There are intentionally no
 * `if (await x.isVisible())` guards: a guarded assertion on a route/selector that
 * no longer exists "passes" by doing nothing (a false green). If the seed or a
 * selector regresses, these tests must fail loudly.
 *
 * Notes on the real app (verified against src-vnext):
 * - Shots live at `/projects/:id/shots` (there is NO top-level `/shots` route).
 * - Editing/deleting happen on the detail page (`/projects/:id/shots/:sid`) and
 *   via the per-shot "Shot actions" menu — there is no "Edit shot" dialog.
 * - The producer fixture runs at a 1280×720 (desktop) viewport.
 */

const SHOTS_URL = `/projects/${SEED_PROJECT_ID}/shots`;

test.describe('Shot CRUD Operations', () => {
  // ── READ (list) ──────────────────────────────────────────────────────────
  // Keystone: proves the seed landed in the partition the app reads, the route
  // resolves, the producer storageState is authenticated, and the shot-list
  // query shape (deleted:false + date) surfaces the seeded shots.
  test('producer sees seeded shots in the project shot list', async ({ producerPage }) => {
    await producerPage.goto(SHOTS_URL);
    await producerPage.locator('main, [role="main"]').first().waitFor({ state: 'visible' });

    await expect(producerPage.getByText(SEED_SHOT_AURORA.title).first()).toBeVisible();
    await expect(producerPage.getByText(SEED_SHOT_BOREALIS.title).first()).toBeVisible();
  });

  // ── CREATE ───────────────────────────────────────────────────────────────
  test('producer can create a new shot', async ({ producerPage }) => {
    await producerPage.goto(SHOTS_URL);
    await producerPage.locator('main, [role="main"]').first().waitFor({ state: 'visible' });

    // Card view so we can assert on the shot card (not the success toast, which
    // also renders the title — asserting the card proves list membership).
    await producerPage.getByRole('button', { name: 'Card view' }).click();

    const newShotButton = producerPage.getByRole('button', { name: 'New Shot' });
    await expect(newShotButton).toBeVisible();
    await newShotButton.click();

    const dialog = producerPage.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const title = `E2E Create Shot ${Date.now()}`;
    await dialog.getByTestId('shot-title-input').fill(title);
    await dialog.getByRole('button', { name: 'Create', exact: true }).click();

    await expect(dialog).not.toBeVisible();
    await expect(
      producerPage.locator('[data-testid="shot-card"]', { hasText: title }),
    ).toBeVisible();
  });

  // ── READ (detail, deep-link) ──────────────────────────────────────────────
  test('producer can open a shot detail page', async ({ producerPage }) => {
    await producerPage.goto(`${SHOTS_URL}/${SEED_SHOT_AURORA.id}`);

    // "Back to Shots" only renders on the detail page — confirms we did not
    // land on NotFoundPage.
    await expect(producerPage.getByRole('button', { name: /back to shots/i })).toBeVisible();
    await expect(producerPage.getByText(SEED_SHOT_AURORA.title).first()).toBeVisible();
  });

  // ── FILTER ────────────────────────────────────────────────────────────────
  test('producer can filter shots by search', async ({ producerPage }) => {
    await producerPage.goto(SHOTS_URL);
    await producerPage.getByText(SEED_SHOT_BOREALIS.title).first().waitFor({ state: 'visible' });

    await producerPage.getByPlaceholder(/search shots/i).fill('Aurora');

    // The matching shot stays; the non-matching one is removed from the list.
    await expect(producerPage.getByText(SEED_SHOT_AURORA.title).first()).toBeVisible();
    await expect(producerPage.getByText(SEED_SHOT_BOREALIS.title)).toHaveCount(0);
  });

  // ── UPDATE (inline edit on the detail page) ───────────────────────────────
  // Targets the dedicated editable seed shot (never read-asserted elsewhere) and
  // renames it to a fresh unique value, so the test is safe under parallel runs
  // and retries.
  test('producer can rename a shot inline', async ({ producerPage }) => {
    await producerPage.goto(`${SHOTS_URL}/${SEED_SHOT_EDITABLE.id}`);
    await expect(producerPage.getByRole('button', { name: /back to shots/i })).toBeVisible();

    const titleEdit = producerPage.getByTestId('shot-title-edit');
    await expect(titleEdit).toBeVisible();
    await titleEdit.click();

    const newTitle = `Edited Seed Shot ${Date.now()}`;
    const input = producerPage.getByTestId('shot-title-edit');
    await input.fill(newTitle);
    await input.press('Enter');

    await expect(producerPage.getByText(newTitle).first()).toBeVisible();
  });

  // ── DELETE (create-then-delete via the per-shot actions menu) ──────────────
  // Self-contained: creates its own uniquely-titled shot so it never removes a
  // seeded shot other tests rely on. Forces card view so the per-card "Shot
  // actions" kebab is present.
  test('producer can delete a shot', async ({ producerPage }) => {
    await producerPage.goto(SHOTS_URL);
    await producerPage.locator('main, [role="main"]').first().waitFor({ state: 'visible' });

    // Ensure card view (the per-card actions menu lives on the ShotCard).
    await producerPage.getByRole('button', { name: 'Card view' }).click();

    // Create the shot to delete.
    await producerPage.getByRole('button', { name: 'New Shot' }).click();
    const dialog = producerPage.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const title = `E2E Delete Shot ${Date.now()}`;
    await dialog.getByTestId('shot-title-input').fill(title);
    await dialog.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(dialog).not.toBeVisible();

    const card = producerPage.locator('[data-testid="shot-card"]', { hasText: title });
    await expect(card).toBeVisible();

    // Open the per-shot actions menu and choose delete.
    await card.getByRole('button', { name: /shot actions/i }).click();
    await producerPage.getByRole('menuitem', { name: /delete shot/i }).click();

    // Confirm the destructive dialog (requires typing DELETE).
    const confirm = producerPage.getByRole('dialog');
    await expect(confirm).toBeVisible();
    await confirm.getByPlaceholder(/type delete/i).fill('DELETE');
    await confirm.getByRole('button', { name: 'Delete shot', exact: true }).click();

    // Soft-deleted shots drop out of the active list.
    await expect(
      producerPage.locator('[data-testid="shot-card"]', { hasText: title }),
    ).toHaveCount(0);
  });
});
