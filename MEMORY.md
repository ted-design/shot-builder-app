# MEMORY — Shot Builder vNext

Persistent cross-session memory. Updated by Claude Code after each implementation session.

## Current Phase Status

- **Sprint S12 (Request Notifications + Overhaul + Bulk Shots)** — COMPLETE (PR #370 merged, Firebase deployed). 107 new tests (2488 total). 15/15 review fixes applied.
- **Sprint S11 (Stabilize + Polish)** — COMPLETE (PR #365 merged).
- **Sprint S10 (User Management Overhaul)** — COMPLETE (PR #363 merged).
- **Sprint S9b (Firestore Queue)** — COMPLETE (deployed, verified).
- **Post-S12 priorities:** Remove banned deps from package.json, vendor chunk splitting, audit for workflow improvements

## Completed Phases

| Phase | Summary |
|-------|---------|
| Phase 1 | Documentation + cleanup |
| Phase 2 | Navigation & IA (11 sidebar components, 3 breakpoints) |
| Phase 3 | Shot editing workflow (three-panel, multi-view, auto-save, keyboard shortcuts, PDF export) |
| Phase 3.5 | Schedule & call sheet assembly (partial — 3.5a-e done, 3.5f-g deferred to S7) |
| Phase 4 | Form & data entry optimization |
| Phase 5 | Mobile & tablet polish (ResponsiveDialog, FAB, warehouse pick flow) |
| Phase 6 | Visual identity (Direction A: Near-Black Editorial, dark mode, skeletons) |
| Phase 7A | Bug fixes & quick wins |
| Phase 7B | Library entity completion (crew, locations, talent CRUD) |
| Phase 7C | UI/UX polish pass |
| Phase 7D | Products editor improvements |
| Phase 7E | Feature cleanup & consolidation |
| Sprint S1 | Edit paths & CRUD completeness |
| Sprint S2 | Admin panel & user onboarding |
| Sprint S4 | Design system realignment (typography mismatch fix) |
| Sprint S5a | Dashboard dates + tag accents + wardrobe fix |
| Sprint S5b | Admin RBAC — project access management |
| Phase 8 | Shot request inbox |
| Phase 8.5 | Shot request — create project flow |
| Phase 9 | Casting engine (search, auto-match, shot history) |
| Phase 10 | Asset requirements & PLM (launch dates, asset flags, shoot readiness) |
| Sprint S6 | Talent page improvements (Sheet layout, casting brief panel, range sliders) |
| Sprint S7 | Schedule & call sheet polish (overlap groups, call sheet output, mobile on-set viewer) |
| Sprint S8 | Team audit & fix sprint (critical bugs, security, UX, code quality, docs) |
| Sprint S9 | Production Hub rebrand, login redesign, board removal, seamless onboarding |
| Sprint S9b | Firestore Queue migration (all callable functions) |
| Sprint S10 | User management overhaul (visibility, roster, deactivation, bulk assign, emails) |
| Sprint S11 | Stabilize + polish (security, login redesign, Request Centre rename, dashboard tabs) |
| Sprint S12 | Request notifications, request overhaul (comments, products, references), bulk shot generation |

## Deferred Items

- **2i:** Consolidate library routes + remove legacy redirects (routes work as-is)
- **3v:** Board column reorder + show/hide configuration
- **Cmd+K:** Command palette implementation (deferred from Phase 2)
- **3.5f-g:** E2E testing of schedule-to-call-sheet flow (→ S7-9)
- **File decomposition:** 5 files over 800 lines (shotsPdfTemplates 1416, ProductEditorPage 1226, ShotsPdfExportDialog 1082, ProductAssignmentPicker 1077, ScheduleEntriesBoard 1012)
- **Subscription reduction:** ShotDetailPage (6 subs), CallSheetBuilderPage (10+ subs) exceed <5 budget

## Key Patterns & Conventions

- **Status labels:** Draft / In Progress / On Hold / Shot (from `statusMappings.ts`)
- **Request status labels:** Submitted / Triaged / Absorbed / Rejected (from `requestStatusMappings.ts`)
- **Design tokens:** All colors via `tokens.css` CSS vars, never hardcoded hex
- **Block colors:** CSS var references via `blockColors.ts`, not Tailwind color classes
- **Typography:** Semantic classes from `design-tokens.js` (`heading-page`, `heading-section`, `heading-subsection`)
- **Font sizes:** Use `text-sm` (13px), `text-base` (14px), etc. — never `text-[13px]`
- **Page headings:** `heading-page` class (weight 300 editorial) — never `text-xl font-semibold`
- **Section headings:** `heading-section` class — never `text-base font-semibold`
- **Subsection headings:** `heading-subsection` class — never `text-lg font-semibold`
- **Tag badges:** Neutral body with subtle category-accent left borders
- **NOW indicator:** Single source at `src-vnext/shared/hooks/useNowMinute.ts`
- **Entry-type colors:** `--color-entry-{type}-border/bg` tokens in `tokens.css`
- **Shared text utilities:** `shared/lib/textUtils.ts` — normalizeText, normalizeWhitespace, humanizeLabel, parseCsvList
- **Measurement bounds:** Feet must be 2-9 (human height range) in measurementParsing.ts
- **Pulls sharing:** Firestore rule requires shareToken string with length >= 32

## User Preferences

- Direction A: Near-Black Editorial visual identity (approved Phase 6)
- Zinc neutral scale (not Slate)
- Sheet layout for talent detail (Option A, approved Sprint S6)
- Editorial section labels for call sheet (not full-bleed dark bands)
- Prefers agent teams for large tasks (research + implementation phases)
- Prefers comprehensive documentation updates before session end

## Error Patterns & Learnings (Sprint S8 Audit)

### Bugs Found & Fixed
- **Midnight crossing in time algorithms:** When comparing time ranges that span midnight (e.g., 23:00-01:00), endMin < startMin. Must clamp to 1439 (end of day) before overlap comparison. Always add midnight-crossing test cases for any time-range algorithm.
- **iOS nested sticky scroll trap:** Two sticky elements at different `top` offsets inside `overflow-y-auto` with `-webkit-overflow-scrolling: touch` creates unrecoverable scroll. Fix: single non-scrolling header + one scroll context. Never nest multiple sticky elements on iOS.
- **Firestore wildcard rule enumeration:** Collection group rules like `match /{path=**}/pulls/{pullId}` with `allow get,list: if resource.data.shareEnabled == true` allow enumeration of ALL matching docs. Always require a secret token check in the rule, not just a boolean flag.
- **Measurement parsing without bounds:** Free-form string parsing must validate ranges, not just formats. "99'6" is valid format but absurd data. Always add bounds checks after format parsing.
- **Selection state stale after filter:** When a filter removes the currently selected item from a list, the selection must auto-clear. Add a useEffect that watches [selectedId, filteredList] and nulls selection when the item disappears.

### Code Quality Patterns
- **Duplicate utility functions:** Before creating a local normalizeText/humanizeLabel/etc., check `shared/lib/textUtils.ts` first. Three separate implementations were found and consolidated.
- **Logic bugs in always-same branches:** `condition ? "compact" : "compact"` — when both branches return the same value, it's either a bug or dead code. Review the original intent.
- **Semantic classes defined but unused:** The design system defines semantic typography classes that components never reference. After defining tokens/classes, grep to verify adoption.
- **Print portals are exceptions:** `bg-white` in print-only portals (React-PDF, casting print) is intentional. Document with a comment: `{/* bg-white intentional: print output */}`
- **Image overlays are exceptions:** `bg-black/50` overlays on images work in both light/dark mode. No `dark:` variant needed.

### Firebase / Cloud Functions Patterns
- **`revokeRefreshTokens` invalidates the caller's session:** Never call `revokeRefreshTokens(uid)` on the same user who is making the request. The client's subsequent `getIdToken(true)` will fail because the refresh token is revoked. Use it only when an admin changes ANOTHER user's claims.
- **`onSnapshot` needs an error callback:** Without the error handler, Firestore permission denials cause silent listener failure → the promise hangs until timeout. Always pass both success and error callbacks to `onSnapshot`.
- **Firestore Queue pattern bypasses GCP org IAM:** When `allUsers` invoker is blocked by org policy, use Firestore document triggers instead of HTTP functions. Client writes to queue collection, `onCreate` trigger processes, client reads via `onSnapshot`. Same-origin — no CORS, no IAM needed.
- **SA permissions for Firestore triggers:** The App Engine default SA needs `roles/editor` + `roles/serviceusage.serviceUsageConsumer` for `admin.auth().getUser()` and `snap.ref.update()` in Firestore triggers.
- **Cloud Function cold start after IAM changes:** After granting new IAM roles, redeploy the function to force a cold start that picks up the new permissions.

### Multi-Agent Team Patterns
- **Non-overlapping file ownership prevents merge conflicts:** Assign each agent explicit file lists. No two agents touch the same file.
- **Research phase before implementation phase:** Run read-only audit agents first, synthesize findings, then spawn implementation agents with precise instructions.
- **6 agents is a good parallelism ceiling:** More agents = more coordination overhead. 6 focused agents with clear scope completes faster than 10 overlapping agents.
