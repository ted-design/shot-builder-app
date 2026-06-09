import { test, expect } from './fixtures/auth';
import {
  SEED_PROJECT_ID,
  SEED_SHOT_AURORA,
  SEED_SHOT_EDITABLE,
} from './helpers/seedConstants';

/**
 * Shot detail "summary" E2E — REWRITTEN 2026-06-06 (was a false-premise spec).
 *
 * The original sidebar-summary.spec.ts targeted a REMOVED shot edit MODAL
 * (`role="dialog"`) with an `aside[data-testid="sidebar-summary"]`, a native
 * `<select>` status control, Status/Schedule/Tags sections, and Basics/Logistics
 * `role="tab"` tabs. NONE of that exists anymore — the shot summary/edit
 * experience is the detail PAGE (`ShotDetailPage` at `/projects/:id/shots/:sid`).
 * This is a ground-up rewrite that hard-asserts the REAL summary surfaces against
 * the Firestore emulator seed (see tests/helpers/seed.ts → seedShotsCrudScenario).
 *
 * Verified against src-vnext (2026-06-06):
 * - Status is a Radix Select (combobox trigger + portal listbox/options), NOT a
 *   native `<select>`. Labels: todo→"Draft", in_progress→"In Progress",
 *   complete→"Shot", on_hold→"On Hold". The trigger carries
 *   `data-testid="shot-status-select-trigger"` and is `disabled` for read-only
 *   roles (`canDoOperational = canManageShots(role)`).
 * - Date/Location/Talent render in MetaEditorCard cells
 *   (`data-testid` meta-date/meta-location/meta-talent). For a READ-ONLY role
 *   (viewer, `canEdit=false`) they show ReadOnlyMetaValue: Date "Not set",
 *   Location "Not set", Talent "0 assigned". For an EDITOR (producer desktop,
 *   `canEdit=true`) the same cells render edit affordances instead.
 * - Tags: `SectionLabel` "Tags" + `TagEditor`; an empty TagEditor button shows
 *   "Add tags…" (real ellipsis U+2026).
 * - Autosave "Saving…"/"Saved" is NOT shown for status/meta/tags — those save
 *   silently (status is optimistic; only a toast on failure). The indicator
 *   surfaces only in the Notes/Description editors while editing
 *   (`data-testid` notes-save-indicator / save-indicator). Status persistence is
 *   therefore proven by reloading the page, not by a "Saved" indicator.
 * - Seed: every SEED_SHOT is created with only {title, status:'todo'} — no date,
 *   location, or tags — so the summary asserts EMPTY states. (The Spectra filter
 *   fixtures in SEED_FILTER_SHOTS are separate and never deep-linked here.) The
 *   read-only group
 *   uses `viewerPage` + SEED_SHOT_AURORA (never mutated). The editing group uses
 *   `producerPage` + SEED_SHOT_EDITABLE, whose STATUS field is owned only by this
 *   spec (shots-crud only renames EDITABLE's title); it resets status afterward.
 *
 * There are intentionally NO `if (await x.isVisible())` guards: every assertion
 * fails loudly if the seed or a selector regresses.
 */

const detailUrl = (shotId: string) =>
  `/projects/${SEED_PROJECT_ID}/shots/${shotId}`;

// ── READ-ONLY SUMMARY (viewer → canEdit=false → ReadOnlyMetaValue) ───────────
test.describe('Shot detail summary (read-only)', () => {
  test('viewer sees status badge and empty Date/Location/Talent meta', async ({
    viewerPage,
  }) => {
    await viewerPage.goto(detailUrl(SEED_SHOT_AURORA.id));

    // "Back to Shots" only renders on the detail page — confirms we did not land
    // on NotFoundPage (i.e. the seeded shot is readable). Fails without the seed.
    await expect(
      viewerPage.getByRole('button', { name: /back to shots/i }),
    ).toBeVisible();
    await expect(
      viewerPage.getByText(SEED_SHOT_AURORA.title).first(),
    ).toBeVisible();

    // Seeded status (todo) renders as the "Draft" badge in the status control.
    await expect(
      viewerPage.getByTestId('shot-status-select-trigger'),
    ).toHaveText(/Draft/);

    // Empty meta — AURORA has date:null, locationId:null, 0 talent.
    await expect(viewerPage.getByTestId('meta-date')).toContainText('Not set');
    await expect(viewerPage.getByTestId('meta-location')).toContainText(
      'Not set',
    );
    await expect(viewerPage.getByTestId('meta-talent')).toContainText(
      '0 assigned',
    );
  });

  test('viewer sees the Tags section with an empty tag editor', async ({
    viewerPage,
  }) => {
    await viewerPage.goto(detailUrl(SEED_SHOT_AURORA.id));
    await expect(
      viewerPage.getByRole('button', { name: /back to shots/i }),
    ).toBeVisible();

    // Scope to the Tags section (TagEditor's popover renders its own "Tags"
    // heading when open — closed here for a read-only viewer, but scoping keeps
    // the section-label assertion robust). Assert the label + empty-state button.
    const tagsSection = viewerPage.getByTestId('tags-section');
    await expect(tagsSection.getByText('Tags', { exact: true })).toBeVisible();
    await expect(tagsSection.getByText('Add tags…')).toBeVisible();
  });
});

// ── EDITING (producer → canEdit=true). Serial: mutates the shared EDITABLE shot.
test.describe('Shot detail editing', () => {
  test.describe.configure({ mode: 'serial' });

  test('producer changes status via the select and it persists across reload', async ({
    producerPage,
  }) => {
    await producerPage.goto(detailUrl(SEED_SHOT_EDITABLE.id));
    await expect(
      producerPage.getByRole('button', { name: /back to shots/i }),
    ).toBeVisible();

    // Drive to "In Progress" without first hard-asserting the seeded "Draft":
    // this keeps the test idempotent across a mid-mutation retry (if a prior
    // attempt left EDITABLE in_progress, selecting it again is a no-op and the
    // assertions still hold). The seeded "Draft" baseline is covered by the
    // read-only AURORA test. Status is a Radix Select (NOT a native <select>).
    const trigger = producerPage.getByTestId('shot-status-select-trigger');
    await trigger.click();
    await producerPage.getByRole('option', { name: 'In Progress' }).click();
    await expect(trigger).toHaveText(/In Progress/); // optimistic UI updated

    // Prove the write actually reached Firestore — not just the optimistic label,
    // which ShotStatusSelect sets BEFORE it awaits updateShotWithVersion. Reload
    // until the committed value reads back, so a slow emulator commit can't lose
    // the race against a single reload fired while the write is still in flight.
    // (`trigger` is a lazy locator — it re-resolves against the reloaded page.)
    await expect(async () => {
      await producerPage.reload();
      await expect(trigger).toHaveText(/In Progress/, { timeout: 5000 });
    }).toPass({ timeout: 20000 });

    // Reset to the seeded baseline so reruns / other readers see status:'todo'.
    await trigger.click();
    await producerPage.getByRole('option', { name: 'Draft' }).click();
    await expect(trigger).toHaveText(/Draft/);
  });

  test('producer sees the autosave indicator reach "Saved" when editing notes', async ({
    producerPage,
  }) => {
    await producerPage.goto(detailUrl(SEED_SHOT_EDITABLE.id));
    await expect(
      producerPage.getByRole('button', { name: /back to shots/i }),
    ).toBeVisible();

    // Status/meta/tags save silently; the Notes editor is the real Saving…/Saved
    // surface (already instrumented with notes-read-mode / notes-input /
    // notes-save-indicator). Enter edit mode, type, and assert the indicator
    // settles on "Saved" while the editor is still mounted (it unmounts on blur).
    await producerPage.getByTestId('notes-read-mode').click();
    const input = producerPage.getByTestId('notes-input');
    await expect(input).toBeVisible();
    await input.fill(`E2E autosave ${Date.now()}`);

    // The indicator is non-idle (debounce 1.5s → "Saving…" → "Saved" held ~2s →
    // unmounts) only while the editor stays mounted. First confirm autosave fired
    // (either transient state), then that it settled on "Saved" — a generous
    // timeout absorbs a slow CI emulator write within the ~2s "Saved" window.
    const indicator = producerPage.getByTestId('notes-save-indicator');
    await expect(indicator).toHaveText(/Saving…|Saved/);
    await expect(indicator).toHaveText(/Saved/, { timeout: 15000 });
  });
});
