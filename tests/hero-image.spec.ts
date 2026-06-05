import { test, expect } from './fixtures/auth';
import { SEED_PROJECT_ID, SEED_SHOT_HERO } from './helpers/seedConstants';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Hero-image E2E — exercises the real Firebase Storage hero-upload flow on the
 * shot detail page (`HeroImageSection`), against the Firestore + Storage
 * emulators. This replaces the obsolete `image-crop-editor.spec.js`, which
 * targeted a removed react-easy-crop editor + Attachments tab. The current app
 * has NO crop UI — a hero image is a single Storage upload re-encoded to
 * `clients/<clientId>/shots/<shotId>/hero.webp`.
 *
 * Every assertion is unconditional. The one `isVisible()` branch (step b) is
 * retry-safe SETUP that normalizes the shared seeded shot back to the empty
 * state — it is not a swallowed assertion. If the seed, route,
 * storage-emulator, or selector regresses, this test must fail loudly.
 *
 * Notes on the real app (verified against src-vnext):
 * - HeroImageSection is mounted on the shot detail page at
 *   `/projects/:id/shots/:sid` (there is NO top-level `/shots` route).
 * - Upload is gated on `canEdit = canManageShots(role) && !isMobile`. Producer
 *   satisfies the role; the desktop viewport below satisfies `!isMobile`.
 * - There are THREE `input[type=file]` on the detail page (looks, look-cover,
 *   hero), so the hero input is driven via its dedicated
 *   `[data-testid="hero-image-file-input"]`, not a bare `input[type=file]`.
 * - The "Reset" button renders only when `heroImage.path` includes
 *   `/hero.webp` — which `uploadHeroImage` always produces, so Reset appears
 *   after a successful upload.
 */

// Resolve the real 800×600 JPEG fixture relative to this spec file.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(__dirname, 'fixtures/test-image.jpg');

const HERO_SHOT_URL = `/projects/${SEED_PROJECT_ID}/shots/${SEED_SHOT_HERO.id}`;

// Desktop viewport — `canEdit` requires `!isMobile`, so the upload affordances
// only render above the mobile breakpoint.
test.use({ viewport: { width: 1280, height: 800 } });

// Serial: the single test mutates the shared seeded shot's heroImage.
test.describe.configure({ mode: 'serial' });

test.describe('Hero image upload', () => {
  test('producer can add, replace, and reset a hero image', async ({ producerPage }) => {
    await producerPage.goto(HERO_SHOT_URL);
    await producerPage.locator('main, [role="main"]').first().waitFor({ state: 'visible' });

    // ── SETUP (retry-safe normalize, NOT an assertion) ──────────────────────
    // If a prior failed attempt left a hero on this shared seeded shot, clear it
    // so the test always starts from the empty state. Reset only exists when a
    // hero is present, so this branch is the explicit recovery path.
    const resetButton = producerPage.getByRole('button', { name: 'Reset' });
    if (await resetButton.isVisible()) {
      await resetButton.click();
      await producerPage
        .getByRole('button', { name: 'Add hero image' })
        .waitFor({ state: 'visible' });
    }

    // ── EMPTY STATE ─────────────────────────────────────────────────────────
    await expect(producerPage.getByRole('button', { name: 'Add hero image' })).toBeVisible();

    const heroInput = producerPage.locator('[data-testid="hero-image-file-input"]');

    // ── UPLOAD ──────────────────────────────────────────────────────────────
    // Drive the hidden input directly (it is display:none — do NOT click it).
    await heroInput.setInputFiles(fixturePath);

    // Upload re-encodes via canvas, writes to Storage, then resolves a download
    // URL — all async. Give the <img> a generous timeout for auto-retry.
    await expect(producerPage.getByAltText('Hero')).toBeVisible({ timeout: 30000 });
    await expect(producerPage.getByRole('button', { name: 'Replace' })).toBeVisible();
    await expect(producerPage.getByRole('button', { name: 'Reset' })).toBeVisible();

    // ── REPLACE ─────────────────────────────────────────────────────────────
    // Re-uploading the same fixture to the same fixed path (hero.webp) yields a
    // visually identical image, so a visible <img> alone can't prove the replace
    // succeeded. HeroImageSection swallows upload errors into a toast, so also
    // assert no "Upload failed" toast appears — that catches a thrown-then-caught
    // replace failure the img check would miss. (Version-history writes are
    // fire-and-forget and intentionally out of scope for this spec.)
    await heroInput.setInputFiles(fixturePath);
    await expect(producerPage.getByAltText('Hero')).toBeVisible({ timeout: 30000 });
    await expect(producerPage.getByText('Upload failed')).toHaveCount(0);

    // ── RESET ───────────────────────────────────────────────────────────────
    await producerPage.getByRole('button', { name: 'Reset' }).click();
    await expect(producerPage.getByRole('button', { name: 'Add hero image' })).toBeVisible();
  });
});
