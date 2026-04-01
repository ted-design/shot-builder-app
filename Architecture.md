# Architecture -- Production Hub

This document describes the **current reality** of the codebase, not aspirational goals.

---

## Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | React 18.3 (SPA) | No SSR. Single-page app. |
| Language | JavaScript (.js/.jsx) primary, TypeScript (.ts/.tsx) for new code | Mixed codebase |
| Build | Vite 7 | Dev server + production builds |
| Styling | Tailwind CSS 3 + tokens.css | tokens.css is the single source of design truth |
| Primitives | shadcn/ui (Radix) | Generated in `src/components/ui/`. Never modify inline. |
| Server State | Firestore onSnapshot (real-time) | vNext uses direct onSnapshot exclusively. Legacy src/ uses TanStack Query (not used in new code). |
| Client State | React Context + useState | 4 minimal context providers |
| Backend | Firebase (Auth, Firestore, Storage, Functions) | Multi-tenant, clientId-scoped |
| Routing | React Router v6 | Lazy-loaded routes via React.lazy |
| Rich Text | tiptap (via reactjs-tiptap-editor) | Shot notes, product descriptions |
| Search | Fuse.js (client-side, threshold 0.35) + cmdk (command palette) | Cmd+K global search (Sprint S14) |
| Drag & Drop | @dnd-kit | Sortable lists |
| Error Tracking | Sentry (@sentry/react) | Error boundaries + breadcrumbs |
| PDF | @react-pdf/renderer | Pull sheet export |
| Testing | Vitest + Testing Library + Playwright | See Testing section |

### Dependency Notes

- **TanStack Query, react-select, react-easy-crop, reactjs-tiptap-editor:** Removed from `package.json` in Sprint S13. Vendor chunk reduced from 891kB → 276kB. Do not add them back.
- **tiptap:** Heavy dependency used in legacy shot notes and product descriptions. Not yet used in vNext. Evaluate before adding to new surfaces.

---

## File Structure

```
src/
├── auth/                  # Auth adapter, AuthReadyGate
├── components/            # All UI + domain components (flat by domain)
│   ├── activity/          # Activity feed, timeline
│   ├── admin/             # Admin panel, user management
│   ├── callsheet/         # Call sheet builder, tracks, sections
│   ├── comments/          # Comment threads, moderation
│   ├── common/            # Shared wrappers, error boundaries
│   ├── layout/            # SidebarLayout, MobileDrawer, PageHeader
│   ├── products/          # Product cards, pickers, editors
│   ├── pulls/             # Pull list, editor, fulfillment
│   ├── shots/             # Shot cards, editor
│   │   └── workspace/     # V3 editor: header band, context dock, canvas
│   ├── talent/            # Talent management
│   ├── ui/                # shadcn/ui primitives + LoadingSpinner, SearchCommand, etc.
│   └── [other domains]/   # palette, planner, schedule, tags, versioning, etc.
├── context/               # React context providers
│   ├── AuthContext.jsx
│   ├── ProjectScopeContext.jsx
│   ├── ThemeContext.jsx
│   ├── SearchCommandContext.jsx
│   └── DemoModeAuthProvider.jsx
├── hooks/                 # Custom hooks (40+)
├── lib/                   # Utilities (firebase, paths, rbac, flags, utils)
├── pages/                 # Route-level page components (48+)
│   └── dev/               # Dev-only diagnostic pages
├── routes/                # Route guards (RequireRole, ProjectParamScope)
├── test-utils/            # Mock providers, test factories
└── types/                 # TypeScript type definitions
```

**Note:** This is NOT the `src/features/{feature}/` structure from the original vNext spec. The app evolved incrementally from the legacy codebase. The flat structure works at current scale.

### vNext Module Structure (`src-vnext/`)

```
src-vnext/
├── app/              # App shell, providers, router, route guards
│   ├── providers/    # AuthProvider, ProjectScopeProvider
│   └── routes/       # Route definitions + guards (RequireAuth, RequireDesktop)
├── features/         # Domain modules (projects/, shots/, pulls/, etc.)
│   └── {feature}/
│       ├── components/
│       ├── hooks/
│       └── lib/
├── shared/           # Shared utilities, no domain logic
│   ├── components/   # AppShell, sidebar/, ErrorBoundary, Skeleton, LoadingState, state pages
│   │   └── sidebar/  # 11 nav components (DesktopSidebar, MobileDrawer, etc.)
│   ├── hooks/        # useMediaQuery (isMobile/isTablet/isDesktop), useDebounce
│   ├── lib/          # Firebase init, paths, rbac, utils, validation (Zod schemas)
│   └── types/        # Shared TypeScript types
└── ui/               # shadcn/ui generated components (never modify inline)
```

Both `src/` and `src-vnext/` are active. New code goes in `src-vnext/`.

---

## Route Map

### Public Routes (no auth)

| Route | Page | Notes |
|-------|------|-------|
| `/login` | LoginPage | Google sign-in. Split-screen layout: lifestyle hero left, sign-in panel right. UM logo centered on sign-in panel (white PNG + CSS `invert` for light mode, `w-[300px]`). Immediate logo theme-aware (`dark:hidden` / `hidden dark:block`). CSS custom properties. Statically imported (Safari OAuth). |
| `/pulls/shared/:shareToken` | PullPublicViewPage | Public pull sheet (read-only) |
| `/pulls/shared/:shareToken/guide` | WarehousePickGuidePage | Guided pick flow (full-screen stepper) |
| `/shots/shared/:shareToken` | PublicShotSharePage | Public shot share (vNext) |
| `/demo/*` | DemoPage | Demo mode (blocks writes) |

### Authenticated Routes

| Route | Page | Notes |
|-------|------|-------|
| `/` | Redirect -> `/projects` | |
| `/projects` | ProjectDashboard | Tabbed: Projects tab (default, project grid) + Shoot Readiness tab (all authenticated roles). Tab state via `?tab=readiness` URL param. |
| `/projects/:id` | Redirect -> `shots` | |
| `/projects/:id/shots` | ShotListPage | Shot list (gallery / visual / table views) |
| `/projects/:id/shots/:sid` | ShotDetailPage | Three-panel shot editor |
| `/projects/:id/pulls` | PullListPage | Project-scoped pull list |
| `/projects/:id/pulls/:pid` | PullDetailPage | Pull detail + fulfillment |
| `/projects/:id/assets` | ProjectAssetsPage | |
| `/projects/:id/tags` | TagManagementPage | Desktop-only (RequireDesktop) |
| `/projects/:id/schedules` | SchedulesRedirect | Redirects to `../callsheet` |
| `/projects/:id/callsheet` | CallSheetBuilderPage | Desktop-only (RequireDesktop) |
| `/projects/:id/schedules/:scheduleId/onset` | OnSetViewerPage | Standalone on-set viewer (all roles, no RequireDesktop). Wraps OnSetViewer component. Sprint S13. |
| `/requests` | ShotRequestCentrePage | Org-level shot request centre. Admin+producer only (RequireRole). Desktop: two-panel (list + triage). Mobile: list only. Absorb dialog supports both "add to existing project" and "create new project" modes (Phase 8.5). `/inbox` redirects here (Sprint S11). |
| `/products` | ProductListPage | Org-level product library |
| `/products/new` | ProductEditorPage | Create new product (vNext) |
| `/products/:fid` | ProductDetailPage | Thin shell + 6 sections (Overview, Colorways, Samples, Files, Requirements, Activity). Phase 10: Requirements tab (chip/table toggle, 5-state asset flags incl. AI Generated). Colorways: hero image with EditableProductImage. Files: documents only (identity images moved to Colorways). Samples: returnDueDate + condition fields. |
| `/products/:fid/edit` | ProductEditorPage | Edit product (vNext) |
| `/library` | Redirect -> `/library/talent` | |
| `/library/talent` | LibraryTalentPage | Full CRUD: card grid, Sheet detail drawer (right on desktop, bottom on mobile), prev/next nav + keyboard arrows. Tabs: Profile / Shot History / Casting Brief. Search/filter toolbar (gender, measurement ranges, agency), auto-match scoring. Project pills read-only with Link navigation. Decomposed: 12 files in `features/library/components/`. Casting brief is top-level collapsible panel (CastingBriefPanel) with data-driven range sliders. |
| `/library/crew` | LibraryCrewPage | Table list with search, create dialog, row click to detail |
| `/library/crew/:crewId` | CrewDetailPage | Inline edit all fields, notes, delete with confirmation |
| `/library/locations` | LibraryLocationsPage | Table list with search, create dialog, row click to detail |
| `/library/locations/:locationId` | LocationDetailPage | Photo upload, address sub-fields, inline edit, delete |
| `/library/palette` | LibraryPalettePage | Color swatches |
| `/admin` | AdminPage | Role-gated: admin only, desktop-only (RequireDesktop) |

### Legacy Redirects

| Old Route | Redirects To |
|-----------|-------------|
| `/projects/:id/schedules` | `/projects/:id/callsheet` (via SchedulesRedirect) |
| `/inbox` | `/requests` (via Navigate replace, Sprint S11) |

**Note:** `/account` existed in the legacy app but is not implemented in vNext. It is not present in the route definitions.

### Dev-Only Routes (import.meta.env.DEV)

`/dev/import-q2`, `/dev/import-q2-shots`, `/dev/import-q1-hub-shots`

---

## Data Model (Firestore)

All data scoped by `clientId` from Firebase Auth custom claims.

```
/clients/{clientId}/
  ├── projects/{projectId}/
  │   ├── members/{userId}/
  │   ├── pulls/{pullId}/              # Public via shareToken
  │   ├── lanes/{laneId}/
  │   ├── departments/{departmentId}/
  │   │   └── positions/{positionId}/
  │   ├── activities/{activityId}/     # Audit trail, 90-day retention
  │   └── schedules/{scheduleId}/
  │       ├── entries/{entryId}/
  │       ├── dayDetails/{detailId}/
  │       ├── talentCalls/{talentId}/
  │       ├── crewCalls/{crewMemberId}/
  │       ├── clientCalls/{clientCallId}/
  │       └── callSheet/config
  ├── shots/{shotId}/
  │   ├── comments/{commentId}/
  │   ├── versions/{versionId}/
  │   └── presence/{docId}/
  ├── productFamilies/{familyId}/
  │   ├── skus/{skuId}/
  │   ├── samples/{sampleId}/
  │   ├── documents/{documentId}/
  │   ├── comments/{commentId}/
  │   └── versions/{versionId}/
  ├── productClassifications/{classificationId}/
  ├── talent/{talentId}/
  ├── locations/{locationId}/
  ├── crew/{crewMemberId}/
  ├── colorSwatches/{swatchId}/
  ├── users/{userId}/
  ├── notifications/{notificationId}/
  ├── shotRequests/{requestId}/          # Phase 8/8.5 — Shot Request Inbox + Create Project from Request
  │   └── comments/{commentId}/          # Sprint S12B — conversation threads (admin+producer read/write)
  └── pendingInvitations/{normalizedEmail}/  # Sprint S9 — pre-signup role invitations

/shotShares/{shareToken}               # Denormalized public share docs
/systemAdmins/{email}                  # System admin list
/_functionQueue/{docId}                # Cloud Function invocation queue (Firestore trigger)
```

### Key Document Shapes

**Shot:**
```typescript
interface Shot {
  id: string
  title: string
  description?: string
  projectId: string
  clientId: string
  status: 'todo' | 'in_progress' | 'complete' | 'on_hold'  // Firestore values
  talent: string[]           // talentId references
  products: ProductAssignment[]
  locationId?: string
  laneId?: string
  sortOrder: number
  notes?: string
  heroImage?: { path: string; downloadURL: string }
  tags?: string[]
  referenceLinks?: ReferenceLink[]
  createdAt: Timestamp
  updatedAt: Timestamp
  createdBy: string
}
```

**Project:**
```typescript
interface Project {
  id: string
  name: string
  clientId: string
  status: 'active' | 'completed' | 'archived'
  shootDates: string[]      // YYYY-MM-DD strings
  notes?: string
  briefUrl?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

**Pull:**
```typescript
interface Pull {
  id: string
  projectId: string
  clientId: string
  shotIds: string[]
  items: PullItem[]
  status: 'draft' | 'in-progress' | 'fulfilled'  // Firestore values
  shareToken?: string
  shareEnabled: boolean
  shareExpireAt?: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

**ShotRequest:**
```typescript
interface ShotRequest {
  id: string
  clientId: string
  status: 'submitted' | 'triaged' | 'absorbed' | 'rejected'
  priority: 'normal' | 'urgent'
  title: string
  description?: string | null
  referenceUrls?: string[] | null
  deadline?: string | null
  notes?: string | null
  submittedBy: string
  submittedByName?: string | null
  submittedAt: Timestamp
  updatedAt: Timestamp
  triagedBy?: string | null
  triagedAt?: Timestamp | null
  absorbedIntoProjectId?: string | null
  absorbedAsShotId?: string | null
  rejectionReason?: string | null
  relatedFamilyIds?: readonly string[] | null    // Phase 10: link requests to product families
  notifyUserIds?: string[] | null                // Sprint S12A: recipient IDs for email notifications
  references?: ShotRequestReference[] | null     // Sprint S12B: structured image references
}

interface ShotRequestReference {
  url: string
  imageUrl?: string
  caption?: string
}

interface ShotRequestComment {
  id: string
  authorId: string
  authorName: string
  body: string                                   // max 2000 chars client-side, 5000 in rules
  createdAt: Timestamp
}
```

**ProductFamily** (Phase 10 additions):
```typescript
interface ProductFamily {
  // ... existing fields ...
  sampleCount?: number                     // Denormalized: total samples in family
  samplesArrivedCount?: number             // Denormalized: samples with status 'arrived'
  earliestSampleEta?: Timestamp | null     // Denormalized: earliest ETA across samples
  earliestLaunchDate?: Timestamp | null    // Denormalized: earliest launch date across SKUs
}
```

**ProductSku** (Phase 10 additions):
```typescript
interface ProductSku {
  // ... existing fields ...
  launchDate?: Timestamp | null            // Per-colorway launch date (overrides family)
}
```

**ProductAssetRequirements** (Phase 10):
```typescript
type ProductAssetType = 'ecomm_on_figure' | 'lifestyle' | 'off_figure_pinup' | 'off_figure_detail' | 'video' | 'other' | 'ecomm' | 'campaign' | 'ai_generated'
type ProductAssetFlag = 'needed' | 'in_progress' | 'delivered' | 'ai_generated' | 'not_needed'

interface ProductAssetRequirements {
  [key: string]: ProductAssetFlag | string | undefined
  other_label?: string
}
```

### Path Builders

All Firestore paths built via `src-vnext/shared/lib/paths.ts`. Every function requires explicit `clientId` -- no hardcoded defaults. Returns string arrays for `collection()` / `doc()`.

Key path builders: `projectsPath`, `shotsPath`, `productFamiliesPath`, `talentPath`, `locationsPath`, `crewPath`, `crewDocPath`, `locationDocPath`, `departmentsPath`, `departmentPositionsPath`, `usersPath`, `userDocPath`, `projectMembersPath`, `projectMemberDocPath`, `shotRequestsPath`, `shotRequestDocPath`, `shotRequestCommentsPath`.

### Shot Request Write Functions

All in `src-vnext/features/requests/lib/requestWrites.ts`:

| Function | Type | What it does |
|----------|------|-------------|
| `submitShotRequest` | `addDoc` | Creates a new shot request doc |
| `triageAbsorbRequest` | `runTransaction` | Reads request, creates shot in existing project, marks request absorbed |
| `createProjectFromRequest` | `runTransaction` | Reads request, creates project + member doc + shot, marks request absorbed (Phase 8.5) |
| `triageRejectRequest` | `runTransaction` | Reads request, marks rejected with optional reason |

`createProjectFromRequest` is the most complex — 4 writes in a single transaction: project doc, member doc (producer auto-membership via `projectMemberDocPath`), shot doc, request update.

### Shot Request S12 Components

| Component / Hook / Lib | Location | Purpose |
|---|---|---|
| `CommentThread` | `features/requests/components/` | Conversation thread with smart auto-scroll, Enter-to-send, empty state. MAX_COMMENT_CHARS=2000. |
| `RecipientPicker` | `features/requests/components/` | Multi-select picker for notification recipients (admin+producer users) in SubmitShotRequestDialog |
| `ReferenceInput` | `features/requests/components/` | Structured reference editor with Firebase Storage upload, filename sanitization, MAX_REFERENCES=10 |
| `BulkAddToProjectDialog` | `features/products/components/` | Dialog to bulk-create shots from selected products. Project picker + family/SKU granularity toggle. |
| `useProductSelection` | `features/products/hooks/` | Multi-select state for products using prefixed Set (`fam:` / `sku:` prefix) |
| `useRequestComments` | `features/requests/hooks/` | Real-time Firestore subscription for request comments subcollection |
| `bulkShotWrites.ts` | `features/requests/lib/` | `bulkCreateShotsFromProducts` — writeBatch with BATCH_CHUNK_SIZE=250, MAX_BULK_ITEMS=500 cap |
| `OnSetViewerPage` | `features/schedules/components/` | Standalone route wrapper for on-set viewer — no RequireDesktop, all roles (Sprint S13) |

---

## State Management

### vNext Approach

1. **Firestore onSnapshot** -- Direct real-time subscriptions via custom hooks: `useFirestoreDoc`, `useFirestoreCollection`. All vNext server state uses this pattern exclusively.
2. **TanStack Query** -- Legacy only (`src/`). Removed from `package.json` in Sprint S13. Not importable in any code. Legacy `src/` references are read-only.
3. **React Context** -- Four providers:
   - `AuthProvider`: user, claims, clientId, role
   - `ProjectScopeProvider`: active projectId, project metadata
   - `ThemeProvider`: light/dark/system mode (custom, `sb:theme` localStorage key)
   - `SearchCommandProvider`: command palette state
4. **React useState** -- Local UI state (sidebar open, form drafts, modal visibility)

### Rules

- No Redux, Zustand, or external state stores
- No duplicate state -- subscribe and render, don't cache Firestore in React state
- Optimistic updates only for idempotent transitions (status toggles)
- Never optimistic-create entities -- await Firestore write confirmation
- List views unsubscribe onSnapshot on unmount
- **New code:** Prefer direct onSnapshot over TanStack Query

---

## Feature Flags

Defined in `src/lib/flags.js`. Overridable via localStorage and URL params.

| Flag | Default | Purpose |
|------|---------|---------|
| `newAuthContext` | ON | New auth context provider |
| `projectScoping` | ON | Project-scoped routing |
| `projectScopedAssets` | ON | Assets scoped to projects |
| `callSheetBuilder` | OFF | Call sheet builder surface |
| `pdfExport` | OFF | PDF export modal |
| `demoMode` | OFF | Demo mode (blocks writes, optimistic UI only) |
| `productSearch` | OFF | Product search feature |
| `newNavbar` | OFF | New navbar design |
| `calendarPlanner` | OFF | Calendar planner view |

**Cleanup status (Phase 7E):** `shotEditorV3`, `productsV2`, `productsV3`, `pullsEditorV2` flags removed — dead code paths consolidated. Remaining ON flags (`newAuthContext`, `projectScoping`, `projectScopedAssets`) can be removed when ready to drop their off-paths.

---

## Auth & RBAC

- **Provider:** Firebase Auth with Google sign-in
- **Custom claims:** `role` (admin | producer | crew | warehouse | viewer), `clientId`
- **Route guards:** `RequireAuth` (in `AuthReadyGate`), `RequireRole` (role check), `ProjectParamScope` (sets project context)
- **Firestore rules:** Enforce `clientMatches(clientId)` on every read/write
- **RBAC helpers** (`src-vnext/shared/lib/rbac.ts`):

| Permission | Roles |
|-----------|-------|
| `canManageProjects` | admin, producer |
| `canManageShots` | admin, producer, crew |
| `canManageSchedules` | admin, producer |
| `canManageProducts` | admin, producer |
| `canManageTalent` | admin, producer |
| `canManageCrew` | admin, producer |
| `canManageLocations` | admin, producer |
| `canGeneratePulls` | admin, producer |
| `canManagePulls` | admin, producer, warehouse |
| `canFulfillPulls` | admin, warehouse |
| `canSubmitShotRequests` | admin, producer |
| `canTriageShotRequests` | admin, producer |

- **Project-scoped roles:** Per-project membership stored in `projects/{pid}/members/{uid}` subcollection. Each member doc has `role`, `addedAt`, `addedBy`. Project creation auto-adds creator as member via `writeBatch`. `resolveEffectiveRole()` combines global role + per-project role (implemented in `shared/lib/rbac.ts`).
- **Project visibility:** Projects support a `visibility` field with 3 states: `"team"` (default), `"restricted"` (only explicit project members), `"private"` (only creator + admins). Firestore rules use a **two-tier model**: `allow list` grants producers unconditional access to list all org projects (needed for dashboard); `allow get` enforces full visibility rules per-document (team-only for producers without membership, restricted/private require membership or creator status). Sub-collection access (shots, pulls, schedules) enforces visibility via `producerCanAccessProject()`. This means producers can see project names/metadata for all projects in the dashboard, but cannot access sub-resources of restricted/private projects without membership. Default: `"team"` (field absent = `"team"`). Type: `ProjectVisibility` in `shared/types/index.ts`.
- **User deactivation:** Admins can deactivate users via `deactivateUser()` Cloud Function, which sets `status: "deactivated"` on the user doc and revokes their custom claims. Reactivation via `reactivateUser()` restores claims with a chosen role. Self-deactivation is prevented client-side. AlertDialog confirmation required.
- **Cloud Function:** `setUserClaims` (admin-only, sets role + clientId on user)
- **Email service:** Invitation emails sent via Resend (`functions/email.js`). From: `Production Hub <noreply@unboundmerino.immediategroup.ca>`. Reply-to: `ted@immediategroup.ca`. HTML + plain text templates with Production Hub branding. Non-blocking — invitation is valid without email delivery. Triggered by `handleResendInvitationEmail` Cloud Function handler and also on initial invitation creation.

### Cloud Functions

All callable functions use the **Firestore Queue pattern** — client writes to `_functionQueue/{docId}`, `processQueue` Firestore `onCreate` trigger processes server-side, client reads response via `onSnapshot`. This bypasses the GCP org policy that blocks `allUsers` IAM on Cloud Functions. The `onRequest` exports are kept as dormant fallback.

| Function | Type | Purpose |
|----------|------|---------|
| `processQueue` | Firestore trigger (onCreate) | Dispatches `_functionQueue` docs to handler functions. Reads caller identity via `admin.auth().getUser(createdBy)`. |
| `setUserClaims` | Queue handler + onRequest fallback | Set role + clientId on Firebase Auth user. Catches `auth/user-not-found` and creates `pendingInvitations` doc instead. |
| `claimInvitation` | Queue handler + onRequest fallback | Auto-called on first sign-in when user has no claims. Queries `pendingInvitations` collection group, sets claims, writes user doc, marks invitation claimed. |
| `createShotShareLink` | Queue handler + onRequest fallback | Creates a denormalized `shotShares` doc for public sharing. |
| `deactivateUser` | Queue handler | Sets `status: "deactivated"` on user doc, revokes custom claims. Admin-only. |
| `reactivateUser` | Queue handler | Restores claims with chosen role, sets `status: "active"`. Admin-only. |
| `resendInvitationEmail` | Queue handler | Re-sends invitation email via Resend for pending invitations. Admin-only. |
| `publicUpdatePull` | Queue handler + onRequest fallback | Public warehouse fulfillment responses (anonymous, requires shareToken). |
| `sendRequestNotification` | Queue handler | Sends email notification via Resend to `notifyUserIds` recipients when a shot request is submitted. Cross-tenant clientId guard. Admin+producer only. Sprint S12A. |
| `resolvePullShareToken` | HTTP POST (direct) | Resolve public pull share token to pull data |
| `resolveShotShareToken` | HTTP POST (direct) | Resolve denormalized shot share doc |
| `cleanupVersionsAndLocks` | Scheduled (hourly) | Deletes expired versions, clears stale presence locks |

**Client helper:** `src-vnext/shared/lib/callFunction.ts` — writes queue doc, subscribes via `onSnapshot`, resolves/rejects on status change. 30s timeout. Same signature for all callers.

**Queue collection:** `_functionQueue/{docId}` — Firestore rules enforce `createdBy == request.auth.uid` for auth'd creates, anonymous creates only for `publicUpdatePull` with valid shareToken.

Region: `northamerica-northeast1`

---

## Design System

### Direction A: Near-Black Editorial

Visual direction finalized. Zinc neutral scale (not Slate), near-black primary, Immediate Red accent.

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#18181b` (zinc-900) | Primary buttons, strong text |
| Accent | `#E31E24` (Immediate Red) | Sidebar active indicator, logo mark, destructive states only |
| Sidebar | `#09090b` (zinc-950) | Dark sidebar background |
| Neutrals | Zinc 50-950 | All gray scale values |
| Typography | Inter 300-700 | Light (300) for page headings, semibold for sections |
| Tracking | `-0.02em` headings, `-0.01em` sub-headings | Editorial negative tracking |
| Shadows | Subtle (borders do separation) | Notion/Linear style |

### tokens.css

Single source of design truth. CSS custom properties for colors, spacing, typography, shadows, radius. Referenced by Tailwind config. Micro font sizes: `text-3xs` (9px), `text-2xs` (10px), `text-xxs` (11px). Editorial body scale (Sprint S4): `text-xs` (12px), `text-sm` (13px), `text-base` (14px), `text-lg` (16px), `text-xl` (18px) — all 1-2px smaller than Tailwind defaults.

**Status color tokens:** `--color-status-{color}-bg`, `--color-status-{color}-text`, `--color-status-{color}-border` for blue (info/submitted), green (success/absorbed), amber (warning/triaged), red (error/out-of-range), purple (AI Generated asset flag). Both light and dark theme variants defined. Added red tokens in Phase 9 for casting match out-of-range scores. Added purple tokens in Phase 10 for AI Generated flag state.

**Entry-type color tokens (Sprint S7):** `--color-entry-{type}-border`, `--color-entry-{type}-bg` for setup (amber), shooting (blue), hmu (violet), meal (emerald), travel (zinc), banner (neutral), shot (blue). Both light and dark variants. Used by `blockColors.ts` via CSS var references — components use inline `style` with these vars, not Tailwind color classes.

**Dark mode:** `.dark` class selector block overrides all color tokens (surfaces, text, borders, primary, status badges, table, shadows). Activation via Tailwind `darkMode: 'class'` strategy. ThemeProvider applies `.dark` on `<html>`. FOUC prevention script in `index.html` applies it pre-React. localStorage key: `sb:theme` (`light | dark | system`).

### design-tokens.js (Semantic Classes)

`src/styles/design-tokens.js` — Tailwind plugin providing semantic typography and spacing classes. **Phase 6 mandates their use over raw Tailwind classes.**

| Class | Spec | Usage |
|---|---|---|
| `.heading-page` | 24px / 300 / -0.02em / md:28px | Page-level `<h1>` (editorial light weight) |
| `.heading-section` | 16px / 600 / -0.01em | Section `<h2>` |
| `.heading-subsection` | 14px / 600 / -0.01em | Subsection `<h3>` |
| `.label-meta` | 12px / 600 / upper / 0.05em / text-subtle | Uppercase meta labels |
| `.body-text` | 13px / 400 | Standard body |
| `.body-text-muted` | 13px / 400 / secondary | De-emphasized body |
| `.caption` | 12px / 400 / secondary | Small secondary text |
| `.label` | 13px / 500 | Form labels |

Text color hierarchy: `--color-text` (primary) > `--color-text-secondary` (supporting) > `--color-text-muted` (metadata) > `--color-text-subtle` (placeholders/disabled).

Card standards: `rounded-lg` (8px), `p-4` content, `pb-2` header, `gap-4` grid. Badge font: `text-xxs` (11px) everywhere.

**Implementation note (Phase 6e):** `design-tokens.js` uses CSS custom properties (`var(--color-text)`, `var(--text-2xl)`) — not Tailwind `theme()` calls. This ensures dark mode token switching works at runtime.

### shadcn/ui

Generated primitives in `src/components/ui/` (legacy) and `src-vnext/ui/` (vNext). Components: AlertDialog, Avatar, Badge, Button, Card, Dialog, Dropdown, Label, Popover, Select, Separator, Sheet, Switch, Tabs, Toast, Tooltip. Customization via Tailwind config + tokens.css only -- never modify generated files inline.

### Custom UI Components

`LoadingSpinner`, `LoadingState` (skeleton prop + stuck overlay), `EmptyState`, `InlineEmpty` (dashed border sub-section empties), `Skeleton` (SkeletonLine, SkeletonBlock, ListPageSkeleton, TableSkeleton, DetailPageSkeleton, CardSkeleton), `PageHeader`, `PageToolbar`, `StatusBadge`, `TagBadge`, `ErrorBoundary`, `OfflineBanner`, `NetworkErrorBanner`, `ForbiddenPage` (403), `NotFoundPage` (404), `SearchCommand`, `NotificationBell`, `FilterPresetManager`, `ResponsiveDialog`, `FloatingActionBar`, `ActiveEditorsBar` (presence: expandable editor list), `CompactActiveEditors` (presence: avatar dots + ping), `InlineEdit` (click-to-edit inline field), `ConfirmDialog` (destructive action confirmation), `CommandPalette` (Cmd+K universal search — Fuse.js + cmdk, Sprint S14), `BulkSelectionBar` (floating action bar for multi-select workflows, Sprint S12C), `ViewModeToggle` (unified view toggle — Button variant=default/outline, Sprint S16), `SearchBar` (consistent search input with icon + clear button, Sprint S16), `ColumnSettingsPopover` (Saturation-style column config — eye icon visibility, drag reorder, Sprint S16), `ResizableHeader` (table `<th>` with drag-to-resize handle, Sprint S16)

### Interactive Table System (Sprint S16)

Composable hook-based table interactivity applied to all 5 tables (ProductFamilies, Locations, Talent, Shots, CallSheetCast). Architecture is hooks + components, not a monolithic DataTable wrapper.

| Module | Path | Purpose |
|---|---|---|
| `TableColumnConfig` | `shared/types/table.ts` | Column config type + `normalizeColumns()` for merging saved/defaults |
| `useTableColumns` | `shared/hooks/useTableColumns.ts` | Column state (visibility, order, widths) + localStorage persistence via `useSyncExternalStore` |
| `useColumnResize` | `shared/hooks/useColumnResize.ts` | Mouse-drag column resize with min/max clamping |
| `useTableKeyboardNav` | `shared/hooks/useTableKeyboardNav.ts` | Row-level arrow key navigation (guards interactive descendants) |
| `usePersistedViewMode` | `shared/hooks/usePersistedViewMode.ts` | Generic localStorage view mode persistence with cross-tab sync |
| `shotTableColumns.ts` | `features/shots/lib/` | Bridge adapter: `ShotsListFields` ↔ `TableColumnConfig` for ShotsTable (preserves selection + inline editing contracts) |

**Design system enforcement:** `docs/DESIGN_SYSTEM.md` codifies all shared component patterns, typography tokens, color tokens, table controls (Saturation benchmark), spacing standards. Referenced from CLAUDE.md Hard Rule #3 — mandatory read before any UI work.

### Premium Interaction Utilities (Sprint S15e)

CSS utility classes in `tokens.css` for consistent hover/press/animation feedback:
- `.hover-lift` — translateY(-2px) + shadow on card hover
- `.btn-press` — scale(0.97) active press on all Button variants (via cva base)
- `.hover-glow` — border glow on hover for interactive rows
- `.shimmer-bg` — gradient shimmer animation for skeleton loading
- `.stagger-children` — fade-in-rise with 50ms staggered delays
All respect `prefers-reduced-motion: reduce`.

### Library Entity Modules (Phase 7B)

| Module | Path | Purpose |
|---|---|---|
| `crewWrites.ts` | `features/library/lib/` | Create/update/delete crew members |
| `locationWrites.ts` | `features/library/lib/` | Create/update/delete locations + photo upload/removal |
| `talentWrites.ts` | `features/library/lib/` | Full talent CRUD: create, update, delete, headshot, portfolio, casting images |
| `measurementOptions.ts` | `features/library/lib/` | Gender-specific measurement field definitions (men: 7, women: 6, other: all) |
| `measurementParsing.ts` | `features/library/lib/` | Conservative parser for free-form measurement strings (`5'9"`, `34"`, `40R`, `175cm`) → numeric values. Type-guards non-string Firestore values (objects, booleans) before `.trim()`. |
| `castingScoreUtils.ts` | `features/library/lib/` | Shared score color utilities: `scoreColorClass(score)` and `scoreBarFillClass(score)` for consistent threshold styling (green ≥80%, amber ≥50%, muted <50%) |
| `talentFilters.ts` | `features/library/lib/` | TalentSearchFilters interface + filterTalent() pure function (gender, measurement ranges, agency, casting history) |
| `castingMatch.ts` | `features/library/lib/` | CastingBrief interface, computeMatchScore() proximity scoring, rankTalentForBrief() sorted results |
| `talentShotHistory.ts` | `features/library/lib/` | TalentShotHistoryEntry type definition for shot history reverse lookup |
| `useCrewLibrary.ts` | `features/library/hooks/` | Real-time Firestore subscription for crew list |
| `useLocationLibrary.ts` | `features/library/hooks/` | Real-time Firestore subscription for locations list |
| `useTalentLibrary.ts` | `features/library/hooks/` | Real-time Firestore subscription for talent list |
| `useTalentShotHistory.ts` | `features/library/hooks/` | Firestore `array-contains` query: all shots a talent appears in, grouped by project |
| `useMeasurementBounds.ts` | `features/library/hooks/` | Computes min/max bounds from actual talent measurement data for slider ranges. Stack-safe reduce (not Math.min/max spread). |
| `TalentSearchFilters.tsx` | `features/library/components/` | Responsive filter sheet (side on desktop, bottom on mobile) — gender, measurement ranges, agency, casting history |
| `TalentDetailPanel.tsx` | `features/library/components/` | Detail panel rendered inside Sheet — Profile/Shot History tabs, headshot (112px, click-to-enlarge lightbox), contact, measurements, notes (HTML-aware via SanitizedHtml), portfolio (~550 lines after S16g polish) |
| `CastingSessionList.tsx` | `features/library/components/` | Extracted from TalentDetailPanel — casting session expansion with DnD image grid and session field editors |
| `TalentDialogs.tsx` | `features/library/components/` | Extracted from LibraryTalentPage — 5 ConfirmDialogs + Dialog + TalentCastingPrintPortal |
| `CastingBriefPanel.tsx` | `features/library/components/` | Top-level collapsible casting brief panel with mode toggle button, score badges on grid cards, and embedded CastingBriefMatcher |
| `MeasurementRangeSlider.tsx` | `features/library/components/` | Dual-thumb Radix Slider for measurement range inputs with value labels |
| `talentUtils.ts` | `features/library/components/` | buildDisplayName, initials, normalizeImages, normalizeSessions, constants |
| `HeadshotThumb.tsx` | `features/library/components/` | Avatar thumbnail for talent grid cards |
| `SortableImageTile.tsx` | `features/library/components/` | Drag-and-drop image tile for portfolio/casting galleries |
| `TalentInlineEditors.tsx` | `features/library/components/` | InlineInput + InlineTextarea for talent field editing |
| `CreateTalentDialog.tsx` | `features/library/components/` | Dialog for creating new talent profiles |
| `CastingBriefMatcher.tsx` | `features/library/components/` | Brief form (dual-thumb range sliders) + ranked results with match score badges. Accepts optional `results` prop to avoid redundant computation. Uses shared castingScoreUtils. |
| `TalentShotHistory.tsx` | `features/library/components/` | Shot history grouped by project, status badges via getShotStatusColor() |
| `CreateCrewDialog.tsx` | `features/library/components/` | ResponsiveDialog for creating crew members |
| `CreateLocationDialog.tsx` | `features/library/components/` | ResponsiveDialog for creating locations |
| `CrewDetailPage.tsx` | `features/library/components/` | Detail/edit page for crew members (name, department, position, contact) |
| `LocationDetailPage.tsx` | `features/library/components/` | Detail/edit page with photo upload/removal and address fields |
| `EditScheduleDialog.tsx` | `features/schedules/components/` | Rename/re-date a schedule (ResponsiveDialog + wasOpen ref pattern) |
| `adminWrites.ts` | `features/admin/lib/` | Invite/update user roles, add/remove project members |
| `roleDescriptions.ts` | `shared/lib/` | Static `ROLE_DESCRIPTIONS` Record<Role, string> for UI |
| `useUsers.ts` | `features/admin/hooks/` | Real-time Firestore subscription for user roster |
| `useProjectMembers.ts` | `features/admin/hooks/` | Real-time Firestore subscription for project member list |
| `AdminPage.tsx` | `features/admin/components/` | Tabbed layout: Team roster + Project Access |
| `ProjectAccessTab.tsx` | `features/admin/components/` | Project selector, member table, remove dialog, self-removal guard |
| `AddProjectMemberDialog.tsx` | `features/admin/components/` | Add existing user to project with role selection |
| `InviteUserDialog.tsx` | `features/admin/components/` | ResponsiveDialog for inviting/updating users + copy-link |
| `UserRoleSelect.tsx` | `features/admin/components/` | Inline role dropdown with immediate save |
| `TeamRosterTab.tsx` | `features/admin/components/` | Orchestrator: merges users + pending invitations, applies search/filter, renders unified table |
| `TeamSearchFilterBar.tsx` | `features/admin/components/` | Debounced search (250ms) + role filter + status filter (All/Active/Pending/Deactivated) |
| `TeamUserRow.tsx` | `features/admin/components/` | Enhanced user row with StatusBadge, role dropdown, expand chevron, detail panel |
| `UserDetailPanel.tsx` | `features/admin/components/` | Expandable detail: inline name editing, deactivate/reactivate with AlertDialog, project assignment picker, resend invitation |
| `PendingInvitationRow.tsx` | `features/admin/components/` | Pending invitation display with relative timestamp, resend button, revoke button |
| `ProjectAssignmentPicker.tsx` | `features/admin/components/` | Multi-select project picker for bulk assignment during invite/edit |
| `PendingAccessPage.tsx` | `shared/components/` | Standalone page for users awaiting admin role assignment |

### Mobile & Tablet Components (Phase 5)

| Component | Location | Purpose |
|---|---|---|
| `ResponsiveDialog` | `shared/components/` | Renders Sheet (side="bottom") on mobile, Dialog on desktop. Used by all 4 create/edit dialogs. |
| `FloatingActionBar` | `shared/components/` | Route-aware FAB on mobile/tablet. Hides on scroll down. Uses URL params (`replace: true`) to communicate with pages. |
| `ShotStatusTapRow` | `features/shots/components/` | 4 horizontal pill buttons for 1-tap status change on mobile (replaces ShotStatusSelect dropdown). |
| `WarehousePickGuidePage` | `features/pulls/components/` | Full-screen guided pick stepper for one-handed warehouse operation. |
| `WarehousePickStep` | `features/pulls/components/` | Single item card in guided pick flow (image, name, colorway, sizes, location). |
| `WarehousePickProgress` | `features/pulls/components/` | Progress bar + "Item X of Y" for guided pick flow. |
| `WarehousePickOutcomeBar` | `features/pulls/components/` | Three 64px action buttons: Picked (green), Not Available (red), Substitute (amber). |

### Three-Panel Shot Editor Components

| Component / Hook | Location | Purpose |
|---|---|---|
| `ThreePanelListPanel` | `features/shots/components/` | Left panel — shot list with 3-tier density (compact/medium/full via ResizeObserver) |
| `ThreePanelCanvasPanel` | `features/shots/components/` | Center panel — shot detail with card-wrapped sections |
| `NotesSection` | `features/shots/components/` | Read/edit toggle notes (click-to-edit, blur-to-save) |
| `ActiveLookCoverReferencesPanel` | `features/shots/components/` | Reference tiles with hover-reveal action bar |
| `useListDisplayPreferences` | `features/shots/hooks/` | localStorage-backed display preferences (`sb:three-panel:list-prefs`) |

### Product PLM Components (Phase 10)

| Component / Hook | Location | Purpose |
|---|---|---|
| `AssetRequirementChip` | `features/products/components/` | Chip badge with popover flag selector (5 states incl. AI Generated purple) |
| `AddRequirementPopover` | `features/products/components/` | Grouped asset type picker (photography/motion/other) + Other label input |
| `SkuRequirementsRow` | `features/products/components/` | Per-colorway chip + launch date layout |
| `EditableProductImage` | `features/products/components/` | Image with hover overlay (Replace/Remove actions) for hero + colorway images |
| `InlineDateField` | `features/products/components/` | Reusable inline date picker for launch dates |
| `ProductRequirementsSection` | `features/products/components/` | Chip view (default) + table view toggle for per-colorway asset requirements |
| `ProductFilesSection` | `features/products/components/` | Documents only (renamed from Assets; identity images moved to Colorways) |
| `ShootReadinessWidget` | `features/dashboard/components/` | Dashboard widget: 3-tier display, expandable constraint cards, confidence badges, progress bars |
| `useShootReadiness` | `features/products/hooks/` | 3-tier eligibility hook reading denormalized family fields |
| `assetRequirements.ts` | `features/products/lib/` | ASSET_TYPES (with groups), LEGACY_ASSET_TYPES, ASSET_FLAG_OPTIONS, resolveSkuLaunchDate, resolveEarliestLaunchDate |
| `shootReadiness.ts` | `features/products/lib/` | ShootWindow interface, computeSuggestedShootWindow (3-tier), sortByUrgency |

### Schedule & Call Sheet Components (Sprint S7)

| Component / Hook / Lib | Location | Purpose |
|---|---|---|
| `overlapGroups.ts` | `features/schedules/lib/` | Sweep-line per-track overlap detection algorithm. Groups timed non-banner entries by time overlap. Clamps endMin to 1439 for midnight-spanning entries. 12 TDD tests. |
| `blockColors.ts` | `features/schedules/lib/` | Maps entry type/banner label to CSS var references. Returns `BlockColorVars { borderColorVar, bgColorVar }`. Setup=amber, shooting=blue, HMU=violet, meal=emerald, travel=zinc. |
| `useOverlapGroups.ts` | `features/schedules/hooks/` | Memoized wrapper around `buildOverlapGroups()` |
| `useNowMinute.ts` | `shared/hooks/` | System clock hook returning current minute of day (0-1439). Updates every 60s. CANONICAL source — no duplicates. |
| `CallSheetBuilderPage.tsx` | `features/schedules/components/` | Top-level route page for schedule builder + call sheet output (desktop-only) |
| `ScheduleListPage.tsx` | `features/schedules/components/` | Schedule list with create/edit/delete |
| `ScheduleCard.tsx` | `features/schedules/components/` | Schedule card with dropdown actions |
| `ScheduleEntriesBoard.tsx` | `features/schedules/components/` | Entry board within schedule builder |
| `ScheduleEntryCard.tsx` | `features/schedules/components/` | Individual schedule entry card |
| `ScheduleEntryEditor.tsx` | `features/schedules/components/` | Entry editor form |
| `ScheduleEntryEditSheet.tsx` | `features/schedules/components/` | Sheet-based entry editor |
| `ScheduleTrackControls.tsx` | `features/schedules/components/` | Track management controls |
| `CreateScheduleDialog.tsx` | `features/schedules/components/` | Dialog for creating new schedules |
| `EditScheduleDialog.tsx` | `features/schedules/components/` | Rename/re-date a schedule (ResponsiveDialog + wasOpen ref pattern) |
| `AddShotToScheduleDialog.tsx` | `features/schedules/components/` | Link shot to schedule entry |
| `AddCustomEntryDialog.tsx` | `features/schedules/components/` | Add non-shot entry (setup, meal, travel, etc.) |
| `DayDetailsEditor.tsx` | `features/schedules/components/` | Day-level details (weather, notes, key contacts) |
| `CallOverridesEditor.tsx` | `features/schedules/components/` | Talent/crew call time overrides |
| `AdvancedScheduleBlockSection.tsx` | `features/schedules/components/` | Advanced block settings section |
| `TrustChecks.tsx` | `features/schedules/components/` | Schedule validation trust checks |
| `TypedTimeInput.tsx` | `features/schedules/components/` | Time input with format enforcement |
| `TimelineGridView.tsx` | `features/schedules/components/` | Grid orchestrator: TimelineGutter + track columns + NowIndicator + OverlapGroups. min-w-[600px], empty-state guard. |
| `TimelineGutter.tsx` | `features/schedules/components/` | 60px time label column, 15-min tick marks |
| `TimelineNowIndicator.tsx` | `features/schedules/components/` | NOW label + pulsing dot + 1px red line across track columns |
| `TimelineBlockCard.tsx` | `features/schedules/components/` | Single schedule block card. COMPACT_HEIGHT=64px. Uses getBlockColors() CSS vars. |
| `TimelineBlockGroup.tsx` | `features/schedules/components/` | Renders overlap groups: isolated=full-width 64px, overlapping=side-by-side sub-columns |
| `TimelinePropertiesDrawer.tsx` | `features/schedules/components/` | Persistent 320px right-side panel for block details (NOT a Sheet/dialog) |
| `AdaptiveTimelineView.tsx` | `features/schedules/components/` | Adaptive timeline visualization |
| `AdaptiveTimelineHeader.tsx` | `features/schedules/components/` | Adaptive timeline header bar |
| `AdaptiveEntryCard.tsx` | `features/schedules/components/` | Density-adaptive entry card |
| `AdaptiveDenseBlock.tsx` | `features/schedules/components/` | Dense block for compact timeline |
| `AdaptiveBannerSegment.tsx` | `features/schedules/components/` | Banner segment in adaptive timeline |
| `AdaptiveGapSegment.tsx` | `features/schedules/components/` | Gap segment in adaptive timeline |
| `AdaptiveUnscheduledTray.tsx` | `features/schedules/components/` | Tray for unscheduled entries |
| `CallSheetRenderer.tsx` | `features/schedules/components/` | Call sheet output renderer (HTML for print) |
| `CallSheetOutputControls.tsx` | `features/schedules/components/` | Controls for call sheet output (print, share) |
| `CallSheetPrintPortal.tsx` | `features/schedules/components/` | Print portal for call sheet output |
| `CallSheetPageHeader.tsx` | `features/schedules/components/` | 3-zone modular grid header for call sheet output |
| `CallSheetCastTable.tsx` | `features/schedules/components/` | Talent table with editorial section label |
| `CallSheetDeptGrid.tsx` | `features/schedules/components/` | Crew by department with dark headers, break-inside-avoid for print |
| `CallSheetKeyTimesStrip.tsx` | `features/schedules/components/` | Horizontal key times band |
| `OnSetViewer.tsx` | `features/schedules/components/` | Mobile on-set viewer shell with 4-tab navigation (useSearchParams) |
| `OnSetNowBanner.tsx` | `features/schedules/components/` | Sticky LIVE status bar with green pulse dot |
| `OnSetScheduleTab.tsx` | `features/schedules/components/` | Today's schedule with time gutter, status badges, progress bars |
| `OnSetCrewTab.tsx` | `features/schedules/components/` | Department-grouped crew directory with collapsible sections (grid-template-rows) |
| `OnSetLocationTab.tsx` | `features/schedules/components/` | Address display + directions (Apple Maps on iOS, Google Maps elsewhere) |
| `OnSetNotesTab.tsx` | `features/schedules/components/` | Free text notes display |
| `OnSetFloatingBar.tsx` | `features/schedules/components/` | Frosted glass floating action bar (Add Note + Flag Issue) |

---

## Performance Budgets

| Metric | Budget |
|--------|--------|
| LCP (Largest Contentful Paint) | <2.5s on 4G mobile |
| FID (First Input Delay) | <100ms |
| CLS (Cumulative Layout Shift) | <0.1 |
| JS Bundle (initial) | <150 KB gzipped |
| Route chunk | <50 KB gzipped each |
| Firestore reads per page load | <5 queries |
| Time to Interactive | <3.5s on 4G mobile |

### Performance Rules

- Route-level code splitting: every route uses `React.lazy()`
- LoginPage and ProjectsPage statically imported (Safari OAuth compatibility)
- Minimize Firestore fan-out: prefer filtered queries over multiple `getDoc()`
- Image optimization: WebP via Firebase Storage + CDN, client-side compression before upload
- No blocking waterfall: auth init doesn't block shell rendering

---

## Responsive Breakpoints

| Viewport | Range | Hook | Behavior |
|----------|-------|------|----------|
| Phone | <768px | `useIsMobile()` | Mobile top bar + hamburger drawer (w-72) |
| Tablet | 768-1023px | `useIsTablet()` | Mobile top bar + wider drawer (w-80), surface badges |
| Desktop | >=1024px | `useIsDesktop()` | Fixed sidebar (220px expanded / 64px collapsed) |

Hooks defined in `src-vnext/shared/hooks/useMediaQuery.ts`. `isDesktop` controls both sidebar visibility and main content margin. Desktop-only routes (Tags, Call Sheet) use `RequireDesktop` guard that redirects to dashboard with toast.

Tablet is a first-class viewport, not an afterthought. iPad on-set usage is a primary use case.

### Mobile Patterns (Phase 5)

- **Touch targets:** `@media (pointer: coarse) { .touch-target { min-height: 44px; min-width: 44px; } }` in `tokens.css`. Apply to all interactive elements on touch devices.
- **ResponsiveDialog:** Unified API — renders Sheet (bottom) on mobile, Dialog on desktop. All creation/edit dialogs use this.
- **FAB communication:** FloatingActionBar sets URL params (`?create=1`, `?status_picker=1`, `?focus=notes`) with `replace: true`. Target pages read + consume params via `useSearchParams`.
- **Hide-not-disable on mobile:** When `canEdit = !isMobile && canManageX(role)` already gates write form visibility, do not add redundant `disabled={... || isMobile}`. Hide write forms entirely instead of showing disabled controls.
- **ShotStatusTapRow:** On mobile, status changes use 4 horizontal pill buttons instead of dropdown Select. Optimistic update with rollback on error.

---

## Security Model

### Firestore Rules

- All collections enforce `clientMatches(clientId)` via auth custom claims
- Public sharing: pulls via collection group query on `shareToken`, shots via denormalized `/shotShares/{shareToken}` docs
- Comments are immutable except author edits (soft-delete support)
- Versions are append-only
- Activities are append-only with 90-day retention

### Threat Model Checklist

Before shipping any feature:
1. Can a user access data outside their `clientId`?
2. Can a user escalate their role via client-side manipulation?
3. Can a user modify data they should only read?
4. Can untrusted input be rendered as HTML/JS?
5. Can a public share link leak private data?
6. Can a race condition cause duplicate writes?

---

## Testing Strategy

| Layer | Tool | Target |
|-------|------|--------|
| Unit | Vitest | 80%+ coverage for lib modules |
| Component | Vitest + Testing Library | Render + key interaction tests |
| E2E | Playwright | Critical flows (post-stabilization) |
| Lint | ESLint | Zero warnings (`--max-warnings=0`) |
| Type check | `npx tsc --noEmit` | No type errors |

**Note:** `npm test` runs through `scripts/run-vitest.cjs` which forces `--pool threads --singleThread` to avoid concurrency issues on macOS paths with spaces.

Mock Firestore in tests. Never hit real Firestore. Auth context mocking via `src/test-utils/`.

---

## Deployment

- **Hosting:** Firebase Hosting. Public dir: `dist/`. SPA rewrites to `index.html`.
- **Security headers:** DENY framing, CSP, X-XSS, referrer-policy. No-store for HTML, 1-year immutable for assets.
- **Emulators:** Auth (9099), Firestore (8080), Functions (5001), Storage (9199), UI (4000). Toggle via `VITE_USE_FIREBASE_EMULATORS`.
