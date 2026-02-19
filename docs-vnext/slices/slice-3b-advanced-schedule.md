# Slice 3B — Advanced Schedule (Multi‑Stream + Cascade Timing + Visualization)

> Execution contract — v1.0 2026-02-05

## Why This Slice Exists

Slice 3 delivered call sheet assembly with a single-stream schedule list.
Legacy producers relied on two additional capabilities to safely ship a schedule at 1am:

1. **Multi-stream schedules** — represent simultaneous work (parallel tracks) and shared events.
2. **Cascade timing** — reordering updates downstream timing deterministically.
3. **Nuanced visualization** — simultaneous items are visible without clicking; shared items read as full-width.

This slice adds those capabilities without changing Firestore collection layout.
It is an extension of Slice 3 (assembly) and a prerequisite for trusted Slice 4 output parity.

---

## Goals (110% Done)

### G1 — Multi‑Stream Data Model (Backwards Compatible)
- A schedule may define **one or more tracks**.
- Entries belong to a single track **or** may be marked as **shared** across tracks (banner/full-width).
- Track names are user-defined and non-semantic (no “Photo/Video” assumptions).
- Schedules created in vNext default to **single track**.

### G2 — Cascade Timing (Producer‑Safe)
- When cascade is ON, reordering an entry within a track recomputes `startTime` for the moved entry and all downstream entries in that track (gapless, deterministic).
- When cascade is OFF, reordering does not change times (only order).
- Time storage is **canonical**: persist `startTime` in **24h `"HH:MM"`** for math correctness.
- UI display is **12h** (e.g. “6:00 AM”).

### G3 — Output Visualization (Trust Layer)
- Call sheet preview and print/PDF output visualize simultaneous entries clearly:
  - Parallel items are shown side-by-side within overlap “bands”
  - Shared/banner items render full-width and break bands
- Visualization is derived from a single, canonical projection (deterministic).

### G4 — Track Transformations (Fast Under Pressure)
- Convert single → multi by adding tracks (no data loss).
- Convert multi → single via an explicit “Collapse to single track” action:
  - Entries merge into primary track
  - Ordering becomes chronological (startTime asc; tie: order; tie: id)
  - Shared applicability is cleared (no longer meaningful in single track)

### G5 — Adaptive Timeline Visualization (Editor View)
- The call sheet builder's schedule editor replaces the flat DnD list with an **Adaptive Timeline**.
- Information-weighted time blocks: dense periods (many overlapping events) expand, sparse periods (load-in, lunch) compress to banners.
- **Segment algorithm** (`lib/adaptiveSegments.ts`):
  - Consumes `buildScheduleProjection()` output — no direct time parsing.
  - Merges overlapping intervals with 5-min tolerance into dense blocks.
  - Each block gets an adaptive `pxPerMin` rate: 8px/min (dense, >= 0.1 events/min), 6px/min (moderate), 4px/min (sparse).
  - Banners render as compressed gradient pills; gaps render as dashed indicators.
- **Cards** (`AdaptiveEntryCard.tsx`):
  - Absolutely positioned within dense blocks (`top = (startMin - blockStart) * pxPerMin`).
  - Left color bar by entry type, track dot, shot number badge, time + duration header.
  - Metadata rows (products, talent, location, notes) with semantic icon colors (teal, indigo, emerald, amber).
  - Each metadata row truncates independently with `text-overflow: ellipsis` — no card-level clipping.
  - Min-height enforcement: `max(duration * pxPerMin, 54px + min(visibleFields, 2) * 18px)`.
- **Cross-track alignment**: events at the same start time appear at the same Y position across Photo/Video tracks.
- **Click-to-edit**: clicking a card opens `ScheduleEntryEditSheet` (no inline editing).
- **Unscheduled tray**: untimed entries render in a responsive grid below the timeline with dashed-border cards.
- **Field visibility**: controlled by `ScheduleBlockFields` from `useCallSheetConfig` (reused from call sheet output controls).

---

## Firestore Contract (No New Collections)

Paths remain:

`clients/{cid}/projects/{pid}/schedules/{sid}`
`clients/{cid}/projects/{pid}/schedules/{sid}/entries/{eid}`

### Schedule document (extensions; optional)
- `tracks: Array<{ id: string; name: string; order: number }>` (optional)
- `settings: { cascadeChanges: boolean; dayStartTime: string; defaultEntryDuration: number }` (optional)

### Entry document (extensions; optional)
- `trackId: string` (optional; defaults to primary)
- `startTime: string | null` (optional; canonical `"HH:MM"`)
- `appliesToTrackIds: string[] | null` (optional; shared/subset applicability)

Legacy fields are tolerated:
- `time` (string) — accepted on read, normalized into `startTime` when possible.

---

## UX Rules (Calm + Explicit)

- Default view is **single track** and should feel like a simple list editor.
- Multi-stream is progressive disclosure: tracks appear only when enabled or when multiple tracks exist.
- Moving entries between tracks must be obvious:
  - Drag using the handle on the left edge of an entry, **or**
  - Use the per-entry **Track** selector (non-drag fallback).
- Explicit states:
  - Invalid time input: entry does not save; show a clear error toast.
  - Cascade ON: show a subtle label “Cascade ON — downstream times update”.
  - Collapse to single track: confirmation dialog + irreversible warning.

---

## Acceptance Criteria

### Correctness
- [ ] Creating a schedule writes default single-track settings (or renders safely if absent).
- [ ] Entries can be assigned to tracks; shared/banner entries render full width.
- [ ] Cascade reorder writes a single atomic batch and results match deterministic derived times.
- [ ] Collapse-to-single produces stable chronological ordering and leaves schedule readable.

### Trust
- [ ] Preview and print output use the same projection logic.
- [ ] Simultaneous items are visually grouped; shared items clearly break segments.
- [ ] No silent failure paths on time parsing, cascade writes, or transforms.

### Quality Gates
- [ ] `npx tsc --noEmit` passes
- [ ] `npm test` passes
- [ ] `npm run lint` passes (0 warnings)
- [ ] `npm run build` passes

---

## Proof Expectations (Required)
- Visual: screenshots of:
  - single track schedule
  - multi track with a simultaneous overlap band
  - a shared/banner entry spanning tracks
  - collapse-to-single result
- Logs: list of manual QA steps executed (desktop + preview + export modal open).
