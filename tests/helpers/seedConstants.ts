/**
 * Deterministic IDs + titles for the E2E emulator seed.
 *
 * Shared by `tests/helpers/seed.ts` (writes the docs) and the specs that read
 * them (e.g. `tests/shots-crud.spec.ts`). Kept free of any `firebase-admin`
 * import so specs can import it without pulling the admin SDK into the test.
 *
 * The IDs are fixed strings (not auto-generated) so a spec can deep-link to
 * `/projects/<id>/shots` and `/projects/<id>/shots/<sid>` without scraping the
 * list first. The seed is cleared + rewritten on every global setup, so these
 * IDs are stable across runs.
 */

/** clientId every test user carries as a custom claim (see global.setup.ts). */
export const SEED_CLIENT_ID = 'test-client';

/** The project all seeded shots live under. Team-visible so a producer can read it. */
export const SEED_PROJECT_ID = 'e2e-seed-project';
export const SEED_PROJECT_NAME = 'E2E Seed Project';

/**
 * Seeded shots. Titles use distinct, unique tokens ("Aurora" / "Borealis") so a
 * search-filter test can assert one stays and the other disappears.
 *
 * - AURORA   — read-asserted in the list + opened via deep-link (never mutated).
 * - BOREALIS — read-asserted in the list + the negative case for the filter test.
 * - EDITABLE — the dedicated target for the inline-edit (update) test. Not
 *              read-asserted elsewhere, so renaming it can't break other tests.
 */
export const SEED_SHOT_AURORA = { id: 'e2e-shot-aurora', title: 'Aurora Hero Shot' } as const;
export const SEED_SHOT_BOREALIS = { id: 'e2e-shot-borealis', title: 'Borealis Detail Shot' } as const;
export const SEED_SHOT_EDITABLE = { id: 'e2e-shot-editable', title: 'Editable Seed Shot' } as const;

/**
 * HERO — the DEDICATED hero-upload target for `hero-image.spec.ts`. That spec
 * mutates this shot's doc (writes a `heroImage` on upload/replace, then clears
 * it on reset, plus a version entry each write). It is NOT read-asserted by
 * shots-crud (which uses per-title assertions and never checks an exact shot
 * count), so mutating it in isolation is safe and won't break other specs.
 */
export const SEED_SHOT_HERO = { id: 'e2e-shot-hero', title: 'Hero Upload Shot' } as const;

/**
 * FILTER FIXTURE SHOTS — dedicated, asymmetric shots so the inline Status &
 * Missing toolbar filters are MEANINGFULLY testable (the original four seed
 * shots are ALL status=todo and uniformly missing everything, so a status or
 * missing filter could not discriminate). These are NET-NEW shots, never
 * mutated or read-asserted by shots-crud / sidebar-summary / hero-image:
 *
 * - Titles use the unique token "Spectra" (never "Aurora"/"Borealis"), so the
 *   shots-crud search test (search "Aurora" -> Borealis count 0) is unaffected.
 * - Each carries a distinct status so a single-status filter isolates exactly one.
 * - Field presence is asymmetric so a single-missing-key filter discriminates:
 *     SPECTRA_TODO        status=todo         missing: products, talent, location, image
 *     SPECTRA_INPROGRESS  status=in_progress  has products+talent+location  (missing: image)
 *     SPECTRA_ONHOLD      status=on_hold      has location                  (missing: products, talent, image)
 *     SPECTRA_COMPLETE    status=complete     has products+talent           (missing: location, image)
 *   (No fixture uploads a heroImage, so every Spectra shot is "missing image".)
 *
 * Placeholder ID strings for products/talent/location are sufficient: the
 * Missing predicate + counts key off array length / locationId presence, not on
 * a matching family/talent/location doc existing.
 */
export const SEED_SHOT_SPECTRA_TODO = {
  id: 'e2e-shot-spectra-todo',
  title: 'Spectra Todo Shot',
  status: 'todo',
} as const;
export const SEED_SHOT_SPECTRA_INPROGRESS = {
  id: 'e2e-shot-spectra-inprogress',
  title: 'Spectra In Progress Shot',
  status: 'in_progress',
} as const;
export const SEED_SHOT_SPECTRA_ONHOLD = {
  id: 'e2e-shot-spectra-onhold',
  title: 'Spectra On Hold Shot',
  status: 'on_hold',
} as const;
export const SEED_SHOT_SPECTRA_COMPLETE = {
  id: 'e2e-shot-spectra-complete',
  title: 'Spectra Complete Shot',
  status: 'complete',
} as const;

/** All FILTER fixture shots, in seed order. */
export const SEED_FILTER_SHOTS = [
  SEED_SHOT_SPECTRA_TODO,
  SEED_SHOT_SPECTRA_INPROGRESS,
  SEED_SHOT_SPECTRA_ONHOLD,
  SEED_SHOT_SPECTRA_COMPLETE,
] as const;

/** All seeded shots, in seed order. */
export const SEED_SHOTS = [
  SEED_SHOT_AURORA,
  SEED_SHOT_BOREALIS,
  SEED_SHOT_EDITABLE,
  SEED_SHOT_HERO,
] as const;

/**
 * Seeded pull sheet for the pulls-crud spec. Lives under the seed project at
 * `clients/test-client/projects/e2e-seed-project/pulls/<SEED_PULL.id>`.
 *
 * The name uses a unique token ("Helios") so the create-pull test's freshly
 * created sheet never collides with this seeded one in a list assertion. The
 * fixed id lets a spec deep-link to `/projects/<project>/pulls/<SEED_PULL.id>`.
 */
export const SEED_PULL = { id: 'e2e-seed-pull', name: 'Helios Day 1 Pull' } as const;

/**
 * The single item the seeded pull carries. Distinct tokens ("Helios Jacket",
 * size 'M') so the spec can assert the family name + size render on the detail
 * page. Mirrors the app PullItem shape mapItem/mapSize read (familyId + size
 * REQUIRED non-empty; British 'colourName').
 */
export const SEED_PULL_ITEM = {
  familyId: 'e2e-pull-family',
  familyName: 'Helios Jacket',
  colourName: 'Black',
  size: 'M',
  quantity: 2,
} as const;
