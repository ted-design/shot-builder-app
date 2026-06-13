# E2E (`ui-checks`) Quarantine & Backlog

_Last updated: 2026-06-11_

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
  - ✅ `admin can access admin page` — un-`fixme`'d 2026-06-06 (see below)
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

- **`tests/sidebar-summary.spec.ts`** (storageState auth) — chromium only.
  Un-quarantined 2026-06-06. Was a false-premise spec (a removed shot edit
  modal); rewritten ground-up against the shot DETAIL PAGE (`ShotDetailPage` at
  `/projects/:id/shots/:sid`). Hard-asserts the real summary surfaces against the
  seed: a **read-only** group (`viewerPage` + `SEED_SHOT_AURORA`, `canEdit=false`)
  asserting the status badge ("Draft"), empty meta cells (`meta-date`/
  `meta-location` "Not set", `meta-talent` "0 assigned"), and the empty Tags
  editor ("Add tags…"); and an **editing** group (serial, `producerPage` +
  `SEED_SHOT_EDITABLE`) that changes status via the Radix Select and proves
  persistence across reload (then resets to `todo`), plus the Notes autosave
  indicator reaching "Saved". See "Sidebar-summary rewrite" below.

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

## Sidebar-summary rewrite (added 2026-06-06)

`tests/sidebar-summary.spec.ts` was a **false-premise** spec, not a login-helper
victim: it drove a shot **edit modal** (`role="dialog"`) with an
`aside[data-testid="sidebar-summary"]`, a native `<select>` status control,
Status/Schedule/Tags sections, and Basics/Logistics `role="tab"` tabs — none of
which exist. The shot summary/edit experience is the detail **page**
(`ShotDetailPage`, `/projects/:id/shots/:sid`). It was rewritten ground-up
against the real page and the existing emulator seed, following the
`shots-crud.spec.ts` storageState pattern.

Selectors verified against `src-vnext` (the rewrite corrects three stale
assumptions in the original handoff):

1. **Status is a Radix Select, not a native `<select>`** — the trigger renders
   as a `role="combobox"` button (now `data-testid="shot-status-select-trigger"`)
   and options render in a portal `role="listbox"`. The test opens the trigger
   and clicks `getByRole('option', { name: ... })`; `selectOption`/`inputValue`
   would not work. Status labels: `todo`→"Draft", `in_progress`→"In Progress",
   `complete`→"Shot", `on_hold`→"On Hold".
2. **Autosave "Saving…/Saved" is per-editor, not page-level** — status/Date/
   Location/Talent/Tags save silently (status is optimistic; only a toast on
   failure). The `Saving…`/`Saved` indicator only renders inside the
   Description/Notes editors while they are mounted. The status test therefore
   proves persistence by **reloading**; the autosave indicator is covered via the
   already-instrumented Notes editor (`notes-read-mode`/`notes-input`/
   `notes-save-indicator`).
3. **`canEdit = canManageShots(role) && !isMobile`** — at desktop (the fixtures
   set 1280×720) a producer is an editor (cells show edit affordances) while a
   viewer is read-only (`ReadOnlyMetaValue`: "Not set"/"0 assigned"). The
   read-only summary group uses `viewerPage`; the editing group uses
   `producerPage`.

RBAC: shots are a **flat** `clients/{clientId}/shots/{id}` collection gated by
`clientMatches + isAuthed` only, so the producer needs no project members doc.
The viewer (also `clientId: 'test-client'`) can read the shot, BUT
`ShotDetailPage` → `useShotDetailBundle` also subscribes to the project's
**`lanes`** subcollection, whose read rule requires
`hasProjectRole(...,['producer','crew','warehouse','viewer'])` or
`producerCanAccessProject` (producer-global only). A viewer's global role
satisfies neither, and `useShotDetailBundle` folds the resulting `lanes.error`
into a **fatal** page error — so the detail page would blank out for a viewer.
(Adversarial verify caught this; `useShotDetailBundle.test.ts` documents the
lanes-error-is-fatal behavior.) Fix mirrors the warehouse-on-pulls pattern:
`seedShotsCrudScenario` now accepts a `viewerUid` and writes a project
`members/<uid>` doc (role `viewer`), wired from `global.setup.ts`. Membership
does NOT make the viewer an editor — the UI's `canEdit`/`canManageShots` keys off
the user's GLOBAL role (`rbac.ts`), so the viewer still renders the read-only
path. (Latent product note: a non-member viewer cannot open a shot detail page in
production for the same reason — out of scope for this E2E PR, tracked separately.)

App-source changes are behavior-free testability hooks only:
`data-testid="shot-status-select-trigger"` on `ShotStatusSelect`'s trigger, a
`testId` prop on `MetaEditorCard` (passed as `meta-date`/`meta-location`/
`meta-talent` in `ShotDetailPage`), and `data-testid="tags-section"` on the Tags
wrapper. The only seed change is the additive viewer member doc above — no shot
data was modified.

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

## Shoot-shell flag-ON lane (added 2026-06-11) — NOT a quarantine

`tests/shoot-shell.spec.ts` (Phase 5e-II) appears in `playwright.config.ts`'s
`testIgnore` **conditionally** — this is a build-flag **lane gate**, not a
quarantine, and it runs on **every PR**:

- `featureShootSurface` is a **build-time** flag (`VITE_SHOOT_SURFACE`,
  default OFF). The main `npx playwright test` run executes against the
  flag-OFF bundle, where the Shoot shell cannot render — running the spec
  there could only false-fail, so it is excluded **unless**
  `SHOOT_SURFACE_E2E=1` is set.
- `ui-checks.yml` then rebuilds with `VITE_SHOOT_SURFACE=1`, swaps the
  preview server, and runs `npx playwright test tests/shoot-shell.spec.ts`
  with `SHOOT_SURFACE_E2E=1` — the flag-ON lane. Both lanes block the merge.
- What the lane pins (the things only a flag-ON bundle + emulator can prove):
  member-crew lands on the shell through the real resolver chain with
  planning editors unmounted; a status tap passes the hardened
  `['producer','crew']` rules arm **and** the fire-and-forget version
  snapshot doc lands (the silent-failure regression pin); a legacy
  `projectId==''` deep-link renders read-only (Decision D); Back binds to
  the explicit list route.
- Dedicated fixtures: `SEED_SHOT_SHOOT` (this spec's mutable status target —
  no other spec may touch it) and `SEED_SHOT_LEGACY` (projectId `''`,
  deep-link-only by construction; `clearShotsCrudData` deletes it by fixed id
  since the projectId query can't see it).
- **Owner/phase to fold it into the default run:** the `featureShootSurface`
  flag-removal task (post-5e rollout) — when the default flips ON, delete the
  conditional `testIgnore` entry and the workflow lane, and the spec joins
  the main run.

## Quarantined specs (excluded via `testIgnore` in `playwright.config.ts`)

| Spec | Category | Failure | Fix needed |
|---|---|---|---|
| `visual.spec.ts` | Snapshots | Baselines missing/mismatched | Regenerate baselines on the CI runner image |
| `e2e/richtext-bubble.spec.ts` | Snapshots | Baselines missing/mismatched | Regenerate baselines |

(`diagnose-sticky.spec.js` was a scratch ad-hoc diagnostic with no assertions —
**deleted 2026-06-06** rather than quarantined; nothing of value lost.)

### Un-quarantined (resolved)

- ~~`a11y.spec.ts` — App a11y contrast (was: 93+ WCAG AA contrast violations,
  root cause muted `#71717a` failing 4.5:1 on light surfaces).~~ **Resolved
  2026-06-13 (Phase 7 PR-A).** The contrast token fix re-pointed
  `--color-text-muted` `#71717a`→`#52525b` and `--color-text-subtle`
  `#a1a1aa`→`#5b5b60` (both clear AA on every live light surface incl. the
  worst case `#e0e0e0`), and the `testIgnore` line was removed so the spec runs
  in CI. **Scoped to the `color-contrast` rule only** (Phase 7 Decision 4): the
  phase owns the contrast fix; pre-existing non-contrast violations are NOT
  Phase 7 blockers.
  - **Phase 8 follow-up — owner: Phase 8, condition: after Phases 1–7 freeze.**
    Inventory + fix the pre-existing NON-contrast wcag2a/aa violations
    (link-name, region, form labels, aria, etc.) on the four tested pages
    (`/`, `/products`, `/shots`, `/admin`), then broaden `a11y.spec.ts` back to
    `.withTags(['wcag2a','wcag2aa'])`. Until then the suite guards contrast only.

### Single-test quarantine

- ~~`smoke.spec.ts › admin can access admin page` — `test.fixme`.~~ **Resolved
  2026-06-06.** The skip was a stale selector, not a seed/data gap: `AdminPage`
  renders fine for the emulator admin (users read rule is `clientMatches &&
  isAuthed`; the admin user carries `clientId='test-client'`), but its heading is
  `<h1>Team</h1>` (`PageHeader title="Team"`), not `/admin|user management|
  settings/`. The test now asserts the real admin surface (the "Team" heading +
  the admin-only "Invite User" action) and is un-`fixme`'d.

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

The a11y quarantine covered genuine WCAG AA violations (HIGH). Per Rule 6b these
required explicit user approval to defer rather than fix in-sprint. **Approved by
Ted on 2026-06-04** as the "stabilize the gate now, fix the dormant backlog
incrementally" path — the white-screen root cause (the months-long blocker) was
fixed; the unmasked a11y/CRUD/visual backlog was accepted as tracked follow-up
(below), not a merge blocker. **The a11y contrast quarantine is now RESOLVED
(2026-06-13, Phase 7 PR-A)** — see "Un-quarantined (resolved)" above; the suite
runs in CI scoped to `color-contrast` (Decision 4), with the full-ruleset
broadening tracked as a Phase 8 row.

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
5. ~~**Rewrite `sidebar-summary`** — ground-up against `ShotDetailPage` (it targets
   a removed edit-modal sidebar).~~ **Done 2026-06-06**: rewritten against
   `ShotDetailPage` using the storageState viewer/producer fixtures + the existing
   seed (read-only summary on `SEED_SHOT_AURORA`; status mutation + reload
   persistence + Notes autosave on `SEED_SHOT_EDITABLE`). Un-quarantined. See
   "Sidebar-summary rewrite" above.
6. ~~**App a11y contrast** — product/design pass on muted-text tokens (review with Ted).~~
   **Done 2026-06-13 (Phase 7 PR-A).** 4-step text ramp landed (`--color-text-muted`
   → `#52525b`, `--color-text-subtle` → `#5b5b60`, new fenced `--color-text-disabled`);
   `a11y.spec.ts` un-quarantined, scoped to `color-contrast`. Phase 8 broadens to the
   full wcag2a/aa ruleset (see "Un-quarantined (resolved)").
7. **Visual baselines** — regenerate on the CI runner image; un-quarantines
   `visual` + `richtext-bubble`.
8. **Cross-browser job** — re-add firefox/webkit as a separate, non-blocking job
   once the above land.
