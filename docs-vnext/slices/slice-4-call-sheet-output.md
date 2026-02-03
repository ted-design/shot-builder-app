# Slice 4 — Call Sheet Output & Distribution (Trust Layer)

> Execution contract — v1.1 2026-01-31 (revised post-review)

## Goals

Turn the assembled call sheet (Slice 3) into something the producer can share with the crew. The output must be correct, consistent, and inspire confidence. Producers hand this document to 20+ people who make decisions based on it.

This slice covers rendering, export, configuration, and distribution. Assembly is Slice 3.

---

## What Producers Relied On (Legacy Behavior)

- **Browser print-to-PDF.** No server-side rendering. `window.print()` on a React portal. WYSIWYG: the preview IS the PDF.
- **Configurable sections.** Producers could show/hide sections (header, day details, schedule, talent, crew, notes).
- **Consistent layout.** Same `CallSheetPreview.tsx` renderer for on-screen preview and PDF export. What you see is what you get.
- **Shareable preview URL.** `?scheduleId=X&preview=1` renders read-only full-screen preview.
- **Color branding.** Primary/accent colors configurable.
- **Field visibility in schedule blocks.** Toggle shot number, name, description, talent, location, tags, notes per schedule entry.

---

## In-Scope (Required)

### 1. Canonical `CallSheetRenderer` (Shared with Slice 3)

- **There is ONE canonical `CallSheetRenderer` component**, built in Slice 3 and reused here without forking. There are NOT two render paths.
- Slice 4 passes configuration props (section visibility, field visibility, colors) to the same component that Slice 3 uses with defaults.
- Sections rendered in fixed order: header, day details, schedule, talent, crew, notes
- Must handle missing data gracefully (empty sections hidden, not broken)
- Must render live Firestore data (no stale snapshots)
- The print portal wraps this exact component — no separate export renderer

### 2. PDF Export via Browser Print

- "Export PDF" button opens print-optimized view
- React portal pattern: create clean DOM root appended to `<body>`, render `CallSheetRenderer` into it, call `window.print()`, clean up after print
- Print CSS:
  - Page margins appropriate for standard paper
  - `break-inside: avoid` on table rows and entry blocks
  - `break-before: page` between major sections when content overflows
  - Guidance text for "Background graphics" checkbox (required for colors)
- **Data-Ready Gate (Required).** `window.print()` MUST NOT fire until all data sections have resolved. No double-`requestAnimationFrame` heuristics.
  - Implement a `PrintReadinessContext` (or equivalent registry) used by the print portal.
  - Each data-dependent section within `CallSheetRenderer` registers itself with the readiness context on mount and reports ready when its Firestore subscription has emitted at least one snapshot.
  - The print portal blocks `window.print()` until ALL registered sections report ready.
  - A hard timeout (e.g., 10 seconds) triggers an error toast and aborts the print attempt rather than printing incomplete data.
- This is the proven legacy pattern (portal + `window.print()`) — no server-side PDF, no third-party PDF library. The data-ready gate replaces the legacy timing heuristic.

### 3. Section Visibility Toggles

- Producer can show/hide: header, day details, schedule, talent, crew, notes
- Persisted to `callSheet/config` document in Firestore (existing collection path)
- Simple toggle list — no drag reorder for launch

### 4. Schedule Block Field Toggles

- Toggle visibility of within schedule entries: shot number, shot name, description, talent, location, notes
- Uses existing `ScheduleBlockFields` type from legacy `src/types/callsheet.ts`
- Persisted alongside section toggles in call sheet config

### 5. Basic Color Configuration

- Primary color (header background, section headers)
- Accent color (secondary highlights)
- Uses existing `CallSheetColors` type shape (subset: `primary`, `accent`, `text`)
- Minimal: enough to match a production company's brand
- Persisted in call sheet config

### 6. Share via URL (Read-Only Preview)

- Desktop share link renders the call sheet in preview mode (no editor chrome)
- Same renderer, full-width, no sidebar
- Auth-gated to project members (project membership required)
- Mobile users accessing call sheet URL see read-only rendered preview (not the builder)
- Route: `/projects/:id/callsheet?scheduleId=X&preview=1`

---

## Supported Distribution Paths

1. **Save as PDF** — Producer prints to PDF via browser, saves file, distributes via email / Slack / WhatsApp manually
2. **Share preview link** — Producer copies URL, shares with team members who have project access
3. **Physical print** — Producer prints directly from browser print dialog

No in-app email. No automated distribution. No notification-triggered sends. Producers already have distribution channels. The app produces the artifact; the producer distributes it.

---

## Trust Guarantees

1. **WYSIWYG.** The PDF output is identical to the on-screen preview. Same React component renders both. No server-side re-rendering that might differ.

2. **Live data.** The preview always reflects current Firestore data. If a crew call time changes at 11pm, the next export captures it. No stale snapshots.

3. **Complete or explicit.** Every section either shows correct data or is visibly absent. No partial renders, no "loading..." in the PDF, no blank cells where data should be.

4. **No data loss in export.** If data exists in the assembly (Slice 3), it appears in the output. The renderer does not silently drop entries, talent, or crew.

5. **Readable on print.** Font sizes, contrast ratios, and spacing are legible on paper. Print CSS handles page breaks sensibly (no split rows, no orphaned headers).

---

## Out-of-Scope (Deferred)

| Enhancement | Reason |
|---|---|
| V2 modular header builder | Complex layout editor. Fixed header (project name, date, call times) sufficient. |
| Section drag reorder | Fixed order covers standard call sheets. |
| Multiple header layouts (classic, center-logo, multiple-logos) | Single layout. |
| Custom page sizes (A4/Letter selection) | Browser print dialog handles this. |
| Spacing modes (compact/normal/relaxed) | Single default spacing. |
| Time format toggle (12h/24h) | Default to 12h. |
| Temperature format toggle | Default to fahrenheit. |
| Footer logo | Defer. |
| Quote/estimate section | Defer. |
| Extras section | Defer. |
| Row alternate coloring | Defer — solid background sufficient. |
| Rich text in header elements | Defer — plain text header. |
| Server-side PDF generation | Not needed. Browser print is proven. |
| Automated email distribution | Not needed. Producer distributes manually. |
| Push notifications on publish | Not needed. |
| Versioned call sheet history | Rely on PDF files as snapshots. |
| Template system (save/load layouts) | Defer. |
| Public share link (unauthenticated) | Call sheets are auth-gated. Unlike pull sheets, no public shareToken. |

---

## Explicit Non-Goals

- Server-side PDF generation (puppeteer, pdfkit, etc.)
- Automated email distribution from within the app
- Push notifications when call sheet is published
- Versioned call sheet history
- Mobile call sheet builder (desktop only — mobile gets read-only preview)
- Template system

---

## Prerequisites from Slice 3

| Prerequisite | Source | Status |
|---|---|---|
| Schedule CRUD | Slice 3 | Required |
| Schedule entries with shots | Slice 3 | Required |
| Day details | Slice 3 | Required |
| Talent calls | Slice 3 | Required |
| Crew calls | Slice 3 | Required |
| Canonical `CallSheetRenderer` component | Slice 3 | Built in Slice 3, reused here with config props |
| Call sheet config Firestore path | Slice 3 paths.ts additions | Required |

---

## Definition of Done

### UX
- [ ] PDF export produces output identical to on-screen preview
- [ ] All sections render: header, day details, schedule, talent, crew, notes
- [ ] Section visibility toggles work (hidden sections omitted from PDF)
- [ ] Schedule block field toggles work (hidden fields omitted from schedule entries)
- [ ] PDF page breaks do not split rows
- [ ] Share link renders read-only preview for project members
- [ ] No blank or loading cells in the exported PDF
- [ ] Print dialog opens reliably (Chrome, Safari tested)
- [ ] Long call sheets (20+ entries) render completely without truncation

### Correctness
- [ ] Section toggles persist to Firestore call sheet config
- [ ] Field toggles persist to Firestore call sheet config
- [ ] Color configuration persists to Firestore call sheet config
- [ ] Preview URL with `?preview=1` renders without editor chrome
- [ ] Auth check enforced on preview URL (project membership required)
- [ ] Print portal uses `PrintReadinessContext` — all sections report ready before `window.print()`
- [ ] No double-rAF or timing heuristics used for print triggering
- [ ] Hard timeout (10s) aborts print with error toast if data fails to resolve

### Quality
- [ ] `npm run lint` passes with zero warnings
- [ ] `npm run build` produces valid production build
- [ ] Unit tests cover renderer section visibility and field toggle logic
- [ ] Component tests cover export modal flow (portal creation, print trigger, cleanup)
- [ ] Print CSS tested on Chrome and Safari
- [ ] No `dangerouslySetInnerHTML` without sanitization in renderer

---

## Known Risks

1. **Print CSS quality.** Browser print rendering varies. Must test on Chrome and Safari. Firefox print is less reliable but acceptable.

2. **Page break logic.** Long call sheets (20+ shots, 10+ talent, 15+ crew) must break pages sensibly. CSS `break-inside: avoid` on rows, `break-before: page` on sections. Browser support for CSS fragmentation is inconsistent — may need workarounds.

3. **Data-ready gate implementation.** The `PrintReadinessContext` pattern requires each renderer section to register and report readiness. Risk: if a section fails to register or never resolves, the print gate hangs. The hard timeout (10s) mitigates this, but the error UX must be clear ("Export failed — some data could not be loaded. Please try again.").

4. **Preview performance.** Live Firestore subscriptions for shots, talent calls, crew calls, day details all feed the preview. Must scope subscriptions to the active schedule only to avoid fan-out.

5. **Call sheet config schema.** Legacy has both V1 (`CallSheetConfig`) and V2 (`CallSheetLayoutV2`) schemas. Slice 4 should use the V1 shape (simpler) and store in the existing `callSheet/config` path. V2 modular builder is deferred.

---

## Appendix A: Legacy Call Sheet Output Capability Inventory

Source: `src/components/callsheet/export/CallSheetExportModal.jsx`, `src/components/schedule/preview/CallSheetPreview.tsx`, `src/types/callsheet.ts`

### Legacy Export Architecture

| Component | Role |
|---|---|
| `CallSheetExportModal.jsx` | Orchestrates print portal: creates DOM root, renders preview, triggers `window.print()`, cleans up |
| `CallSheetPreview.tsx` | Authoritative renderer for both on-screen preview and PDF export |
| `CallSheetHeader.tsx` | Header section with project title, date, call times |
| `buildModernCallSheetData()` | Assembles all data into a single structure for the renderer |
| `buildScheduleProjection.js` | Canonical entry ordering (sequence or time mode) |

### Legacy Print Portal Pattern

1. Create clean `<div>` appended to `<body>` (outside React app root)
2. `createRoot()` to render `CallSheetPreview` into portal
3. Double `requestAnimationFrame` to wait for React render
4. `window.print()` triggers browser print dialog
5. Cleanup on `afterprint` event or 30-second fallback timer

### Legacy Configuration Options (All Persisted in CallSheetConfig)

| Option | Type | In Slice 4? |
|---|---|---|
| Section visibility (show/hide per section) | `sections[].isVisible` | Yes |
| Section order | `sections[].order` | No — fixed order |
| Header layout (classic/center-logo/multiple-logos) | `headerLayout` | No — single layout |
| Header elements (text/image items) | `headerElements[]` | No — fixed header |
| Page size (auto/letter/a4) | `pageSize` | No — browser handles |
| Spacing (compact/normal/relaxed) | `spacing` | No — single default |
| Time format (12h/24h) | `timeFormat` | No — default 12h |
| Temperature format | `temperatureFormat` | No — default fahrenheit |
| Footer logo | `showFooterLogo` | No — deferred |
| Colors (primary, accent, text, background, primaryText, rowAlternate) | `colors` | Yes (subset: primary, accent, text) |
| Schedule block field visibility | `scheduleBlockFields` | Yes |
| V2 modular header config | `CallSheetLayoutV2.header` | No — deferred |
| V2 section field configs | `CallSheetSectionV2.fields[]` | No — deferred |

### Legacy Call Sheet Sections (Rendered Order)

| Section Type | Content | In Slice 4? |
|---|---|---|
| `header` | Project name, date, company name, logos, call times | Yes (simplified) |
| `day-details` | Crew call, shooting call, meals, locations, weather, key personnel | Yes |
| `reminders` | Freeform notes/warnings | Yes (as notes section) |
| `schedule` | Shot entries in order with configurable field visibility | Yes |
| `talent` | Talent roster with call times, roles, status | Yes |
| `crew` | Crew roster with departments, call times, contact info | Yes |
| `notes-contacts` | Key people, set medic, script/schedule version, notes | Yes (merged with day details) |
| `clients` | Client/guest roster | No — deferred |
| `extras` | Background performers | No — deferred |
| `advanced-schedule` | Parallel lane rendering | No — deferred |
| `page-break` | Forced page break | No — deferred |
| `custom-banner` | User-defined section | No — deferred |
| `quote` | Estimate section | No — deferred |

### Legacy Distribution

| Method | Mechanism | In Slice 4? |
|---|---|---|
| Save as PDF | `window.print()` -> browser save dialog | Yes |
| Physical print | `window.print()` -> printer | Yes |
| Preview URL | `?scheduleId=X&preview=1` | Yes |
| Manual sharing | Producer distributes PDF via email/Slack/etc. | Yes (external) |
| In-app email | Not implemented in legacy | No |
| Public link (unauthenticated) | Not implemented in legacy | No |

---

## Revision Notes (Post-Review)

**v1.1 — 2026-01-31:** Applied mandatory changes from external architectural review.

1. **Canonical `CallSheetRenderer` (Architectural).** Replaced separate preview/export renderer model with explicit single-component contract. `CallSheetRenderer` is built in Slice 3 and reused here identically via print portal. No separate export renderer exists. Configuration props (section visibility, field visibility, colors) are the only difference between the Slice 3 preview and the Slice 4 export.

2. **Data-Ready Gate (Required).** Replaced legacy double-`requestAnimationFrame` heuristic with explicit `PrintReadinessContext` registry. Each renderer section registers and reports readiness. `window.print()` is blocked until all sections report ready. Hard timeout (10s) aborts with error toast. No timing-based print triggers.
