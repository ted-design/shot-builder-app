# Slice 3 — Call Sheet Assembly (Producer Workflow)

> Execution contract — v1.1 2026-01-31 (revised post-review)

## Goals

Let a producer build a call sheet by assembling a schedule from existing shots, assigning call times to talent and crew, and configuring day logistics. Workflow correctness is the priority — the producer must trust that the call sheet contains the right data.

This slice covers assembly only. Output rendering, PDF export, and distribution are Slice 4.

---

## What "Making a Call Sheet" Actually Means

When a producer builds a call sheet at 1am before a shoot:

1. They select (or create) a **schedule** — one per shoot day.
2. They add **shots to the schedule** in shooting order, with approximate times.
3. They set **day details** — crew call time, shooting call, meals, wrap estimate, locations, weather.
4. They add **talent call times** — each talent member gets a specific call time, role, and notes.
5. They add **crew call times** — each crew member gets a call time (often as offset from crew call).
6. They **review the assembled sheet** — scanning for missing data, wrong times, or gaps.

**What they expected to see without clicking:** project name, date, crew call time, shooting call time, all shot names in order with talent and location, all talent with their call times, all crew with departments and call times.

**What had to be correct or the day breaks:** crew call time, shooting call time, talent call times, locations, shot order.

**What they double-checked obsessively:** that every talent member has a call time, that the right shots are on the right day, that locations match the shots, that meal times are reasonable.

**What they needed to move fast on at 1am:** adding shots to the schedule, setting a crew call time, entering talent calls. These must be low-friction, not multi-step wizards.

---

## Ordering Source of Truth

- **Schedule entry order is canonical for call sheets.** When shots are on a schedule, their order within the schedule (entry `order` field) determines display order — not the shot's `date` or `sortOrder`.
- **Shot list "Custom Order":** Prefer `sortOrder` when present on shot documents. Fallback to `date` (asc) for legacy shots that lack `sortOrder`. See `docs-vnext/ops/firestore-indexes.md` for the active index (projectId+deleted+date) and the future index (projectId+deleted+sortOrder) that requires a backfill migration before activation.

---

## In-Scope (Required)

### 1. Schedule CRUD

- Create schedule (name + date) scoped to a project
- List schedules for a project
- Select active schedule for editing
- Delete schedule (with confirmation dialog)
- Firestore path: `clients/{cid}/projects/{pid}/schedules/{sid}` (existing collection)

### 2. Schedule Entry Management

- Add shots from the project's shot list to the schedule
- Set entry order (manual sort — up/down controls or number input)
- Set entry time and duration
- Add custom entries (setup, break, move) — plain text title, no shot reference
- Remove entries from schedule
- Firestore path: entries stored on the schedule document or in `schedules/{sid}/entries/{eid}` subcollection (must verify production pattern — see Open Questions)

### 3. Day Details Editor

- Crew call time (required — prominently displayed)
- Shooting call time (required)
- Estimated wrap time
- Meal times: breakfast, first meal, second meal (all optional)
- Location blocks: production office, nearest hospital, custom locations (free-text or location library reference)
- Weather summary (manual text entry — no API integration)
- Notes field (free-text)
- Firestore path: `schedules/{sid}/dayDetails/{did}` (existing subcollection)

### 4. Talent Calls

- Add talent from the project's assigned talent (derived from shots in the schedule)
- Auto-suggest talent who appear in scheduled shots but don't yet have call entries
- Set per-talent: call time, role, status (confirmed / pending / cancelled), notes
- Firestore path: `schedules/{sid}/talentCalls/{tid}` (existing subcollection)

### 5. Crew Calls

- Read crew from org crew library (`clients/{cid}/crew/{crid}` — existing collection, read-only)
- Add crew members to the schedule's crew calls
- Set per-crew: call time, offset from crew call (direction + minutes), department/position, notes
- This requires adding `CrewRecord` type to vNext `shared/types/` and a `useCrew` read-only hook
- No Crew CRUD in this slice — read existing data only
- Firestore path: `schedules/{sid}/crewCalls/{crid}` (existing subcollection)

### 6. Assembly Preview via Canonical CallSheetRenderer (Desktop Only)

- Preview is available via a right-side slide-over panel opened with the **Preview** button (keeps the editor full-width by default).
- **There is ONE canonical `CallSheetRenderer` component.** This single component is the authoritative renderer for the call sheet across both Slice 3 (editor preview) and Slice 4 (PDF export). There are NOT two render paths.
- In the Slice 3 editor, `CallSheetRenderer` is embedded in the right pane, scaled to fit via CSS `transform: scale()` if needed. It renders live Firestore data via subscriptions.
- Slice 4 reuses this exact component in a print portal for PDF export. No separate export renderer.
- Preview updates in real-time as the producer edits
- Desktop only — mobile users navigating to `/projects/:id/callsheet` redirect to project dashboard with toast
- Route: `/projects/:id/callsheet` (matches experience-spec.md route map)

### 7. Firestore Path Additions to vNext

Add to `shared/lib/paths.ts`:
- `schedulesPath(projectId, clientId)`
- `schedulePath(projectId, scheduleId, clientId)`
- `scheduleEntriesPath(projectId, scheduleId, clientId)`
- `scheduleDayDetailsPath(projectId, scheduleId, clientId)`
- `scheduleTalentCallsPath(projectId, scheduleId, clientId)`
- `scheduleCrewCallsPath(projectId, scheduleId, clientId)`
- `scheduleClientCallsPath(projectId, scheduleId, clientId)` (for future use)
- `callSheetConfigPath(projectId, scheduleId, clientId)` (for Slice 4)

Add types to `shared/types/`:
- `Schedule`, `ScheduleEntry`, `DayDetails`, `TalentCallSheet`, `CrewCallSheet`, `CrewRecord`

All collections already exist in production Firestore. No schema changes.

---

## Out-of-Scope (Deferred)

| Capability | Reason |
|---|---|
| Parallel tracks (Photo/Video) | Multi-department scheduling is advanced. Single-track covers 80% of shoots. |
| Cascade timing | Automatic downstream shift is complex and error-prone. Manual time entry sufficient. |
| Client/guest calls | Ad-hoc entries for non-library people. Notes field is workaround. |
| Call sheet layout configuration | Slice 4 handles output styling. Assembly is about data correctness. |
| Section reordering | Fixed section order acceptable for launch. |
| Timeline drag-and-drop UI | Manual time entry sufficient. Drag UI is polish. |
| Multi-day schedule views | One schedule = one day. Multiple schedules for multi-day shoots. |
| Weather API integration | Manual entry only. |
| Crew CRUD | Read-only from existing org crew library. CRUD deferred to Library slice. |

---

## Prerequisites from Slice 1 and Slice 2

| Prerequisite | Source | Status |
|---|---|---|
| Shots exist with products/talent/location | Slice 1 | Done |
| Shot date field | Slice 2 | Required |
| Shot number field | Slice 2 | Required |
| Talent library read access | Slice 1 pickers | Done (read-only) |
| Location library read access | Slice 1 pickers | Done (read-only) |
| Crew library read access | Not yet built | **New for Slice 3** — read-only hook + type |
| Canonical `CallSheetRenderer` component | Slice 3 (built here) | **Required** — single renderer shared with Slice 4 |

**Note on `CallSheetRenderer`:** This component is built in Slice 3 and reused without modification in Slice 4. There is ONE renderer, not two. Slice 3 builds it for the editor preview pane. Slice 4 wraps it in a print portal and adds configuration toggles (section visibility, field visibility, colors). The renderer's interface must accept configuration props from the start so Slice 4 can pass toggle state without forking the component.

---

## Producer Trust Checks (Must Never Be Wrong)

1. **Crew call time.** If the call sheet says 6:00 AM, crew shows up at 6:00 AM. This field must be prominent and validated (non-empty when schedule is used).

2. **Shooting call time.** Same criticality as crew call.

3. **Talent call times.** Every talent member on the schedule must have a call time. The UI must warn if any talent appearing in scheduled shots is missing a call entry.

4. **Shot order matches schedule.** The preview must render shots in the exact order the producer arranged them. No automatic re-sorting.

5. **Locations are correct.** The location on each shot must match what appears in the call sheet preview. If a shot's location was updated after being added to the schedule, the call sheet must reflect the current shot data (live Firestore subscription, not snapshot copy).

6. **No phantom entries.** If a shot is deleted or removed from the project, it must not silently appear on the call sheet. Schedule entries referencing deleted shots must be visually flagged or removed.

---

## Explicit Non-Goals

- PDF export or print (Slice 4)
- Visual layout customization (Slice 4)
- Email/sharing distribution (Slice 4)
- Weather API integration
- Multi-day schedule views
- Timeline drag-and-drop UI
- Mobile call sheet builder (desktop only — mobile gets read-only preview)

---

## Definition of Done

### UX
- [ ] Producer can create a schedule tied to a project
- [ ] Producer can add shots from the project to the schedule with times
- [ ] Producer can set crew call time, shooting call time, meal times, estimated wrap
- [ ] Producer can add talent with individual call times
- [ ] Producer can add crew with individual call times
- [ ] Producer can set location details for the day
- [ ] Preview panel renders all assembled data correctly
- [ ] Warning shown if any scheduled talent is missing a call entry
- [ ] Warning shown if schedule entries reference deleted shots
- [ ] Call sheet data reflects live shot data (not stale copies)
- [ ] Desktop only — mobile redirects to project dashboard with toast

### Correctness
- [ ] Schedule CRUD persists to correct Firestore paths
- [ ] Day details persist to `dayDetails` subcollection
- [ ] Talent calls persist to `talentCalls` subcollection
- [ ] Crew calls persist to `crewCalls` subcollection
- [ ] Crew read-only access works against existing org crew collection
- [ ] Entry order is deterministic and matches producer arrangement
- [ ] Shot data in preview is live (reflects current Firestore state)

### Quality
- [ ] `npm run lint` passes with zero warnings
- [ ] `npm run build` produces valid production build
- [ ] Unit tests cover schedule entry ordering and talent-missing-call detection
- [ ] Component tests cover day details editor and talent call entry
- [ ] All new types are strict TypeScript (no `any`)

---

## Known Risks

1. **Crew library dependency.** Slice 3 needs read access to `clients/{cid}/crew/{crid}`. This collection exists but has no vNext types or hooks. Must add `CrewRecord` type and `useCrew` hook (read-only). This is NOT Crew CRUD.

2. **Schedule entry storage pattern.** Legacy has both inline array (`schedule.entries[]`) and subcollection (`/schedules/{sid}/entries/{eid}`) paths. Must verify which pattern production Firestore uses before building read/write hooks.

3. **Data freshness in preview.** Call sheet preview must show live shot data. If a producer changes a shot title after adding it to a schedule, the preview must reflect the change. This means the preview subscribes to shot documents referenced by schedule entries. Must scope subscriptions carefully to avoid fan-out.

4. **Missing talent warning logic — fan-out mitigation.** Detecting talent in scheduled shots who lack call entries requires cross-referencing: schedule entries -> shot documents -> talent IDs -> talent call entries. Reading every shot document at render time causes O(n) Firestore reads per preview render, which is unacceptable for schedules with 20+ shots.

   **Required mitigation:** Maintain a denormalized `participatingTalentIds: string[]` field on the schedule document (or a derived local aggregate). This field is updated when shots are added/removed from the schedule. The missing-talent warning then compares `participatingTalentIds` against the `talentCalls` subcollection — a two-query operation instead of N+1.

   Implementation options (choose during development):
   - **(a) Client-side aggregate on entry change.** When shots are added/removed from the schedule, the write handler also computes the union of all referenced shots' talent IDs and writes `participatingTalentIds` to the schedule doc. Reads are 2 queries (schedule doc + talentCalls).
   - **(b) Derived on initial load only.** On schedule load, read all referenced shot docs once, compute the union, and hold in React state for the duration of the editing session. Subsequent shot-add/remove operations update the local set. No new Firestore field.
   - Option (b) is acceptable if schedule editing sessions are short-lived (typical). Option (a) is preferred if the warning must be accurate across browser tabs or for other users viewing the same schedule.

5. **Canonical `CallSheetRenderer` boundary.** The renderer is built in Slice 3 and reused in Slice 4. Its props interface must accept optional configuration (section visibility, field visibility, colors) from the start so Slice 4 can pass toggle state. Default values must produce a complete, unstyled call sheet without any configuration — Slice 3 preview uses defaults only.

---

## Appendix A: Legacy Call Sheet Assembly Capability Inventory

Source: `src/components/callsheet/CallSheetBuilder.jsx`, `src/pages/CallSheetPage.jsx`, `src/types/callsheet.ts`

### Firestore Structure (Existing — All Collections Present in Production)

```
/clients/{cid}/projects/{pid}/schedules/{sid}
  ├── /entries/{eid}             # Shot refs + custom entries (setup, break, move, banner)
  ├── /dayDetails/{did}          # Call times, meals, locations, weather, notes
  ├── /talentCalls/{tid}         # Per-talent: call time, role, status, transportation, notes
  ├── /crewCalls/{crid}          # Per-crew: call time, offset, wrap, notes
  ├── /clientCalls/{clid}        # Ad-hoc client/guest entries (deferred)
  └── /callSheet/
      ├── config                 # V1 layout config (Slice 4)
      └── layout                 # V2 layout config (Slice 4, deferred)
```

### Legacy Assembly Features

| Feature | Legacy Component | In Slice 3? |
|---|---|---|
| Schedule create/select | ScheduleCreateModal | Yes |
| Add shot entries to schedule | CallSheetBuilder | Yes |
| Add custom entries (setup, break, move, banner) | CallSheetBuilder | Yes (simplified) |
| Set entry time and duration | Inline editors | Yes |
| Entry ordering | Manual + drag | Yes (manual only) |
| Parallel tracks (Photo/Video/Shared) | Track management UI | No — deferred |
| Cascade timing (auto-shift downstream) | Cascade toggle | No — deferred |
| Day details: call times, meals, wrap | DayDetailsEditorV2 | Yes |
| Day details: locations (production office, hospital, custom) | DayDetailsEditorV2 | Yes |
| Day details: weather (manual) | DayDetailsEditorV2 | Yes |
| Day details: key people, set medic, script/schedule version | DayDetailsEditorV2 | Yes |
| Talent calls: call time, role, status, transportation, MU/Ward, notes | TalentCallsCard | Yes (subset — no MU/Ward, transportation) |
| Talent auto-suggest from scheduled shots | TalentCallsCard | Yes |
| Crew calls: call time, offset, department, notes | CrewCallsCard | Yes |
| Client/guest calls (ad-hoc) | ClientsCallsCard | No — deferred |
| Editor + live preview | CallSheetBuilder layout (Preview slide-over) | Yes |
| Section reordering | Config UI | No — deferred |
| Section visibility toggles | Config UI | No — Slice 4 |

### Legacy Data Types (Reference)

**DayDetails** fields: `crewCallTime`, `shootingCallTime`, `breakfastTime`, `firstMealTime`, `secondMealTime`, `estimatedWrap`, `locations[]` (LocationBlock), legacy location fields (productionOffice, nearestHospital, parking, basecamp, customLocations), `weather` (WeatherData), `keyPeople`, `setMedic`, `scriptVersion`, `scheduleVersion`, `notes`, `notesStyle`

**TalentCallSheet** fields: `talentId`, `callTime`, `callText`, `setTime`, `wrapTime`, `role`, `blockRhs`, `muWard`, `status`, `transportation`, `notes`, `colorCode`

**CrewCallSheet** fields: `crewMemberId`, `callTime`, `callText`, `callOffsetDirection`, `callOffsetMinutes`, `wrapTime`, `wrapText`, `notes`

**Schedule** fields: `id`, `projectId`, `name`, `date`, `tracks[]`, `entries[]`, `settings` (cascadeChanges, defaultEntryDuration, dayStartTime), `columnConfig[]`

---

## Revision Notes (Post-Review)

**v1.1 — 2026-01-31:** Applied mandatory changes from external architectural review.

1. **Canonical `CallSheetRenderer` (Architectural).** Replaced the co-developed preview/export model with a single canonical `CallSheetRenderer` component. Built in Slice 3, reused identically in Slice 4. There are NOT two render paths. Props interface accepts optional configuration from the start to support Slice 4 toggles.

2. **Talent Detection Performance (Required).** Added denormalized `participatingTalentIds` strategy to avoid O(n) Firestore reads when computing missing-talent warnings. Two implementation options documented: client-side aggregate on entry change (preferred) or derived on initial load (acceptable).
