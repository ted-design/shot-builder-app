# PROOF — Advanced Schedule (Slice 3B)

Date: 2026-02-05

Scope:
- Multi-stream schedule editor usability (move between tracks)
- Output visualization of simultaneous entries + shared/banner entries
- Cascade timing on reorder/move
- Preview UX (show/hide via right-side slide-over)

## Tooling Note

⚠️ Chrome extension unavailable here for visual verification.
Manual QA + screenshots are required.

## Manual QA Checklist (Desktop)

Route:
- `/projects/:projectId/callsheet?scheduleId=:scheduleId`

### 1) Single-track editor baseline

Steps:
1. Open a schedule with a few entries (or add shots via **Add Shot**).
2. Verify the schedule is shown as a single list (no extra track columns).
3. Add a **Banner** via **Add Entry → Banner**.

Expected:
- Single list editor is calm and readable.
- Banner appears under a **Banners** section (only after at least one exists).

Screenshot:
- Single-track schedule with at least 2 entries + a banner.

### 2) Enable multi-track + move entries between tracks

Steps:
1. Click **Enable Multi** in the **Tracks** card.
2. Add at least one entry to Track 2.
3. Move an entry from Primary → Track 2 by:
   - Dragging via the left handle, and
   - Using the per-entry **Track** selector.

Expected:
- Movement is obvious and deterministic.
- Entry appears in the target track.
- No silent failures; errors surface as a toast.

Screenshot:
- Multi-track editor with at least one entry in each track.

### 3) Cascade timing on reorder (within a track)

Steps:
1. Ensure **Cascade** is ON.
2. In a track with 3+ entries, reorder an entry.

Expected:
- Moved entry + downstream entries in that track receive updated `startTime` values.

### 4) Cascade timing on move between tracks

Steps:
1. Ensure **Cascade** is ON.
2. Move an entry from Primary → Track 2 into the middle of the list.

Expected:
- In the source track, downstream entries shift to fill the gap.
- In the destination track, the moved entry + downstream entries shift to remain gapless.

### 5) Output visualization (preview)

Steps:
1. Click **Preview** (opens right-side slide-over).
2. Create an overlap band:
   - Set Track 1 and Track 2 entries to overlapping times (or leave times empty so derived times align).
3. Add a **Banner** and confirm it appears as a shared/full-width block in preview.

Expected:
- Overlapping entries appear grouped as **Simultaneous** bands.
- Banner entries render as shared/full-width blocks and break bands.

Screenshots:
- Preview showing a simultaneous overlap band.
- Preview showing a shared/banner entry spanning tracks.

### 6) Collapse to single track

Steps:
1. Click **Collapse** in **Tracks**.
2. Confirm the destructive dialog.

Expected:
- Entries merge into Primary.
- Ordering becomes chronological (startTime asc; tie: order; tie: id).
- Shared applicability is cleared.

Screenshot:
- Post-collapse single-track schedule.

