import { test, expect } from './fixtures/auth';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import {
  SEED_CLIENT_ID,
  SEED_PROJECT_ID,
  SEED_SHOT_SHOOT,
  SEED_SHOT_LEGACY,
} from './helpers/seedConstants';

/**
 * Shoot-shell E2E — Phase 5e-II FLAG-ON LANE (build spec §Test plan item 4).
 *
 * featureShootSurface is a BUILD-TIME flag (VITE_SHOOT_SURFACE, default OFF;
 * CI's main playwright run is the flag-OFF contract and never defines it).
 * This spec therefore only runs in the dedicated ui-checks lane that rebuilds
 * the bundle with VITE_SHOOT_SURFACE=1 and invokes it directly with
 * SHOOT_SURFACE_E2E=1 (which lifts the lane gate in playwright.config.ts —
 * a lane gate, NOT a quarantine; see tests/QUARANTINE.md "Shoot-shell
 * flag-ON lane"). Against a flag-OFF bundle the shell cannot render and every
 * assertion here would be a false failure.
 *
 * What only THIS lane can prove (the unit matrix in
 * ShootShotDetail.test.tsx / ShootShotList.test.tsx already pins the shell's
 * composition, mount fork, and navigation against mocked inputs):
 *
 *  (a) the member-crew identity lands on the SHELL through the real resolver
 *      chain (auth claims → members doc → useEffectiveRole → resolveSurface)
 *      with the planning editors NOT MOUNTED;
 *  (b) a status tap WRITES through the hardened firestore.rules
 *      ['producer','crew'] arm end-to-end AND the version snapshot doc lands
 *      — the snapshot write is fire-and-forget (.catch → console.error,
 *      updateShotWithVersion.ts), so any rules asymmetry fails silently in
 *      the app; this is the regression pin that would catch it;
 *  (c) a legacy projectId=='' deep-link renders READ-ONLY with the quiet
 *      note (Decision D) instead of advertising a guaranteed-denied tap;
 *  (d) Back binds to the EXPLICIT list route, never navigate(-1).
 *
 * Smoke discipline (the quarantine history says bloated suites rot): one
 * day-loop journey + one legacy deep-link. Flag-OFF no-change needs no new
 * pins — the main run's existing suites (role-matrix crew pins, smoke,
 * shots-crud, ShotDetailPageUnified/ShotListPage unit contracts) ARE the
 * flag-OFF contract and run against the flag-OFF build on every PR.
 *
 * Fixture: memberCrewPage (global claim 'crew' + seed-project members doc
 * role 'crew' — the 5b identity). The shell is surface-keyed so it renders
 * at every width (Decision F); the phone viewport here is the
 * production-shaped on-set case. SEED_SHOT_SHOOT is this spec's dedicated
 * mutation target (ownership map — no other spec touches it).
 */

const SHOTS_URL = `/projects/${SEED_PROJECT_ID}/shots`;
const PHONE = { width: 390, height: 844 } as const;

// ---------------------------------------------------------------------------
// Emulator-side assertions (admin SDK) — the version-snapshot pin needs to see
// the versions SUBCOLLECTION, which no UI surface on the shell renders.
// Same init pattern as tests/helpers/seed.ts (reuse the default app; the
// emulator host default matches global.setup.ts / ui-checks.yml).
// ---------------------------------------------------------------------------

function adminDb(): Firestore {
  process.env.FIRESTORE_EMULATOR_HOST =
    process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
  const app = getApps().length ? getApp() : initializeApp({ projectId: 'demo-test' });
  return getFirestore(app);
}

async function getShotStatus(shotId: string): Promise<string | undefined> {
  const snap = await adminDb()
    .doc(`clients/${SEED_CLIENT_ID}/shots/${shotId}`)
    .get();
  return snap.get('status') as string | undefined;
}

/**
 * Count version docs under the shot. The journey test asserts the count
 * INCREASES across the tap (not an exact total): a persisted local emulator
 * can carry snapshots from earlier runs (subcollections survive parent doc
 * deletion, so the re-seed cannot clear them), and CI is fresh either way.
 */
async function countVersions(shotId: string): Promise<number> {
  const snap = await adminDb()
    .collection(`clients/${SEED_CLIENT_ID}/shots/${shotId}/versions`)
    .get();
  return snap.size;
}

test.describe('Shoot shell — member crew, flag-ON lane', () => {
  test('phone day-loop: list lands on the shell; planning editors not mounted; status tap writes + mints a version doc; Back returns to the list', async ({
    memberCrewPage,
  }) => {
    await memberCrewPage.setViewportSize(PHONE);

    await memberCrewPage.goto(SHOTS_URL);
    await memberCrewPage
      .locator('main, [role="main"]')
      .first()
      .waitFor({ state: 'visible' });

    // (a-list) The shell list replaced the card/table forks: compact rows,
    // minimal chrome (no table, no view switcher), no permissions error.
    await expect(memberCrewPage.getByTestId('shoot-shot-list')).toBeVisible();
    await expect(memberCrewPage.locator('main table')).toHaveCount(0);
    await expect(
      memberCrewPage.getByRole('button', { name: 'Card view' }),
    ).toHaveCount(0);
    await expect(
      memberCrewPage.getByText(/Missing or insufficient permissions/i),
    ).toHaveCount(0);

    // The legacy fixture shot can never appear here (projectId=='' fails the
    // list query by construction; Decision D's filter is belt-and-suspenders).
    await expect(
      memberCrewPage.getByText(SEED_SHOT_LEGACY.title),
    ).toHaveCount(0);

    const versionsBefore = await countVersions(SEED_SHOT_SHOOT.id);

    // Open the dedicated mutable shot THROUGH the row tap — this snapshots
    // the nav order exactly like an on-set user reaching the detail shell.
    await memberCrewPage
      .getByTestId('shoot-shot-row')
      .filter({ hasText: SEED_SHOT_SHOOT.title })
      .click();
    await expect(memberCrewPage.getByTestId('shoot-shell')).toBeVisible();

    // (a) Shell blocks render…
    await expect(memberCrewPage.getByTestId('shoot-shot-identity')).toBeVisible();
    await expect(
      memberCrewPage.getByText(SEED_SHOT_SHOOT.title).first(),
    ).toBeVisible();
    await expect(memberCrewPage.getByTestId('shoot-status-bar')).toBeVisible();
    // The comments block rendered AND the composer is enabled for the member
    // crew (the section's global-claim double gate passes: claim 'crew' →
    // canManageShots true). Placeholder is the section's unique landmark.
    await expect(
      memberCrewPage.getByPlaceholder(/Leave a note for your team/),
    ).toBeVisible();

    // …and the planning editors are NOT MOUNTED (presentation choice, but the
    // shell must not leak the unified editor's plan-build chrome): tags
    // editor, desktop status select, hero upload input, and the editor body's
    // own back affordance are all absent.
    await expect(memberCrewPage.getByTestId('tags-section')).toHaveCount(0);
    await expect(
      memberCrewPage.getByTestId('shot-status-select-trigger'),
    ).toHaveCount(0);
    await expect(
      memberCrewPage.getByTestId('hero-image-file-input'),
    ).toHaveCount(0);
    await expect(
      memberCrewPage.getByRole('button', { name: /back to shots/i }),
    ).toHaveCount(0);

    // (b) Status tap: todo → in_progress (seed re-pins todo every run).
    // The write must PASS the hardened ['producer','crew'] update arm (a
    // denial reverts the pill + raises the error toast instead).
    await memberCrewPage.getByTestId('status-tap-in_progress').click();
    await expect(
      memberCrewPage.getByTestId('status-tap-in_progress'),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      memberCrewPage.getByText(/Failed to update status/i),
    ).toHaveCount(0);

    // The doc really changed (not just the optimistic pill)…
    await expect
      .poll(() => getShotStatus(SEED_SHOT_SHOOT.id), { timeout: 15000 })
      .toBe('in_progress');

    // …and the fire-and-forget version snapshot LANDED (snapshot symmetry —
    // the silent-failure regression pin; spec §Rules-vs-UI "Version
    // snapshots").
    await expect
      .poll(() => countVersions(SEED_SHOT_SHOOT.id), { timeout: 15000 })
      .toBeGreaterThan(versionsBefore);

    // (d) Back binds to the EXPLICIT list route (never navigate(-1)) and the
    // shell list is still the rendered surface.
    await memberCrewPage.getByTestId('shoot-back').click();
    await memberCrewPage.waitForURL(`**${SHOTS_URL}`);
    await expect(memberCrewPage.getByTestId('shoot-shot-list')).toBeVisible();
  });

  test('legacy projectId=="" deep-link renders read-only with the quiet note (Decision D); Back falls back to the projects dashboard', async ({
    memberCrewPage,
  }) => {
    await memberCrewPage.setViewportSize(PHONE);

    // Deep link — the only way a crew phone reaches a legacy shot (it can
    // never be listed). New-tab shape: no nav-order snapshot exists.
    await memberCrewPage.goto(
      `/projects/${SEED_PROJECT_ID}/shots/${SEED_SHOT_LEGACY.id}`,
    );

    // (c) The shell renders the shot (read is clientMatches-only) instead of
    // crashing or advertising the guaranteed-denied write.
    await expect(memberCrewPage.getByTestId('shoot-shell')).toBeVisible();
    await expect(
      memberCrewPage.getByText(SEED_SHOT_LEGACY.title).first(),
    ).toBeVisible();
    await expect(memberCrewPage.getByTestId('shoot-legacy-note')).toBeVisible();

    // Every status pill is disabled — the primary tap is not advertised on a
    // shot the rules' legacy arm denies to crew.
    for (const status of ['todo', 'in_progress', 'complete', 'on_hold']) {
      await expect(
        memberCrewPage.getByTestId(`status-tap-${status}`),
      ).toBeDisabled();
    }

    // (d) Back on a legacy shot quietly falls back to the projects dashboard
    // (there is no project list to return to) — still an explicit route,
    // never navigate(-1) (a deep-linked tab would exit the app).
    await memberCrewPage.getByTestId('shoot-back').click();
    await memberCrewPage.waitForURL(/\/projects\/?$/);
  });
});
