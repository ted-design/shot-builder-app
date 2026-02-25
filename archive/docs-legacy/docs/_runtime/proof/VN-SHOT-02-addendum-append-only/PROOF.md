# VN-SHOT-02-addendum-append-only — Visual Proof

## Route Tested
`/projects/K5UpgJI9qeIz2l2oIKQg/shots/99fyBpVXBQdHhuMoawFw` (Shot #18, "On-Fig")

## States Verified

### 1. Desktop — Full Page with Legacy Notes
- **File**: `01-desktop-legacy-notes.png`
- **Assertion**: Full shot detail page. Legacy HTML notes render "Shot with the carryology shirt in black." as read-only text. No textarea for notes. Producer Addendum shown as read-only text. Append input + button below.
- **Viewport**: 1280x900 (desktop)

### 2. Desktop — Addendum Section (Zoomed)
- **File**: `02-desktop-addendum-before.png`
- **Assertion**: Zoomed view of notes + addendum section. Notes label + read-only text. Producer Addendum label + existing entries as read-only `<p>` (not textarea). "Add to addendum..." empty textarea below. "Add to addendum" button visible.
- **Viewport**: 1280x900 (desktop, element screenshot)

### 3. Desktop — After Append
- **File**: `03-desktop-addendum-after.png`
- **Assertion**: After typing "Re-execution proof: async-safe append" and clicking button: addendum now shows 3 entries as read-only text (all prior entries preserved, new entry appended). Textarea cleared. Button disabled (empty input).
- **Viewport**: 1280x900 (desktop, element screenshot)

### 4. Mobile — Full Page (375px)
- **File**: `04-mobile-notes-addendum.png`
- **Assertion**: Full-page screenshot at 375x812. Notes label + read-only legacy text visible. Producer Addendum + all entries visible. "Add to addendum..." textarea operable. Button visible. Tags ("Men") visible. All fields read-only except addendum append and status.
- **Viewport**: 375x812 (mobile)

## Invariants Confirmed
1. Legacy `notes` field rendered read-only — no textarea, no edit affordance
2. Existing addendum content is read-only `<p>` — cannot be edited in-place
3. New entries append via separate textarea + explicit button action
4. Prior addendum text preserved after append (not overwritten)
5. Mobile shows both notes and addendum; addendum append is operational
6. Input only clears after successful save (async-safe)

## Checks Passed
- `npx tsc --noEmit` — clean
- `npm run lint` — zero warnings
- `npm run build` — successful (7.23s)
- `npm test` — 1391 passed, 0 failed (100 files passed, 2 skipped)
