import { test, expect } from './fixtures/auth';
import { SEED_PROJECT_ID, SEED_SHOT_AURORA } from './helpers/seedConstants';

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
