import { test, expect } from './fixtures/auth';
import {
  SEED_PROJECT_ID,
  SEED_PULL,
  SEED_PULL_ITEM,
} from './helpers/seedConstants';

/**
 * Pull Sheet CRUD E2E tests — exercises the real, project-scoped pull lifecycle
 * against the Firestore emulator seed (see tests/helpers/seed.ts +
 * tests/global.setup.ts → seedPullsCrudScenario).
 *
 * Every test hard-asserts against the actual app UI. There are intentionally no
 * `if (await x.isVisible())` / `if (count > 0)` guards: a guarded assertion on a
 * route/selector that no longer exists "passes" by doing nothing (a false green).
 * If the seed, a route, or a selector regresses, these tests MUST fail loudly.
 *
 * Notes on the real app (verified against src-vnext):
 * - Pulls live at `/projects/:id/pulls` (list) and `/projects/:id/pulls/:pid`
 *   (detail; the detail route param is `pid`). There is NO top-level `/pulls`.
 * - The seeded pull (`SEED_PULL`) carries ONE item (`SEED_PULL_ITEM`) with one
 *   size 'M'. usePulls applies no where()/orderBy filters, so the doc is visible.
 * - Status + per-item fulfillment are Radix <Select>s (role="combobox"): open the
 *   trigger, then click the option by role/name. The header status combobox and
 *   the item FulfillmentToggle combobox are disambiguated by scoping (the item
 *   one lives inside the item Card, next to the family name).
 * - RBAC: canManagePulls = admin|producer|warehouse (status/share/create);
 *   canFulfillPulls = admin|warehouse ONLY (producer CANNOT fulfill). The detail
 *   page also gates edit on `!isMobile` (canEdit), so a DESKTOP viewport is
 *   required — set explicitly below in addition to the fixture's 1280×720.
 */

// Force a desktop viewport: PullDetailPage's canEdit = canManagePulls && !isMobile,
// so status-edit + Share only render above the mobile breakpoint.
test.use({ viewport: { width: 1280, height: 800 } });

const PULLS_URL = `/projects/${SEED_PROJECT_ID}/pulls`;
const PULL_DETAIL_URL = `${PULLS_URL}/${SEED_PULL.id}`;
const SEEDED_CARD = `[data-testid="pull-card-${SEED_PULL.id}"]`;

test.describe('Pull Sheet CRUD Operations', () => {
  // Tests 4 (status), 5 (share), and 7 (fulfillment) all MUTATE the single shared
  // seeded pull doc. playwright.config has fullyParallel:true, which would otherwise
  // distribute tests in this file across workers and let those writes race on the
  // same doc (stale onSnapshot / optimistic churn). Serial mode pins the file to one
  // worker in declared order; the two spec FILES still parallelize across workers.
  test.describe.configure({ mode: 'serial' });

  // ── READ (list) ──────────────────────────────────────────────────────────
  // Keystone: proves the seed landed in the partition the app reads, the route
  // resolves, the producer storageState is authenticated, and usePulls surfaces
  // the seeded pull. Fails if the seed or route regresses.
  test('producer sees the seeded pull in the project pull list', async ({ producerPage }) => {
    await producerPage.goto(PULLS_URL);
    await producerPage.locator('main, [role="main"]').first().waitFor({ state: 'visible' });

    await expect(producerPage.getByRole('heading', { name: 'Pull Sheets' })).toBeVisible();

    const card = producerPage.locator(SEEDED_CARD);
    await expect(card).toBeVisible();
    await expect(card).toContainText(SEED_PULL.name);
  });

  // ── CREATE ───────────────────────────────────────────────────────────────
  // Uses a fixed unique token (not a timestamp) so the assertion is deterministic
  // and the created pull never collides with the seeded "Helios Day 1 Pull".
  // The seed clears the pulls subcollection on every global setup, so this
  // created pull is wiped before the next run.
  test('producer can create a new pull sheet', async ({ producerPage }) => {
    await producerPage.goto(PULLS_URL);
    await producerPage.locator('main, [role="main"]').first().waitFor({ state: 'visible' });

    await producerPage.getByRole('button', { name: 'New Pull Sheet' }).click();

    const dialog = producerPage.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const newName = 'E2E Created Pull Vega';
    const nameInput = dialog.locator('#pull-name');
    await nameInput.fill(newName);
    await dialog.getByRole('button', { name: 'Create', exact: true }).click();

    await expect(dialog).not.toBeVisible();

    // Assert the created pull's card appears in the list (not a toast).
    await expect(
      producerPage.locator('[data-testid^="pull-card-"]', { hasText: newName }),
    ).toBeVisible();
  });

  // ── READ (detail, deep-link) ──────────────────────────────────────────────
  // Deep-links straight to the seeded pull. Asserts the name heading, the seeded
  // item's family name (item survived mapItem — familyId non-empty), and the
  // "Items (1)" label. Fails if the route param/seed/mapItem path regresses.
  test('producer can open the seeded pull detail page', async ({ producerPage }) => {
    await producerPage.goto(PULL_DETAIL_URL);

    // The pull name renders as the page heading on the detail page.
    await expect(producerPage.getByText(SEED_PULL.name).first()).toBeVisible();
    // The seeded item's family name + its single size render (item not dropped).
    await expect(producerPage.getByText(SEED_PULL_ITEM.familyName).first()).toBeVisible();
    await expect(producerPage.getByText(SEED_PULL_ITEM.size, { exact: true }).first()).toBeVisible();
    // Items label reflects the one seeded item.
    await expect(producerPage.getByText('Items (1)')).toBeVisible();
  });

  // ── UPDATE (status) ───────────────────────────────────────────────────────
  // Opens the header status combobox (the FIRST combobox on the detail page —
  // the item FulfillmentToggle is the second) and picks "Published". Asserts the
  // trigger reflects the new status. Mutates the shared seed, but asserts only
  // the post-condition it sets, so it is order-independent.
  test('producer can change the pull status to Published', async ({ producerPage }) => {
    await producerPage.goto(PULL_DETAIL_URL);
    await expect(producerPage.getByText(SEED_PULL.name).first()).toBeVisible();

    // Exactly two comboboxes exist with one seeded item: [0]=header status Select,
    // [1]=item FulfillmentToggle. Assert the count so .first()/.last() can't silently
    // drift if the page ever grows another combobox.
    await expect(producerPage.getByRole('combobox')).toHaveCount(2);

    // Header status Select is the first combobox; item fulfillment Select is second.
    const statusTrigger = producerPage.getByRole('combobox').first();
    await expect(statusTrigger).toBeEnabled();
    await statusTrigger.click();

    await producerPage.getByRole('option', { name: 'Published' }).click();

    // The trigger now shows the Published badge.
    await expect(statusTrigger).toContainText('Published');
  });

  // ── SHARE / UNSHARE ───────────────────────────────────────────────────────
  // Toggles share on (button "Share" → "Shared", share link appears), then off
  // (→ "Share"). Self-contained: it leaves sharing disabled at the end.
  test('producer can share and unshare the pull', async ({ producerPage }) => {
    await producerPage.goto(PULL_DETAIL_URL);
    await expect(producerPage.getByText(SEED_PULL.name).first()).toBeVisible();

    // Self-heal: a prior failed attempt (or retry) may have left sharing ON. The
    // seed only resets in global setup, not between tests, so normalize to OFF
    // before asserting the on→off transition, otherwise the retry sees 'Shared'
    // and the exact 'Share' lookup never resolves.
    const alreadyShared = producerPage.getByRole('button', { name: 'Shared', exact: true });
    if (await alreadyShared.isVisible().catch(() => false)) {
      await alreadyShared.click();
    }

    const shareButton = producerPage.getByRole('button', { name: 'Share', exact: true });
    await expect(shareButton).toBeVisible();
    await shareButton.click();

    // Becomes "Shared" and the share link block appears.
    const sharedButton = producerPage.getByRole('button', { name: 'Shared', exact: true });
    await expect(sharedButton).toBeVisible();
    await expect(producerPage.getByText(/Share link:/i)).toBeVisible();

    // Toggle back off.
    await sharedButton.click();
    await expect(producerPage.getByRole('button', { name: 'Share', exact: true })).toBeVisible();
  });

  // ── RBAC: producer CANNOT fulfill ─────────────────────────────────────────
  // The per-item FulfillmentToggle is disabled for producer (canFulfillPulls =
  // admin|warehouse only). Scope to the item card so we target the fulfillment
  // combobox, not the header status one.
  test('producer cannot fulfill items (toggle disabled)', async ({ producerPage }) => {
    await producerPage.goto(PULL_DETAIL_URL);
    await expect(producerPage.getByText(SEED_PULL_ITEM.familyName).first()).toBeVisible();

    // The item card containing the seeded family name; its combobox is the
    // FulfillmentToggle (the second of exactly two). Producer lacks
    // canFulfillPulls → disabled.
    await expect(producerPage.getByRole('combobox')).toHaveCount(2);
    const fulfillmentTrigger = producerPage.getByRole('combobox').last();
    await expect(fulfillmentTrigger).toBeDisabled();
  });

  // ── RBAC: warehouse CAN fulfill ───────────────────────────────────────────
  // As warehouse, open the item FulfillmentToggle and set Pending → Fulfilled,
  // then assert the trigger reflects Fulfilled. Uses warehousePage (the new
  // fixture) — warehouse has canFulfillPulls.
  test('warehouse can fulfill an item (Pending → Fulfilled)', async ({ warehousePage }) => {
    await warehousePage.goto(PULL_DETAIL_URL);
    await expect(warehousePage.getByText(SEED_PULL_ITEM.familyName).first()).toBeVisible();

    // The FulfillmentToggle is the item-scoped combobox (the second of exactly two;
    // the first is the header status Select). Enabled for warehouse.
    await expect(warehousePage.getByRole('combobox')).toHaveCount(2);
    const fulfillmentTrigger = warehousePage.getByRole('combobox').last();
    await expect(fulfillmentTrigger).toBeEnabled();
    await fulfillmentTrigger.click();

    await warehousePage.getByRole('option', { name: 'Fulfilled' }).click();

    await expect(fulfillmentTrigger).toContainText('Fulfilled');
  });
});
