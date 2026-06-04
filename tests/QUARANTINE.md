# E2E (`ui-checks`) Quarantine & Backlog

_Last updated: 2026-06-04_

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

This smoke set exercises authenticated page loads and so directly guards against
the white-screen regression.

## Quarantined specs (excluded via `testIgnore` in `playwright.config.ts`)

| Spec | Category | Failure | Fix needed |
|---|---|---|---|
| `a11y.spec.ts` | App a11y | 93+ genuine WCAG AA contrast violations (e.g. muted `#71717a` on `#f4f4f5` = 4.39 vs 4.5) | Fix app contrast tokens (touches brand palette — product/design decision) or adjust the assertion threshold |
| `auth.spec.ts` | Test infra | `helpers/auth.ts` interactive login times out on the post-login `waitForURL` redirect | Make the helper rehydrate via the app's real modular-SDK persistence (or switch these specs to storageState fixtures) |
| `sidebar-summary.spec.ts` | Test infra | Same interactive-login helper root cause | As above |
| `shots-crud.spec.ts` | Fixtures | storageState auth works, but CRUD flows need seeded Firestore data + stable selectors | Add an emulator seed step (products/shots) and stabilize selectors |
| `pulls-crud.spec.ts` | Fixtures | Same — needs seeded data | As above |
| `image-crop-editor.spec.js` | Fixtures | Needs a seeded shot with an existing image | Seed a shot+image in the emulator |
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

## Follow-up backlog (separate work)

1. **Seed fixtures** — an emulator seed step so CRUD/image specs have data. Highest
   leverage: un-quarantines `shots-crud`, `pulls-crud`, `image-crop-editor`.
2. **Robust interactive-login helper** — fixes `auth` + `sidebar-summary`.
3. **App a11y contrast** — product/design pass on muted-text tokens (review with Ted).
4. **Visual baselines** — regenerate on the CI runner image; un-quarantines
   `visual` + `richtext-bubble`.
5. **Cross-browser job** — re-add firefox/webkit as a separate, non-blocking job
   once the above land.
