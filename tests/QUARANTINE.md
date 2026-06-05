# E2E (`ui-checks`) Quarantine & Backlog

_Last updated: 2026-06-05_

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

This set exercises authenticated page loads + CRUD and so directly guards against
the white-screen regression and the shot data path.

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

## Quarantined specs (excluded via `testIgnore` in `playwright.config.ts`)

| Spec | Category | Failure | Fix needed |
|---|---|---|---|
| `a11y.spec.ts` | App a11y | 93+ genuine WCAG AA contrast violations (e.g. muted `#71717a` on `#f4f4f5` = 4.39 vs 4.5) | Fix app contrast tokens (touches brand palette — product/design decision) or adjust the assertion threshold |
| `auth.spec.ts` | Test infra | `helpers/auth.ts` interactive login times out on the post-login `waitForURL` redirect | Make the helper rehydrate via the app's real modular-SDK persistence (or switch these specs to storageState fixtures) |
| `sidebar-summary.spec.ts` | Test infra | Same interactive-login helper root cause | As above |
| `pulls-crud.spec.ts` | Obsolete + fixtures | Navigates to a nonexistent top-level `/pulls` route (real route is `/projects/:id/pulls` → it lands on NotFoundPage); 7 of 9 tests wrap assertions in `if (await x.isVisible())` so they pass vacuously; several target UI that does not exist (Add-item dialog, PDF export, quantity editor, per-card delete — pull items are derived from shots, not hand-added); the fulfill test uses `producer` but only admin/warehouse can fulfill | **Deferred** (Ted, 2026-06-05): rewrite to project-scoped routes + real selectors and trim to flows that exist (create / view / status / share); revisit when pull-item editing UI exists. Do **not** un-quarantine as-is (the vacuous guards would give a false green). Seed already covers a project; extend with an app-shaped pull when rewriting |
| `image-crop-editor.spec.js` | Obsolete | Targets a **removed legacy** UI: the `react-easy-crop` "Crop & Adjust Image" editor, an "Attachments" tab, an "Edit crop" button and `[data-testid=attachment-thumbnail]` live only in `archive/legacy-src-2026-04/`; `react-easy-crop` is not installed; the current app stores a single `heroImage` per shot (`HeroImageSection`). The spec also imports bare `@playwright/test` (no storageState → unauthenticated) | **Deferred** (Ted, 2026-06-05): seeding alone can never make it green. Rewrite against `HeroImageSection` on the shot detail page (use the producer storageState fixture) or delete the spec. Not just a seed task |
| `visual.spec.ts` | Snapshots | Baselines missing/mismatched | Regenerate baselines on the CI runner image |
| `e2e/richtext-bubble.spec.ts` | Snapshots | Baselines missing/mismatched | Regenerate baselines |
| `diagnose-sticky.spec.js` | Scratch | Ad-hoc sticky-toolbar diagnostic that drives the broken interactive-login helper (1-min timeout) | Delete it, or convert to a real assertion once the login helper is fixed |

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
2. **Rewrite `pulls-crud`** — to project-scoped routes + real selectors, trimmed
   to flows that exist; extend the seed with an app-shaped pull. (Deferred per Ted.)
3. **Rewrite or delete `image-crop-editor`** — against `HeroImageSection`, not the
   removed legacy crop editor. (Deferred per Ted.)
4. **Robust interactive-login helper** — fixes `auth` + `sidebar-summary`.
5. **App a11y contrast** — product/design pass on muted-text tokens (review with Ted).
6. **Visual baselines** — regenerate on the CI runner image; un-quarantines
   `visual` + `richtext-bubble`.
7. **Cross-browser job** — re-add firefox/webkit as a separate, non-blocking job
   once the above land.
