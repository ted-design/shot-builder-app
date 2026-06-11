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

/**
 * RICH — the dedicated DISPLAY shot for the 5a unified editor (Phase 5a build
 * spec §Test plan item 3). READ-ONLY by contract: NO spec may EVER mutate this
 * shot (shot-ownership map: AURORA read-only, EDITABLE status/notes/title,
 * HERO hero-only, RICH display-only). It exists so the flag-on unified
 * editor's typographic centerpiece (product + colorway names as text),
 * legacy-notes render, tags, and hero are E2E-assertable after the default
 * flip — and it is harmless flag-off:
 *
 * - Title token "Cascade" is unique (never "Aurora"/"Borealis"/"Spectra"/
 *   "Helios"), so the shots-crud search test and the toolbar filter tests'
 *   per-title assertions are unaffected.
 * - status=todo adds one more todo shot; no spec asserts shot counts.
 * - The hero downloadURL is a data: URI — resolveStoragePath passes URLs
 *   through synchronously, so the <img> renders with zero Storage-emulator
 *   coupling. The path deliberately does NOT include "/hero.webp", so the
 *   manual "Reset" affordance never appears on this shot.
 * - Tag labels avoid DEFAULT_SHOT_TAGS labels (e.g. "Men"), so mapShot's
 *   canonicalizeTag leaves ids/colors exactly as seeded.
 */
export const SEED_SHOT_RICH = { id: 'e2e-shot-rich', title: 'Cascade Display Shot' } as const;

/**
 * The RICH shot's display fields, exported so post-flip specs can assert the
 * exact tokens (colorway strip text, SKU names, tag labels, notes copy).
 * Shapes mirror mapShot's normalizers: looks[].products use the app's
 * ProductAssignment fields (British 'colourName'); tags need id+label+color.
 */
export const SEED_RICH_SHOT_FIELDS = {
  description:
    'Cascade hero look on the terrace at golden hour. Full-length, soft key from camera left.',
  // Legacy notes are stored HTML (NotesSection renders them read-only).
  notes: '<p>Steam the hoodie before the take. Cuff the trousers once.</p>',
  tags: [
    { id: 'e2e-rich-tag-editorial', label: 'Editorial', color: '#2563eb' },
    { id: 'e2e-rich-tag-exterior', label: 'Exterior', color: '#16a34a' },
  ],
  heroImage: {
    path: 'e2e/rich-hero.png',
    downloadURL:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAyCAIAAACh0Q7HAAAANElEQVR42u3NMQ0AAAgDsDnhRgH+nSGDgyb9m+o5EbFYLBaLxWKxWCwWi8VisVgsFos/xwsiZOBegqip8gAAAABJRU5ErkJggg==',
  },
  activeLookId: 'e2e-rich-look-1',
  looks: [
    {
      id: 'e2e-rich-look-1',
      label: 'Terrace Look',
      order: 0,
      products: [
        {
          familyId: 'e2e-rich-family-hoodie',
          familyName: 'Cascade Merino Hoodie',
          colourId: 'e2e-rich-colour-glacier',
          colourName: 'Glacier Blue',
          skuId: 'e2e-rich-sku-hoodie-glacier-m',
          skuName: 'CMH-GLB-M',
          size: 'M',
        },
        {
          familyId: 'e2e-rich-family-trouser',
          familyName: 'Cascade Wool Trouser',
          colourId: 'e2e-rich-colour-charcoal',
          colourName: 'Charcoal',
          skuId: 'e2e-rich-sku-trouser-charcoal-32',
          skuName: 'CWT-CHR-32',
          size: '32',
        },
      ],
    },
    {
      id: 'e2e-rich-look-2',
      label: 'Dusk Look',
      order: 1,
      products: [
        {
          familyId: 'e2e-rich-family-overshirt',
          familyName: 'Cascade Overshirt',
          colourId: 'e2e-rich-colour-ember',
          colourName: 'Ember',
          skuId: 'e2e-rich-sku-overshirt-ember-l',
          skuName: 'COS-EMB-L',
          size: 'L',
        },
      ],
    },
  ],
} as const;

/**
 * SHOOT — the dedicated MUTABLE target for `tests/shoot-shell.spec.ts`
 * (Phase 5e-II flag-ON lane). That spec taps the shell's status row on this
 * shot (status write + version snapshot), so by the shot-ownership map
 * (AURORA read-only · EDITABLE status/notes/title · HERO hero-only · RICH
 * display-only) NO other spec may read-assert or mutate it — the suite runs
 * fullyParallel and a shared mutable shot races. Title token "Meridian" is
 * unique (never Aurora/Borealis/Spectra/Helios/Cascade), so per-title
 * assertions elsewhere are unaffected. Re-seeded to status=todo every run.
 */
export const SEED_SHOT_SHOOT = { id: 'e2e-shot-shoot', title: 'Meridian Set Shot' } as const;

/**
 * LEGACY — a projectId === '' shot (the mapShot.ts missing-projectId fallback
 * shape) for the 5e-II Decision D pin: crew-uneditable at the rules level
 * (shotProjectRole's legacy arm admits only admin/global-producer), so the
 * Shoot shell renders existing deep-links READ-ONLY with a quiet note.
 * It can NEVER appear in any project's shot list (useShots filters
 * `where('projectId','==',projectId)`), so it is deep-link-only by
 * construction and invisible to every other spec. Because its projectId is
 * '', clearShotsCrudData's projectId==SEED_PROJECT_ID query also misses it —
 * the clear deletes this doc id explicitly. Token "Relic" is unique.
 */
export const SEED_SHOT_LEGACY = { id: 'e2e-shot-legacy', title: 'Relic Archive Shot' } as const;

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
