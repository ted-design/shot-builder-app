# Call Sheet Schedule IA Proposal (2026-02-11 D)

Date: 2026-02-11  
Owner: Codex  
Scope: Entry editability, card readability, shared semantics, in-context shot editing

## 1) Current Pain Points (Validated)

### 1.1 Editability is implicit, not obvious
- Existing entries are technically inline-editable, but there is no clear "open editor" affordance on cards.
- Result: users cannot reliably discover how to edit an existing shot/highlight after creation.

### 1.2 Card IA is overloaded
- Cards currently expose too many controls at once (time, title, duration, notes, track selector, drag, delete).
- In narrow columns, controls compete for space and track select can visually crowd/overflow card boundaries.

### 1.3 Shared as full third column increases scan cost
- With two tracks, a third `Shared` column forces lateral scanning and reduces usable width for primary work.
- Shared semantics are correct in data model, but presentation increases cognitive overhead.

### 1.4 In-context shot edits are missing
- Schedule cards do not provide a persistent edit surface for the underlying shot document.
- Users are forced to navigate to Shots editor for common changes (shot #, description, talent, location, tags/colors).

## 2) External Pattern Findings (What to Keep)

### 2.1 Progressive disclosure for advanced controls
- NN/g: defer advanced/rarely used features to secondary UI to reduce errors and improve learnability.
- Recommendation: move secondary controls (track move, delete, style edits) into entry menu/drawer.

### 2.2 Limit visible fields per card and use explicit hierarchy
- Atlassian board pattern: "just the right level of information at a glance", with a limited set of visible fields and details on open.
- Material cards: avoid overloading cards; emphasize primary content; use overflow menu for secondary actions.
- Recommendation: keep cards to 3 rows max and push non-primary controls behind context menu.

### 2.3 Shared events should behave like background/global overlays
- Timeline/calendar patterns support non-editable background events distinct from normal events.
- Recommendation: render shared highlights in a dedicated horizontal "Global Highlights" rail (not a full column).

## 3) Proposed IA (Updated Recommendation from Legacy Reference)

## Option AB Hybrid (Recommended): Time-Banded Stream + Track Columns + Shared In-Stream

This matches the core behavior in your legacy output while keeping modern edit ergonomics.

### Layout
- Keep track columns (Primary, Track 2, ...), but organize the editor by **time bands** in a vertical stream.
- Each time band is one row in the stream:
  - left: time range label,
  - right: track sub-columns for entries in that interval.
- Shared blockers/highlights render as **full-width in-stream rows at their actual time** (not a separate side column).
- Optional "Pinned Shared Notes" rail stays above the stream for non-timed reminders only.

### Card Structure (3 rows)
- Row 1: `time` (dominant), `title`, status/type chip.
- Row 2: compact metadata (shot #, talent count, location short label).
- Row 3: duration + short note preview.
- Track assignment hidden from always-visible card UI.

### Actions model
- Primary click: open `Entry Drawer`.
- Drag handle: drag only.
- Kebab menu (or drawer actions): move track, convert shared/local, duplicate, delete.

### Entry Drawer
- For shot entries:
  - Schedule-level fields: time, duration, notes, track/shared toggle.
  - Shot-level fields (persist globally): title, shot #, description, talent, location, tags (with color).
- For highlight entries:
  - title, description, emoji, style, color, shared/local toggle, time/duration.

### Why this is best
- Preserves temporal focus: shared blockers are always visible at the exact point they affect the plan.
- Removes lateral scan tax from third-column shared layout.
- Preserves current data model (`trackId: shared`, applicability ids) with moderate UI refactor only.
- Supports global shot edits in-place while preserving single source of truth.

## 4) Alternative Layouts

## Option A: Tracks + Global Highlights Rail
- Shared shown above tracks, not at the exact timeline row.

## Option B: Time-Band Matrix
- Rows are time bands; columns are tracks.
- Shared events appear as full-row banners.
- Strong temporal clarity, but bigger implementation jump and more complex drag logic.

## Option C: Single Chronological Stream + Track Badges
- One vertical time stream; entries carry track badges.
- Shared naturally fits inline.
- Best for small teams, weaker for simultaneous multi-track planning.

## 5) Immediate Delivery Plan (Execution Sequence)

1. **P0: Editability trust fix**
   - Add explicit `Edit` affordance on every entry (card click or dedicated icon) opening Entry Drawer.
   - Keep existing inline edit as fallback until drawer is stable.

2. **P1: Card IA compression**
   - Move track selector off-card into drawer/menu.
   - Enforce 3-row layout and metadata truncation rules.

3. **P2: Shared in-stream migration**
   - Replace third `Shared` column with:
     - timed shared rows in the time stream,
     - optional pinned shared rail for untimed reminders.
   - Keep shared semantics in model (`trackId: shared` + applicability).

4. **P3: Shot quick-edit in schedule**
   - In Entry Drawer, add shot-level edit panel writing to shot doc.
   - Use existing shot subscriptions so updates propagate app-wide.

5. **P4: Color semantics for shots**
   - Reuse existing tag colors in quick-edit panel and card accents.
   - Avoid introducing a separate "schedule-only shot color" that drifts from shot source of truth.

## 6) Risks + Mitigations

- Risk: mixing schedule-level and shot-level edits can confuse scope.
  - Mitigation: explicit section labels in drawer: `Schedule Details` vs `Shot Details (Global)`.
- Risk: shared rail could hide context.
  - Mitigation: place contextual "applies to tracks" chips and in-track markers.
- Risk: migration churn for heavy users.
  - Mitigation: ship behind a call sheet layout flag for side-by-side QA.

## 7) Legacy Reference Read

- Source inspected: `/Users/tedghanime/Downloads/Shot Builder.pdf`
- Extracted patterns that are worth carrying forward:
  - "Today’s Schedule" uses a clear chronological stream.
  - Shared blockers (e.g., "TALENT PREP") appear as full-width rows in the same schedule flow.
  - Track-specific entries still preserve per-track identity.

## 8) Research References

- NN/g — Progressive Disclosure: https://www.nngroup.com/articles/progressive-disclosure/
- NN/g — 10 Usability Heuristics: https://www.nngroup.com/articles/ten-usability-heuristics/
- Atlassian — Customize cards: https://support.atlassian.com/jira-software-cloud/docs/customize-cards/
- Atlassian — Add fields to cards: https://support.atlassian.com/jira-service-management-cloud/docs/add-fields-to-cards-on-your-board/
- Material Design — Cards: https://m1.material.io/components/cards.html
- FullCalendar — Background events: https://fullcalendar.io/docs/background-events
- FullCalendar — Timeline view: https://fullcalendar.io/docs/timeline-view
