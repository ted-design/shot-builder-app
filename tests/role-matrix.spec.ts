import { test, expect } from './fixtures/auth';
import { SEED_PROJECT_ID, SEED_SHOT_AURORA } from './helpers/seedConstants';

const SHOTS_URL = `/projects/${SEED_PROJECT_ID}/shots`;

/**
 * Role-matrix E2E — NON-MEMBER lanes crash carve-out (Phase 2).
 *
 * Regression coverage for the bug where a non-member authed user with a global
 * role (crew / warehouse / viewer) crashed the WHOLE shot detail page when it
 * tried to read the project's lanes subcollection.
 *
 * Why crew is the production-shaped non-member repro (verified against current
 * source + seed):
 * - firestore.rules:408 `match /clients/{clientId}/shots/{docId} { allow read:
 *   if clientMatches(clientId); }` — the shot doc read needs ONLY a matching
 *   clientId claim. No project membership, no project role. So crew (global
 *   claim role='crew', clientId='test-client') reads the seeded shot fine.
 * - The lanes read (firestore.rules ~802) additionally requires isAdmin() ||
 *   producerCanAccessProject() || hasProjectRole(...). hasProjectRole reads a
 *   per-project members/<uid> doc. global.setup.ts grants a members doc ONLY to
 *   the VIEWER (seedShotsCrudScenario({viewerUid})) and the WAREHOUSE
 *   (seedPullsCrudScenario({warehouseUid})). CREW is granted NO members doc
 *   anywhere — so it has a global role but is a project NON-MEMBER, and its
 *   lanes read is denied (permission-denied).
 *
 * Before the fix: useShotDetailBundle folded that lanes permission-denied into
 * a fatal bundle error and ShotDetailPage early-returned a full-page error
 * block in place of the shot. After the fix the permission-denied is swallowed
 * (only that code; genuine lanes errors stay fatal), the shot renders, and the
 * scene-context banner degrades to absent (empty laneById → banner returns
 * null).
 *
 * NOTE: this suite runs ONLY in CI (`ui-checks`) against the Firestore/Storage
 * emulators (Java 11+). It cannot be booted locally on a Java 8 box — that is an
 * environment limitation, NOT a code failure. The live ui-checks job is the
 * arbiter. The shared installFirebaseErrorFilter fixture rethrows any real
 * pageerror, so a regression (lanes error going fatal again, or an unhandled
 * throw) fails this spec rather than silently passing.
 *
 * No seed change is required: crew is intentionally left unseeded as THE
 * non-member case. Adding a crew members doc would erase the repro.
 */

const detailUrl = (shotId: string) =>
  `/projects/${SEED_PROJECT_ID}/shots/${shotId}`;

test.describe('Shot detail — non-member (global crew, no project membership)', () => {
  test('opens a seeded shot deep-link without crashing the page', async ({
    crewPage,
  }) => {
    await crewPage.goto(detailUrl(SEED_SHOT_AURORA.id));

    // (1) The page did NOT early-return the fatal error block. Before the fix,
    // the lanes permission-denied rendered as a full-page error with the
    // Firebase message. Assert that message is absent.
    await expect(
      crewPage.getByText(/Missing or insufficient permissions/i),
    ).toHaveCount(0);

    // (2) The shot itself rendered. "Back to Shots" only exists on the detail
    // page body (past the loading/error/not-found early returns), so its
    // presence proves we reached the real page, not the error block or
    // NotFoundPage. The shot title also renders (shot doc read succeeded).
    await expect(
      crewPage.getByRole('button', { name: /back to shots/i }),
    ).toBeVisible();
    await expect(
      crewPage.getByText(SEED_SHOT_AURORA.title).first(),
    ).toBeVisible();

    // (3) Scene context degrades gracefully: with lanes unreadable, laneById is
    // empty and SceneContextBanner returns null. (AURORA also has no laneId, so
    // the banner would be absent regardless — this asserts the degraded state
    // is clean, not crashing.)
    await expect(
      crewPage.getByTestId('scene-context-banner'),
    ).toHaveCount(0);
  });
});

/**
 * Phase 4 — flag-off NO-CHANGE assertions (build spec §Test plan item 4).
 *
 * `featureSurfaceResolver` is enabled ONLY via `VITE_SURFACE_RESOLVER=1` at
 * build/dev time, and the CI build env never defines it — so this suite runs
 * against the FLAG-OFF path and pins the pre-Phase-4 trunk behavior that the
 * resolver must not change while the flag is off:
 *
 *   (a) producer default view stays CARD for never-customized users (the
 *       flag-on resolver defaults producers to table — that flip is a named,
 *       accepted behavior change AT FLAG REMOVAL, not before);
 *   (b) mount performs ZERO URL writes (no view/group params materialize);
 *   (c) mobile forcing is override-without-erase: a 390px viewport forces the
 *       card list and hides the view toggle WITHOUT erasing latent
 *       `?view=table&group=status`, and resizing across 768px (live
 *       matchMedia) restores them;
 *   (d) read-only roles keep their read-only list chrome (no "New Shot"),
 *       and crew KEEPS its existing "New Shot" affordance
 *       (canManageShots(crew)=true today — flag-off must not revoke it);
 *   (e) a deep-linked `?view=table&group=status` survives a RELOAD unchanged
 *       (URL is the source of truth; resolution adds/removes nothing) — pinned
 *       for producer, crew, and viewer.
 *
 * The mobile case uses a PER-TEST viewport override — the auth fixtures pin
 * 1280×720 (tests/fixtures/auth.ts), so `setViewportSize` inside the test is
 * the supported way to get a mobile viewport without touching the fixture.
 *
 * Seed note: NO seed changes here. Crew intentionally remains a project
 * NON-MEMBER (the lanes-carve-out repro above is load-bearing on that).
 */
/** The canonical Phase 4 deep link: explicit table view grouped by status. */
const DEEP_LINK_SEARCH = '?view=table&group=status';

/**
 * Shared flag-off pin (assertion (e)): deep-linked `?view=table&group=status`
 * renders the table on a desktop viewport, the load mutates NOTHING in the
 * URL (assert page.url() exactly), and a reload comes back byte-identical.
 */
async function expectDeepLinkSurvivesReload(
  page: import('@playwright/test').Page,
): Promise<void> {
  await page.goto(`${SHOTS_URL}${DEEP_LINK_SEARCH}`);
  await page.locator('main, [role="main"]').first().waitFor({ state: 'visible' });

  // The explicit table view renders (desktop fixture viewport)…
  await expect(page.locator('main table').first()).toBeVisible();

  // …and the load mutated nothing: the search string is EXACTLY the deep link
  // (no param added, removed, or reordered by resolution).
  expect(new URL(page.url()).search).toBe(DEEP_LINK_SEARCH);

  await page.reload();
  await page.locator('main, [role="main"]').first().waitFor({ state: 'visible' });
  await expect(page.locator('main table').first()).toBeVisible();
  expect(new URL(page.url()).search).toBe(DEEP_LINK_SEARCH);
}

test.describe('Shots list — Phase 4 flag-off no-change', () => {
  test('producer (desktop, never customized): default view stays card; mount writes no URL params', async ({
    producerPage,
  }) => {
    await producerPage.goto(SHOTS_URL);
    await producerPage.locator('main, [role="main"]').first().waitFor({ state: 'visible' });

    // Shots render (seed list is non-empty).
    await expect(
      producerPage.getByText(SEED_SHOT_AURORA.title).first(),
    ).toBeVisible();

    // (a) Default is the CARD view: no table is mounted. The fixture context
    // is rebuilt from the global-setup storage state every test, so this
    // producer has no stored `:view:v1` choice — the "never customized" case
    // the flag-on resolver would flip to table. Flag-off must stay card.
    await expect(producerPage.locator('main table')).toHaveCount(0);

    // Desktop toolbar still offers the view toggle (gated on !isMobile only).
    await expect(
      producerPage.getByRole('button', { name: 'Card view' }),
    ).toBeVisible();

    // (b) Zero URL writes from resolution on mount: no view/group params
    // appear that the user never set.
    const url = new URL(producerPage.url());
    expect(url.searchParams.get('view')).toBeNull();
    expect(url.searchParams.get('group')).toBeNull();
  });

  test('producer (desktop): deep-linked ?view=table&group=status survives reload unchanged', async ({
    producerPage,
  }) => {
    await expectDeepLinkSurvivesReload(producerPage);
  });

  /**
   * CREW — flag-off pin for the third write-capable role. Crew has a global
   * claim role='crew' but NO project members doc (intentionally — the
   * lanes-carve-out repro at the top of this file is load-bearing on crew
   * staying a non-member; do NOT seed one). On the LIST page the denied lanes
   * subscription must degrade silently, exactly like the wardrobe case.
   */
  test('crew (non-member): no URL mutation on plain load; "New Shot" kept; deep link survives reload', async ({
    crewPage,
  }) => {
    await crewPage.goto(SHOTS_URL);
    await crewPage.locator('main, [role="main"]').first().waitFor({ state: 'visible' });

    // Non-member lanes denial degrades silently — no fatal permissions block.
    await expect(
      crewPage.getByText(/Missing or insufficient permissions/i),
    ).toHaveCount(0);

    await expect(
      crewPage.getByText(SEED_SHOT_AURORA.title).first(),
    ).toBeVisible();

    // (d) Crew KEEPS its create affordance: canManageShots(crew)=true today.
    // Flag-off must not revoke it (any crew revocation is a 5e/5f decision,
    // not Phase 4).
    await expect(
      crewPage.getByRole('button', { name: /new shot/i }).first(),
    ).toBeVisible();

    // (a)+(b) Card default + zero URL writes on an absent-override load.
    await expect(crewPage.locator('main table')).toHaveCount(0);
    const url = new URL(crewPage.url());
    expect(url.searchParams.get('view')).toBeNull();
    expect(url.searchParams.get('group')).toBeNull();

    // (e) Deep link survives reload unchanged.
    await expectDeepLinkSurvivesReload(crewPage);
  });

  test('producer (mobile viewport override): mobile forces card/none WITHOUT erasing ?view=table&group=status; resize restores them', async ({
    producerPage,
  }) => {
    // Per-test viewport override — fixtures pin 1280×720 (desktop).
    await producerPage.setViewportSize({ width: 390, height: 844 });

    await producerPage.goto(`${SHOTS_URL}?view=table&group=status`);
    await producerPage.locator('main, [role="main"]').first().waitFor({ state: 'visible' });

    // Mobile forcing: the card list renders despite ?view=table…
    await expect(
      producerPage.getByText(SEED_SHOT_AURORA.title).first(),
    ).toBeVisible();
    await expect(producerPage.locator('main table')).toHaveCount(0);
    // …and the view toggle is hidden (toolbar !isMobile gate).
    await expect(
      producerPage.getByRole('button', { name: 'Table view' }),
    ).toHaveCount(0);

    // Override-without-erase: the latent URL params SURVIVE mobile forcing.
    const mobileUrl = new URL(producerPage.url());
    expect(mobileUrl.searchParams.get('view')).toBe('table');
    expect(mobileUrl.searchParams.get('group')).toBe('status');

    // Resize across the 768px breakpoint (live matchMedia, no reload): the
    // latent table view + status grouping come back.
    await producerPage.setViewportSize({ width: 1280, height: 720 });
    await expect(producerPage.locator('main table').first()).toBeVisible();
    const desktopUrl = new URL(producerPage.url());
    expect(desktopUrl.searchParams.get('view')).toBe('table');
    expect(desktopUrl.searchParams.get('group')).toBe('status');
  });

  test('viewer (project member): list renders read-only — no "New Shot", card default, no URL writes', async ({
    viewerPage,
  }) => {
    await viewerPage.goto(SHOTS_URL);
    await viewerPage.locator('main, [role="main"]').first().waitFor({ state: 'visible' });

    await expect(
      viewerPage.getByText(SEED_SHOT_AURORA.title).first(),
    ).toBeVisible();

    // Read-only chrome: no create affordance (canManageShots(viewer)=false).
    await expect(
      viewerPage.getByRole('button', { name: /new shot/i }),
    ).toHaveCount(0);

    // Card default + zero URL writes — same flag-off pins as the producer case.
    await expect(viewerPage.locator('main table')).toHaveCount(0);
    const url = new URL(viewerPage.url());
    expect(url.searchParams.get('view')).toBeNull();
    expect(url.searchParams.get('group')).toBeNull();

    // (e) Deep link survives reload unchanged — the explicit table view is
    // role-independent (Phase 3 URL-as-state), so the viewer pin matches
    // producer/crew.
    await expectDeepLinkSurvivesReload(viewerPage);
  });

  /**
   * WARDROBE — annotated VIEWER DUPLICATE (build spec §Test plan item 4).
   *
   * This test deliberately duplicates the viewer assertions above, because for
   * the shots LIST under flag-off the two roles are behaviorally identical:
   *
   * - The wardrobe user carries a legacy global claim role='wardrobe'. As of
   *   Phase 4 (spec security invariant 5) the client's normalizeRole maps
   *   'wardrobe' → WAREHOUSE — mirroring firestore.rules:43-56 — instead of
   *   the old silent fall-through to viewer. canManageShots(warehouse) is
   *   false, exactly like viewer, so the read-only list chrome (no "New
   *   Shot") must be byte-identical. This pins that the alias fix changed the
   *   JOB mapping without granting wardrobe any shot-create UI.
   * - Unlike the viewer (who is granted a members doc by the seed), wardrobe
   *   has NO members doc — it is a project NON-MEMBER, so its lanes
   *   subscription is rules-denied. The list page must degrade (lanes error
   *   is non-fatal there), not crash or surface the permissions error.
   */
  test('wardrobe (legacy alias, non-member) — viewer-duplicate: read-only list renders without crashing', async ({
    wardrobePage,
  }) => {
    await wardrobePage.goto(SHOTS_URL);
    await wardrobePage.locator('main, [role="main"]').first().waitFor({ state: 'visible' });

    // Non-member lanes denial degrades silently — no fatal permissions block.
    await expect(
      wardrobePage.getByText(/Missing or insufficient permissions/i),
    ).toHaveCount(0);

    await expect(
      wardrobePage.getByText(SEED_SHOT_AURORA.title).first(),
    ).toBeVisible();

    // Read-only chrome: wardrobe→warehouse still has canManageShots=false.
    await expect(
      wardrobePage.getByRole('button', { name: /new shot/i }),
    ).toHaveCount(0);

    // Card default + zero URL writes — identical pins to the viewer case.
    await expect(wardrobePage.locator('main table')).toHaveCount(0);
    const url = new URL(wardrobePage.url());
    expect(url.searchParams.get('view')).toBeNull();
    expect(url.searchParams.get('group')).toBeNull();
  });
});
