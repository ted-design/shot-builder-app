# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This file governs all Claude Code work in the vNext worktree. Follow these rules exactly.

## Canonical Source of Truth

**Root-level `PRD.md` and `Plan.md` are the authoritative specifications.** Product vision, user journeys, feature priorities, and the phased implementation plan are defined there.

| File | What's in it |
|------|-------------|
| `PRD.md` | Product vision, user journeys, feature priorities, UX principles |
| `Plan.md` | Multi-phase plan with sub-task checkboxes (this IS the todo tracker) |
| `Architecture.md` | Tech stack, module structure, routes, data model, auth/RBAC, design system, component inventory, performance budgets, security checklist |
| `AI_RULES.md` | Decision framework, code standards, testing, implementation patterns (three-panel, visual, dark mode, permissions), context management |
| `docs/DESIGN_SYSTEM.md` | **UI component patterns, color tokens, typography, shared components, view toggles, tables, spacing. READ BEFORE ANY UI WORK.** |
| `MEMORY.md` | Persistent cross-session memory: error patterns, phase summaries, user preferences |

**`docs-vnext/` is supplementary engineering reference** — slice specs, sprint proofs, and design details. When `docs-vnext/` conflicts with root docs, root docs win.

## Hard Rules

### 1. Vertical-Slice Discipline

Build one complete workflow at a time. Each slice ships a fully usable end-to-end flow that replaces the equivalent in the old system.

- **No horizontal layers.** Do not "set up all components first" or "build all routes first."
- **No stubs.** Deferred features must not be stubbed, partially implemented, or visible in the UI. No placeholder routes, grayed-out nav items, "coming soon" labels, or skeleton feature modules.
- **If it's not in the current slice, it does not exist in the codebase.**
- The current phase and its sub-tasks are defined in `Plan.md`.

### 2. Mobile-First, Not Mobile-Parity

Every layout starts from the smallest viewport. Desktop adds density and editing capability.

- Mobile is a constrained, simplified view of the same workflows — not a divergent or mobile-only workflow set.
- Mobile surfaces: Reader (view-only) or Limited (view + operational actions like status, confirm, flag, notes).
- Desktop surfaces: Editor (full CRUD, structural changes, complex forms).
- Desktop-only surfaces (call sheet builder, admin settings) redirect to dashboard on mobile with a toast.
- Surface classifications are defined in `docs-vnext/design/experience-spec.md`.

### 3. Design-First, Reuse-First

- **Read `docs/DESIGN_SYSTEM.md` before writing any UI code.** It codifies every shared component, color token, typography class, view toggle pattern, table pattern, and spacing standard. Violations found in code review must be fixed before merge.
- Use shadcn/ui (Radix) as the primitive layer. Do not create custom primitives.
- `tokens.css` is the single source of design truth. All color, spacing, and typography values come from tokens.
- `src-vnext/styles/design-tokens.js` provides semantic Tailwind classes (`.heading-page`, `.heading-section`, `.heading-subsection`, `.label-meta`, `.body-text`, `.caption`, etc.). Prefer these over ad-hoc class combinations.
- Tailwind classes reference token values. No hardcoded hex colors or arbitrary spacing in components.
- Use `text-3xs` (9px), `text-2xs` (10px), `text-xxs` (11px) for micro font sizes — never `text-[9px]`, `text-[10px]`, `text-[11px]`.
- Use `text-sm` (13px), `text-base` (14px), `text-lg` (16px), `text-xl` (18px) — never `text-[13px]`, `text-[14px]`, `text-[15px]`. These sizes are overridden in `tailwind.config.js` to be 1-2px smaller than Tailwind defaults.
- Page headings use `heading-page` semantic class (weight 300 editorial) — never `text-xl font-semibold` or `text-2xl font-bold`.
- Section headings use `heading-section` — never `text-base font-semibold`. Subsections use `heading-subsection`.
- Tag badges use neutral body with subtle tag-color left borders (category as fallback) — never use rainbow `getTagColorClasses()` on `TagBadge`.
- Every surface uses the same building blocks. No one-off component variants for a single page.
- Fewer surfaces, fewer modes. Each new page/modal must justify its existence.

### 4. Reuse Existing Infrastructure

Firebase Auth, Firestore, Storage, Functions, security rules, and the data model are stable and unchanged.

- **Reuse existing Firestore collections and document shapes.** No new collections, no new fields, no schema changes without overwhelming justification.
- If a schema change is proposed, you must: (a) present the rationale, (b) present a migration plan (rules/backfill/dual-write), (c) STOP for approval before proceeding.
- **Approved exception:** `pendingInvitations` subcollection under `clients/{clientId}/` (Sprint S9) — stores pre-signup role invitations keyed by normalized email. Admin-only read/write in `firestore.rules`.
- **Approved exception:** `_functionQueue` collection (Sprint S9b) — Firestore Queue pattern for Cloud Function invocation. Client writes request doc, `processQueue` onCreate trigger processes server-side, client reads response via `onSnapshot`. Bypasses GCP org policy IAM restrictions. See Architecture.md "Cloud Functions" section.
- **Approved exception:** `visibility` and `createdBy` fields on project documents (Sprint S10). `visibility` is `"team"` | `"restricted"` | `"private"` (default `"team"`, field absent = `"team"`). `createdBy` stores the UID of the project creator. Type: `ProjectVisibility` in `shared/types/index.ts`.
- **Approved exception:** `comments` subcollection under `shotRequests/{requestId}/` (Sprint S12B) — `clients/{clientId}/shotRequests/{requestId}/comments/{commentId}` stores conversation threads. Admin+producer read/write in `firestore.rules`. `authorId` binding enforced on create. Body limit: 5000 chars in rules, 2000 chars (`MAX_COMMENT_CHARS`) client-side.
- **Approved exception:** `request-references` Storage path (Sprint S12B) — `clients/{clientId}/request-references/{requestId}/{filename}` for image uploads on structured references. Gated by `isValidUpload()` helper (image/* content-type + 10MB size limit) in `storage.rules`.
- **Approved exception:** Product family comment `allow create` includes `|| isAdmin()` override (Sprint S23) — enables comment transfer during admin product merge operations. Without this, transferred comments would fail the `createdBy == auth.uid` check.
- **Cloud Function invocation:** All callable functions use `callFunction()` from `shared/lib/callFunction.ts` (Firestore queue-based). Do NOT use `httpsCallable` or direct HTTP fetch. The `onRequest` exports in `functions/index.js` are dormant fallback. There are 8 queue handlers: `setUserClaims`, `claimInvitation`, `createShotShareLink`, `publicUpdatePull`, `deactivateUser`, `reactivateUser`, `resendInvitationEmail`, `sendRequestNotification`.
- **Email service:** `functions/email.js` sends invitation emails via Resend. Non-blocking — email failures are logged but do not block invitation creation. From: `Production Hub <noreply@unboundmerino.immediategroup.ca>`. Reply-to: `ted@immediategroup.ca`.
- **Approved field:** `lastSignInAt` on user documents (Sprint S11). Written by AuthProvider on each sign-in (fire-and-forget `setDoc` with `merge: true`). Displayed in admin team roster.
- **Firestore rules — shots vs talent/locations:** Shots allow write for any authed user (`isAuthed()`). Talent and locations restrict writes to `isAdmin() || isProducer()`. Do NOT restrict shots writes — crew users have `canManageShots` in rbac.ts.
- Reuse existing `firestore.rules` — do not modify security rules unless the change is required by a new vNext route and has been reviewed.
- **Firestore rules helpers (Sprint S10):** `hasGlobalRole(roles)` checks user's auth claim role against a list. `producerCanAccessProject(clientId, projectId)` grants producers access to projects with `visibility == "team"` or absent visibility field. These are cascaded to all sub-collections. Do not modify or duplicate these patterns.
- Auth custom claims (`role`, `clientId`) and the 5-role model (admin, producer, crew, warehouse, viewer) are fixed infrastructure.
- Firestore path helpers from `shared/lib/paths` are the single source for collection references. Key helpers include `shotRequestsPath`, `shotRequestDocPath`, and `shotRequestCommentsPath`.
- Shared text utilities in `shared/lib/textUtils.ts` (normalizeText, normalizeWhitespace, humanizeLabel, parseCsvList) — do not create local duplicates.
- **SKU colorName deduplication:** When importing SKUs into families that already have legacy SKUs, match by BASE color name (strip vendor code suffix via regex `\s*\([^)]*\)$`). Legacy SKUs use simple names ("Black"), imports use vendor-coded names ("Black (0101)"). Always merge into the existing legacy SKU to preserve doc IDs that may be referenced by project product selections. Never create a new SKU if a legacy one with the same base color already exists.
- **Approved field:** `styleNumbers` on ProductFamily documents (Line Sheet Import, 2026-03-12). Already written to Firestore by import scripts — TypeScript type formalized to match. Display: `styleNumbers[0]` as dominant, `styleNumbers.slice(1)` as aliases. **Anti-pattern:** Before proposing new Firestore fields, check if import scripts already write the data. TypeScript types may lag behind what's actually in documents.
- **Shared utility:** `shared/lib/sizeRange.ts` — pure `compressSizeRange()` function for display. Compresses `["S","M","L","XL"]` → `"S - XL"`, composite inseam sizes `["S/30","S/32","M/30"]` → `"S - M / 30", 32"`, sock composites pass through. Do not store computed size ranges — always compute at render time.
- **Bulk shot creation:** `features/requests/lib/bulkShotWrites.ts` (Sprint S12C). Uses `writeBatch` with `BATCH_CHUNK_SIZE = 250` (Firestore limit) and enforces `MAX_BULK_ITEMS = 500` cap. Always filter deleted products client-side (`deleted !== true`) — never use `where("deleted","==",false)` which excludes docs missing the field.

### 5. State Strategy

- Server state = Firestore `onSnapshot` subscriptions. No Redux, Zustand, or client-side cache.
- List views must aggressively unsubscribe on unmount to avoid fan-out.
- Optimistic updates are allowed only for idempotent state transitions (status toggles). Optimistic entity creation is explicitly disallowed — all creates must await Firestore write confirmation.
- Readiness indicators (e.g., shots planned, products assigned) must be denormalized aggregates on the parent document, not computed via client-side fan-out queries.
- No duplicate state. Never cache Firestore data in React state. Subscribe and render.
- No custom offline sync engine. Firestore's default IndexedDB persistence is relied upon for offline reads. No custom mutation queue, conflict resolution UI, or sync status system.
- Context providers are minimal: Auth, ProjectScope, Theme, SearchCommand. `SearchCommandProvider` (Sprint S14) is a real useState-backed provider powering the Cmd+K command palette (`CommandPalette` component in AppShell). Uses `cmdk` + Fuse.js (threshold 0.35) for universal search across projects, products, talent, crew. Recent items in `sb:cmd-recent` localStorage key (last 5). Zero Firestore subscriptions when palette is closed.

### 6. No Over-Engineering

- Do not add features, refactor code, or make improvements beyond what the current slice requires.
- Do not add error handling for scenarios that cannot happen.
- Do not create abstractions for one-time operations.
- Do not add comments, docstrings, or type annotations to code you did not change.
- Three similar lines of code is better than a premature abstraction.

### 6b. No Deferring Known Issues

- **Never "document for backlog" as a resolution for a known issue.** If a code reviewer or Codex identifies a HIGH or CRITICAL issue, it must be fixed in the current sprint — not noted in a memory file and forgotten.
- **"Documented" is not "addressed."** Logging a known bug, architecture flaw, or code quality issue in MEMORY.md or HANDOFF.md without a concrete fix is deferring tech debt. This is explicitly prohibited.
- **Every identified issue gets one of three outcomes:** (1) Fixed immediately, (2) Fixed in a follow-up phase within the same sprint with a tracked task, or (3) Explicitly approved by the user as an accepted limitation with rationale. Option 3 requires user confirmation — the AI cannot self-approve deferrals.

### 7. Documentation Discipline

Runtime documentation must stay in sync with the codebase. Stale docs break the resume protocol and waste future sessions.

- **After completing any task:** Update `docs/_runtime/HANDOFF.md` (next steps) and `docs/_runtime/CHECKPOINT.md` (what's done).
- **After completing a Plan.md sub-task:** Check the corresponding checkbox in `Plan.md`. Do not leave completed work unchecked.
- **Before ending a session:** Re-read all three files (`HANDOFF.md`, `CHECKPOINT.md`, `Plan.md`) and verify they are consistent with each other and with what was actually built.
- **On resume ("pick up where we left off"):** Read `HANDOFF.md` first, then cross-check against `CHECKPOINT.md` and `Plan.md` before starting work.
- **MEMORY.md:** Update the current phase status line when progress changes.

The authoritative tracking files are:

| File | What to update | When |
|------|---------------|------|
| `Plan.md` | Check sub-task checkboxes | When a sub-task is fully complete |
| `docs/_runtime/HANDOFF.md` | Current state, just completed, next steps, verification | After every implementation session |
| `docs/_runtime/CHECKPOINT.md` | Completed tasks list, what's next, critical file state | After every implementation session |
| `MEMORY.md` | Current phase status line | When phase progress changes |

### 8. Production Readiness Overrides

Phase order is the default. Override when reality demands it:

- **Onboarding blockers take priority.** If real users cannot sign in, get roles assigned, or access core workflows, fix that before continuing feature work. Check PRD.md's MUST-HAVE list — anything there that's missing from Plan.md is a candidate for an override sprint.
- **On resume, ask:** "Can a new team member use this app today?" If no, the blocker is the next task — regardless of what Plan.md says is next.
- **Override protocol:** (1) identify the blocker, (2) discuss with user, (3) add an override sprint to Plan.md before the next planned phase, (4) document rationale in MEMORY.md.

### 9. Sprint S15 New Infrastructure

- **Export Builder route:** `/projects/:id/export` (desktop-only, RequireDesktop). Block-based PDF composition with 9 block types, template system, variable tokens, document operations. All code in `src-vnext/features/export/`. Uses `@react-pdf/renderer` (already a dependency). Templates stored in localStorage (`sb:export-templates`, `sb:export-doc:{projectId}`).
- **Shoot urgency system:** `src-vnext/features/products/lib/shootUrgency.ts` — 5-tier time-based urgency (OVERDUE/URGENT/SOON/UPCOMING/UNSCHEDULED) alongside existing confidence system. Overdue products sort first in readiness widget.
- **Page transitions:** CSS-only `fade-in-rise` keyframes in `tokens.css`, `PageTransition` wrapper in `AppShell.tsx`. Respects `prefers-reduced-motion`. No framer-motion dependency.
- **View consolidation:** Shot ViewMode narrowed from `"gallery"|"visual"|"table"` to `"card"|"table"`. Old localStorage values auto-migrate. `ShotVisualCard.tsx` deleted.
- **Library table views:** `TalentTable.tsx` and `LocationsTable.tsx` with sortable columns, Grid/Table and List/Table toggles. Persist to localStorage (`sb:talent-view`, `sb:locations-view`).
- **Call sheet improvements:** Section toggles (show/hide via Switch), per-field customization (`EditSectionFieldsDialog` with rename/reorder/resize/toggle), layout templates (3 built-in + user-saved via `CallSheetLayoutDialog`). Field configs persist to Firestore via `callSheetConfig`.
- **Bulk shot delete:** `bulkSoftDeleteShots()` in `shotLifecycleActions.ts`. Uses `writeBatch` chunked at 250, capped at `MAX_BULK_DELETE=500`. Typed "DELETE" confirmation dialog in `ShotListPage.tsx` bulk action bar.

### 10. Sprint S19 New Infrastructure

- **Per-colorway launch dates:** `updateProductSkuLaunchDateWithSync()` in `productWorkspaceWrites.ts` batches the SKU `launchDate` write + family `earliestLaunchDate` recomputation in a single `writeBatch`. `applyLaunchDateToAllSkus()` batch-writes the family + all SKU docs (capped at 498 SKUs). Both use `resolveEarliestLaunchDate()` from `assetRequirements.ts`.
- **Product version tracking:** `productVersioning.ts` mirrors `shotVersioning.ts` pattern. `ProductVersion` type extends `ShotVersion` with `fieldChanges: ProductVersionFieldChange[]` (before→after per field) and `skuSnapshots` (sparse map of changed SKUs). Path builder: `productFamilyVersionsPath(familyId, clientId)`. Firestore rules already existed at `firestore.rules:402-408` (CREATE only, immutable).
- **Version history UI:** `ProductVersionHistorySection.tsx` in the Activity tab. Collapsible, lazy-load via `useProductVersions`. Shows "Jessica changed Launch Date from Apr 5 to Apr 10" level detail. Restore: admin/producer only, desktop-only, family-level fields only (not per-SKU).
- **All version writes are best-effort:** Pattern: `void createProductVersionSnapshot({...}).catch(err => console.error(...))`. Never blocks core writes.
- **Shared utility:** `timestampToInputValue()` in `productDetailHelpers.ts` — converts Firestore Timestamp to `YYYY-MM-DD` string for HTML date inputs.

### 11. Sprint S20 New Infrastructure

- **Approved field:** `activeRequirementCount` on ProductFamily documents. Denormalized count of SKUs with active (needed/in_progress) asset requirements. Maintained atomically via `writeBatch` in `updateProductSkuAssetRequirements()`. Backfilled via `scripts/migrations/2026-04-backfill-denormalized-counts.ts`.
- **Sample count denormalization:** `createProductSample()` and `updateProductSample()` now atomically sync `sampleCount`, `samplesArrivedCount`, `earliestSampleEta` to the family doc via `writeBatch` when `allSamples` is provided. Callers in `ProductSamplesSection` thread the samples array.
- **Shoot Readiness widget decomposed:** `ShootReadinessWidget.tsx` (263 lines orchestrator) + `ReadinessCard.tsx`, `ExpandedFamilySkus.tsx`, `ReadinessToolbar.tsx`, `BulkClearLaunchDatesDialog.tsx`, `readinessFilters.ts`.
- **Readiness eligibility Tier 4:** Products with `activeRequirementCount > 0` appear in readiness even without launch dates or samples.
- **"Has shoot requirements" filter:** Shows products with launch dates AND/OR active requirements. Persisted to `localStorage` key `sb:readiness-requirements-filter`. Default OFF.
- **Always-visible checkboxes:** No selection mode toggle. Checkboxes always visible on readiness cards. Mobile: card body tap expands/collapses. Desktop: card body click navigates to product detail.
- **Bulk clear:** `BulkClearLaunchDatesDialog` clears family + all SKU dates via sequential `applyLaunchDateToAllSkus` calls. Fetches SKU IDs via one-time `getDocs`.

### 12. Hotfix: Admin Permissions + Comment Moderation (2026-04-05)

- **User doc CREATE rule fix:** `firestore.rules` user doc CREATE was self-only, blocking admin invite of existing Firebase Auth users. Fixed to `isAdmin() || (isAuthed() && request.auth.uid == userId)`.
- **Admin comment moderation:** Shot and product comment update rules allow `isAdmin()` to soft-delete others' comments with full immutable field protection (body, createdBy, createdAt, createdByName, createdByAvatar cannot change). UI: "Remove" button with `ConfirmDialog` for admin moderation. Request comments unchanged (immutable audit trail).
- **Export saveReport hardened:** `useExportReports.ts` save path changed from `setDoc(merge: true)` to `updateDoc` to prevent accidental CREATE without `createdBy` field.

### 13. Sprint S21 New Infrastructure

- **Tag canonicalization:** `mapShot.ts:normalizeTags()` calls `canonicalizeTag()` from `shared/lib/tagDedup.ts` on every tag at the Firestore→React boundary. If a tag label matches a default tag (Men, Women, Photo, etc.), the canonical ID/color/category replaces the random one. ALL downstream consumers (filters, management writes, export) automatically work with canonical IDs.
- **Shared tag utility:** `shared/lib/tagDedup.ts` exports `normalizeTagLabel()`, `findCanonicalTag()`, `canonicalizeTag()`, `deduplicateTags()`. Always use `findCanonicalTag()` before creating new tags to prevent duplicates.
- **Share link column config:** `columnConfig` field on `shotShares` documents stores `Array<{key, visible, order}>`. `PUBLIC_SHARE_COLUMNS` in `shotTableColumns.ts` defines 9 available public columns. `mergeShareColumnConfig()` merges saved config with defaults. Viewer overrides persist to `localStorage` key `sb:share-cols:{shareToken}`.
- **`ColumnSettingsList.tsx`:** Extracted DnD column list from `ColumnSettingsPopover.tsx`. Reusable by both the popover (shot list table) and the share dialog.
- **`ResolvedPublicShot` extended:** Now includes `tags` and `referenceLinks` fields for public share pages.
- **Export column reorder:** `ShotGridColumn.order?: number` (optional for backward compat). `ColumnTableSettings.tsx` has DnD via @dnd-kit. PDF and preview renderers sort by `order` before filtering visible columns.
- **PDF tag badges:** `PDF_TAG_CATEGORY_COLORS` in `pdfStyles.ts` provides category-accent colors for PDF tag rendering. `ShotGridBlockPdf.tsx` renders tags as styled mini-badges with left border accent.
- **Migration script:** `scripts/migrations/2026-04-deduplicate-shot-tags.ts` deduplicates existing tag data. Run with `--clientId <id>` and `--write` flag.

## Legacy Codebase Context

The existing `src/` directory contains the **legacy JavaScript app** (~583 files, `.js`/`.jsx`). vNext is a **ground-up TypeScript rebuild** — not a migration or refactor of legacy files.

- **Do not modify legacy `src/` files** unless porting specific utilities to `shared/lib/`.
- Legacy code is reference material for understanding existing Firestore patterns, auth flows, and data shapes.
- The legacy `src/lib/paths.js` hardcodes a `CLIENT_ID` constant. vNext must always resolve `clientId` from Firebase Auth custom claims via `AuthProvider` — never from a hardcoded value.
- Legacy deps `@tanstack/react-query`, `react-select`, `react-easy-crop`, `reactjs-tiptap-editor` were removed from `package.json` in Sprint S13. Do not add them back or import them in any code.

## Project Overview

Production Hub (formerly Shot Builder) is a ground-up redesign of the production planning app. It is mobile-first, opinionated, and built as vertical slices. The goal is to materially reduce the time and friction from brief to shoot-ready.

See `Architecture.md` for tech stack, module structure, routes, data model, auth/RBAC, design system, performance budgets, and security checklist.

## Essential Commands

```bash
npm install                    # Install dependencies
npm run dev                    # Start dev server (localhost:5173)
npm run build                  # Production build
npm run preview                # Preview production build
npm test                       # Run Vitest (all tests via wrapper script)
npm test -- src/path/file.test.ts  # Run a single test file
npm run test:watch             # Vitest watch mode
npm run lint                   # ESLint (zero warnings, --max-warnings=0)
npm run test:e2e               # Playwright E2E tests (all browsers)
npm run test:e2e:chromium      # Playwright Chromium only
```

**Note:** `npm test` runs through `scripts/run-vitest.cjs` which forces `--pool threads --singleThread` to avoid concurrency issues on macOS paths with spaces. The `vitest.config.ts` pool setting (`forks`) applies only to `test:watch` and `test:ui`.

## Shot Status Labels

Canonical labels (from `statusMappings.ts`). Use these everywhere — views, filters, PDFs, badges:

| Firestore value | Display label |
|---|---|
| `todo` | **Draft** |
| `in_progress` | **In Progress** |
| `on_hold` | **On Hold** |
| `complete` | **Shot** |

Do NOT use alternative labels (To do, Complete, Done). `statusMappings.ts` is the single source of truth.

## Shot Request Status Labels

Canonical labels (from `requestStatusMappings.ts`). Use these everywhere:

| Firestore value | Display label | Color |
|---|---|---|
| `submitted` | **Submitted** | blue |
| `triaged` | **Triaged** | amber |
| `absorbed` | **Absorbed** | green |
| `rejected` | **Rejected** | gray |

`requestStatusMappings.ts` is the single source of truth for request statuses.
