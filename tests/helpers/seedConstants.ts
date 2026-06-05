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

/** All seeded shots, in seed order. */
export const SEED_SHOTS = [SEED_SHOT_AURORA, SEED_SHOT_BOREALIS, SEED_SHOT_EDITABLE] as const;
