# E2E (`ui-checks`) Quarantine & Backlog

_Last updated: 2026-06-06_

## Why this file exists

The Playwright `ui-checks` job failed on **every PR since ~April 2026**. The root
cause was **not** the auth bootstrap, as long suspected — it was a **production
white screen**: `vite.config.js`'s `manualChunks` forced React out of all named
chunks, so Rollup could initialize a React-consuming vendor chunk before React
itself. React's CJS namespace was undefined when `exports.Children = …` ran,
throwing `Cannot set properties of undefined (setting 'Children')` and leaving
`#root` empty. The Playwright login form never rendered → global setup timed out →
no feature test ever ran.

**Fixed** (commit `cb866701`): React + all eager vendor libs now share one acyclic
`vendor` chunk; only genuinely lazy/heavy deps (pdf, firebase, dnd, panels) are
split out. Verified locally (emulator + normal builds render) and in CI
(`build`/`preview` pass; the login form renders; setup succeeds).

Fixing the white screen **unmasked a long-dormant test backlog** — 134 failures
across the suite that had been hidden for months. Per decision (2026-06-04), the
gate is **stabilized now**: it runs the reliably-green smoke suite (chromium only),
and the dormant specs are quarantined here rather than left perma-red. This stops
the "merge past red" norm without silently dropping coverage.

## What the gate runs today

- **`tests/smoke.spec.ts`** (storageState auth) — chromium only, `retries: 1`.
  - ✅ `producer can access dashboard and create shot`
  - ✅ `producer can navigate between pages`
  - ✅ `viewer has read-only access`
  - ⏸️ `admin can access admin page` — `test.fixme` (see below)
- **`tests/shots-crud.spec.ts`** (storageState auth) — chromium only. Un-quarantined
  2026-06-05. Hard-asserts the real, project-scoped shot lifecycle against a
  seeded fixture: list (read), create, detail deep-link (read), search filter,
  inline rename (update), and create-then-delete (delete).
- **`tests/pulls-crud.spec.ts`** (storageState auth) — chromium only. Un-quarantined
  2026-06-05. Hard-asserts the real, project-scoped pull lifecycle against a
  seeded fixture (`seedPullsCrudScenario`: one app-shaped pull + one item under
  `e2e-seed-project`): list read (seeded pull card), create (new pull sheet),
  detail deep-link (name + item family + "Items (1)"), status change (→
  Published), share/unshare, and fulfillment from **both** RBAC sides — producer
  toggle **disabled** (`canFulfillPulls` excludes producer) and warehouse live
  Pending→Fulfilled (via the new `warehousePage` fixture). Sets an explicit
  desktop viewport because `canEdit = canManagePulls && !isMobile`.

- **`tests/hero-image.spec.ts`** (storageState auth) — chromium only. Added
  2026-06-05 to replace the deleted `image-crop-editor.spec.js`. Hard-asserts the
  real Firebase Storage hero-upload flow on the shot detail page
  (`HeroImageSection`) against a dedicated seeded shot (`SEED_SHOT_HERO`): empty
  state → upload (`<img alt="Hero">` + Replace + Reset appear) → replace → reset
  (back to "Add hero image"). Drives the hidden hero `input[type=file]` via its
  `data-testid="hero-image-file-input"` (three file inputs exist on the page).
  Requires the Storage emulator (see below) and a desktop viewport (`canEdit`
  needs `!isMobile`). Runs serial — it mutates the shared seeded shot.

- **`tests/auth.spec.ts`** (interactive login, NO storageState) — chromium only.
  Un-quarantined 2026-06-06. The ONLY suite that drives the real login form, so
  it covers what storageState fixtures cannot: sign-in, sign-out, redirect when
  unauthenticated, session persistence across reload, and the invalid-credential
  error path (5 tests). See "Interactive-login helper fix" below.

This set exercises authenticated page loads + CRUD and so directly guards against
the white-screen regression and the shot + pull data paths.

## Interactive-login helper fix (added 2026-06-06)

`tests/helpers/auth.ts` (`authenticateTestUser`) timed out on its post-login
`waitForURL` — NOT because of selectors or the URL regex (both matched the real
`/projects` landing), but because:

1. **`waitUntil: 'networkidle'`** on its `goto`/`reload` fought the Firebase
   emulator's long-lived streaming connections (Firestore listeners,
   Installations), which never go idle — the page could submit in an unsettled
   state and the wait could hang until timeout. Changed to `'domcontentloaded'`.
2. **It raced a single client-side redirect** (`waitForURL`). The redirect is
   driven in-app (`onIdTokenChanged → claims → navigate('/projects')`) and can
   lag. Replaced with a wait on concrete authed SIGNALS — the emulator login
   form **detaches**, `location.pathname` leaves `/login`, and the app nav
   renders. This mirrors the proven-stable shape `global.setup.ts` relies on.
3. **Its submit selector clicked the wrong button.** The old selector listed
   `..., button:has-text("Sign in"), ...` and `.first()` returns the DOM-first
   match — which is the Google OAuth button ("Sign in **with Google**" contains
   "Sign in" and renders before the emulator form), opening a popup so the form
   never submitted. Narrowed to `[data-testid="emulator-login-form"]
   button[type="submit"], button[type="submit"]` (the Google button is
   `type="button"`, so it's excluded), matching `global.setup.ts`. This was the
   first-CI-run failure on the two helper-driven tests.

The `signOut` helper was also broken: it looked for `button[aria-label*="user"]`
/ `button:has-text("Sign out")`, but the real control is an **icon-only** button
in `SidebarUserSection` with `aria-label="Sign out"` (no visible text, no
separate user-menu trigger). It now clicks `button[aria-label="Sign out"]`
directly and waits for the genuine redirect to `/login`.

The only app-source change is a behavior-free `data-testid="login-error"` on
`LoginPage.tsx`'s error `<p>`, so the invalid-credential test can scope to the
real error element instead of a page-wide text regex.

`auth.spec.ts` was trimmed to the 5 genuine login-flow tests. The 3 prior
role-access tests (non-admin/viewer/producer on `/products`) were dropped — two
had vacuous `if (count > 0)` guards that silently passed (≈no coverage), and
real RBAC coverage already lives in smoke + shots-crud via storageState. The
`admin role can access admin page` test was dropped as a duplicate of
smoke.spec.ts's `test.fixme` (same unresolved admin-heading gap, below).

## Emulator seed (added 2026-06-05)

`tests/global.setup.ts` now seeds a deterministic Firestore fixture after the
role users are created and before any spec runs (`seedShotsCrudScenario` in
`tests/helpers/seed.ts`; IDs/titles in `tests/helpers/seedConstants.ts`): one
team-visible project (`e2e-seed-project`) plus three app-shaped shots. Two prior
bugs were fixed so the seed is actually visible to the app:

1. **Partition** — `seed.ts` initialized firebase-admin with `demo-test-project`;
   the app/emulator/`global.setup.ts` use `demo-test`. Fixed to `demo-test`, and
   the helper now reuses the already-initialized admin app (a second
   `initializeApp` throws "default app already exists").
2. **Shot shape** — seeded shots omitted `deleted` and `date`; the shot-list
   query filters `where('deleted','==',false)` and orders by `date`, so docs
   missing either field are excluded. Seed now mirrors `CreateShotDialog`'s write.

## Pulls seed + warehouse fixture (added 2026-06-05)

`tests/global.setup.ts` now also seeds a deterministic pull fixture
(`seedPullsCrudScenario` in `tests/helpers/seed.ts`; constants `SEED_PULL` /
`SEED_PULL_ITEM` in `tests/helpers/seedConstants.ts`) **after**
`seedShotsCrudScenario` (which creates the `e2e-seed-project` doc the pull lives
under). It writes ONE app-shaped pull at
`clients/test-client/projects/e2e-seed-project/pulls/e2e-seed-pull` with one item
(family `Helios Jacket`, size `M`), mirroring `createPullFromShots.ts` (the
canonical app writer): Date values coerce to Firestore Timestamps; `familyId` +
`size` are non-empty (mapItem/mapSize drop items/sizes missing them);
`colourName` uses British spelling. The pulls subcollection is cleared first
(`clearPullsCrudData`, CHUNK=250) so the dataset is identical each run and any
pull the create-test makes is wiped on the next setup.

A new **`warehouse`** role user was added to `TEST_USERS` (and `TEST_CREDENTIALS`)
with the `warehousePage` fixture in `tests/fixtures/auth.ts` — warehouse is a
distinct RBAC role from wardrobe (`canFulfillPulls` = admin|warehouse only), so
the pulls spec can cover fulfillment from both the producer-disabled and the
warehouse-live side. Because `firestore.rules` gates pull read/write on
`hasProjectRole(...,'warehouse')` (the warehouse user's *global* role satisfies
neither `isAdmin` nor `producerCanAccessProject`), `seedPullsCrudScenario` also
writes a project **members** doc (`.../projects/e2e-seed-project/members/<warehouse-uid>`,
role `warehouse`) using the uid captured from `createOrUpdateTestUser` in
`global.setup.ts`. Without it the warehouse user cannot even read the seeded pull.
Producer needs no member doc — its global role satisfies `producerCanAccessProject`
on a team-visible project.

## Storage emulator (added 2026-06-05)

`hero-image.spec.ts` uploads to Firebase Storage, so the `ui-checks` "Start
Firebase Emulators" step now launches it: `--only auth,firestore,storage` (was
`auth,firestore`), with a readiness wait on **port 9199**. NOTE: unlike the
auth/firestore emulators (which 200 at `GET /`), the Storage emulator has no `/`
route and 404s there, so the probe hits the bucket-list route instead (`timeout
60 bash -c 'until curl -sf http://localhost:9199/b ...'`). `firebase.json` already declares the storage
emulator (port 9199) and points `storage` → `storage.rules` (auto-loaded);
`VITE_FIREBASE_STORAGE_BUCKET=demo-test.appspot.com` and Java 21 were already
set, so no new env/secret was needed. `storage.rules` permits the producer to
write+read `clients/test-client/shots/<shotId>/hero.webp` purely on
`role(producer) ∈ {producer,wardrobe,admin}` + `userClient() == clientId` +
image contentType <10MB — no project-membership doc required (unlike pulls).

## Quarantined specs (excluded via `testIgnore` in `playwright.config.ts`)

| Spec | Category | Failure | Fix needed |
|---|---|---|---|
| `a11y.spec.ts` | App a11y | 93+ genuine WCAG AA contrast violations (e.g. muted `#71717a` on `#f4f4f5` = 4.39 vs 4.5) | Fix app contrast tokens (touches brand palette — product/design decision) or adjust the assertion threshold |
| `sidebar-summary.spec.ts` | False premise / stale UI | Targets a shot **edit modal** (`role="dialog"`) with an `aside[data-testid="sidebar-summary"]` + Basics/Logistics tabs + "No date scheduled"/"No location" strings — **none of which exist** in current source. Editing now happens on the detail **page** (`ShotDetailPage.tsx`). Essentially every selector is stale. (NOT the interactive-login helper — that's fixed.) | Ground-up rewrite against `ShotDetailPage` (producerPage fixture + `SEED_SHOT_AURORA`/`SEED_SHOT_EDITABLE`): status select + autosave Saving/Saved, Date/Location "Not set" empty states, Tags. The seed currently lacks date/location/tags data, so assert empty states or extend the seed. |
| `visual.spec.ts` | Snapshots | Baselines missing/mismatched | Regenerate baselines on the CI runner image |
| `e2e/richtext-bubble.spec.ts` | Snapshots | Baselines missing/mismatched | Regenerate baselines |
| `diagnose-sticky.spec.js` | Scratch | Ad-hoc sticky-toolbar diagnostic (1-min timeout); pre-dates and is unrelated to the now-fixed login helper | Delete it, or convert to a real assertion |

### Single-test quarantine

- `smoke.spec.ts › admin can access admin page` — `test.fixme`. The admin page
  renders no heading matching `/admin|user management|settings/i` in the emulator
  build (no admin-specific seed data / selector drift). Re-enable once the admin
  page exposes a stable heading or seed data is added.

## How to re-enable a quarantined spec

1. Do the "Fix needed" work for that row.
2. Remove its line from `testIgnore` in `playwright.config.ts` (or remove the
   `test.fixme` for a single test).
3. Run locally against the emulators per `.github/workflows/ui-checks.yml`
   (Firebase emulators on 9099/8080 + a `VITE_USE_FIREBASE_EMULATORS=1` build +
   preview on :4173 + `npx playwright test`). **Note:** the Firestore emulator
   needs Java 11+ (CI uses 21); a machine on Java 8 can build/preview and probe
   rendering but cannot run the full emulator suite locally.
4. Confirm green before un-quarantining.

## Sign-off (CLAUDE.md Rule 6b)

The a11y quarantine covers genuine WCAG AA violations (HIGH). Per Rule 6b these
require explicit user approval to defer rather than fix in-sprint. **Approved by
Ted on 2026-06-04** as the "stabilize the gate now, fix the dormant backlog
incrementally" path — the white-screen root cause (the months-long blocker) was
fixed; the unmasked a11y/CRUD/visual backlog is accepted as tracked follow-up
(below), not a merge blocker.

## Follow-up backlog (separate work)

1. ~~**Seed fixtures** — an emulator seed step so CRUD/image specs have data.~~
   **Done 2026-06-05** for shots (`seedShotsCrudScenario`), which un-quarantined
   `shots-crud`. The seed is reusable for the rewrites below.
2. ~~**Rewrite `pulls-crud`** — to project-scoped routes + real selectors, trimmed
   to flows that exist; extend the seed with an app-shaped pull.~~ **Done
   2026-06-05**: rewritten to `/projects/:id/pulls(/:pid)` + real selectors
   (list/create/detail/status/share/fulfillment), seed extended with an
   app-shaped pull (`seedPullsCrudScenario`), and a `warehouse` user +
   `warehousePage` fixture added so fulfillment is covered producer-disabled +
   warehouse-live. Un-quarantined.
3. ~~**Rewrite or delete `image-crop-editor`** — against `HeroImageSection`, not the
   removed legacy crop editor.~~ **Done 2026-06-05**: the legacy spec was deleted
   and replaced by `tests/hero-image.spec.ts`, a real `HeroImageSection`
   Storage-upload E2E (empty → upload → replace → reset) using the producer
   storageState fixture. The Storage emulator was wired into `ui-checks`
   (`--only ...,storage` + a 9199 readiness wait). Un-quarantined.
4. ~~**Robust interactive-login helper** — fixes `auth` + `sidebar-summary`.~~
   **Partly done 2026-06-06**: the helper was fixed (authed-signal wait +
   `domcontentloaded` + real `signOut` control) and `auth.spec.ts` un-quarantined.
   Scouting revealed `sidebar-summary` was NEVER a login-helper victim — it is a
   **false-premise spec** (targets a removed shot edit modal); it is now item 5.
5. **Rewrite `sidebar-summary`** — ground-up against `ShotDetailPage` (it targets
   a removed edit-modal sidebar; see the quarantine table for the real shape).
6. **App a11y contrast** — product/design pass on muted-text tokens (review with Ted).
7. **Visual baselines** — regenerate on the CI runner image; un-quarantines
   `visual` + `richtext-bubble`.
8. **Cross-browser job** — re-add firefox/webkit as a separate, non-blocking job
   once the above land.
