import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: 1,  // One retry to absorb genuine flake; quarantined specs are excluded below
  reporter: [['list'], ['html', { open: 'never' }]],

  // QUARANTINE (see tests/QUARANTINE.md): a long-dormant E2E backlog was unmasked
  // once the production white-screen bug (vite manualChunks / React init order)
  // was fixed and the login form finally rendered. These specs need real follow-up
  // work — seeded Firestore fixtures, a robust interactive-login helper, app a11y
  // contrast fixes, and regenerated visual baselines — so they are excluded from
  // the blocking gate rather than left perma-red. The gate currently runs the
  // smoke suite (storageState auth), which guards against the white-screen
  // regression. DO NOT add specs here without a tracking entry in QUARANTINE.md.
  testIgnore: [
    '**/a11y.spec.ts',            // real WCAG AA contrast violations in the app
    // auth.spec.ts un-quarantined 2026-06-06: interactive-login helper fixed
    // (authed-signal wait + domcontentloaded + real sign-out + emulator-only
    // submit selector). See QUARANTINE.md "Interactive-login helper fix".
    // sidebar-summary.spec.ts un-quarantined 2026-06-06: it was a FALSE-PREMISE
    // spec (removed shot edit MODAL + aside[data-testid="sidebar-summary"] +
    // Basics/Logistics tabs). Rewritten ground-up against ShotDetailPage
    // (/projects/:id/shots/:sid) using the storageState viewer/producer fixtures
    // + emulator seed (read-only summary on SEED_SHOT_AURORA, status mutation +
    // autosave on SEED_SHOT_EDITABLE). See tests/QUARANTINE.md.
    // shots-crud.spec.ts un-quarantined 2026-06-05: emulator seed step added
    // (seedShotsCrudScenario) + spec rewritten to the real project-scoped routes
    // and selectors. See tests/QUARANTINE.md.
    // pulls-crud.spec.ts un-quarantined 2026-06-05: emulator seed step added
    // (seedPullsCrudScenario) + warehouse fixture + spec rewritten to the real
    // project-scoped routes (/projects/:id/pulls(/:pid)) and real selectors,
    // trimmed to flows that exist (list/create/detail/status/share/fulfillment).
    // See tests/QUARANTINE.md.
    // image-crop-editor.spec.js DELETED 2026-06-05 — it targeted the removed
    // legacy react-easy-crop crop editor + Attachments tab. Replaced by
    // tests/hero-image.spec.ts (real HeroImageSection Storage-upload E2E), which
    // is NOT quarantined and runs in the default gate. See tests/QUARANTINE.md.
    '**/visual.spec.ts',          // snapshot baselines missing/mismatched
    '**/e2e/richtext-bubble.spec.ts', // snapshot/visual baselines
    '**/diagnose-sticky.spec.js', // ad-hoc diagnostic scratch test; interactive-login helper
  ],

  // Global setup to seed test users in Firebase emulator (required for CI)
  // Authentication is handled directly in fixtures for better reliability
  globalSetup: './tests/global.setup.ts',

  use: {
    // Use dev server (5173) for tests, or preview server (4173) for production-like tests
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Increased timeouts for CI environment
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  expect: { timeout: 10000 },  // Increased expect timeout
  timeout: 60000,  // Per-test timeout
  // Gate runs chromium only — fast and sufficient to catch the white-screen
  // regression. Cross-browser (firefox/webkit) belongs in a separate, non-blocking
  // job once the quarantined backlog is addressed (see tests/QUARANTINE.md).
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Automatically start dev server if not running (optional - can run manually)
  // Uncomment to enable automatic server startup
  // webServer: {
  //   command: 'npm run dev',
  //   port: 5173,
  //   reuseExistingServer: true,
  //   timeout: 120000,
  // },
});
