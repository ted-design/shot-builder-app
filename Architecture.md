# Architecture -- Shot Builder

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
| Server State | TanStack Query + Firestore onSnapshot | Hybrid approach (see State Management) |
| Client State | React Context + useState | 4 minimal context providers |
| Backend | Firebase (Auth, Firestore, Storage, Functions) | Multi-tenant, clientId-scoped |
| Routing | React Router v6 | Lazy-loaded routes via React.lazy |
| Rich Text | tiptap (via reactjs-tiptap-editor) | Shot notes, product descriptions |
| Search | Fuse.js (client-side) + cmdk (command palette) | Cmd+K global search |
| Drag & Drop | @dnd-kit | Planner, sortable lists |
| Error Tracking | Sentry (@sentry/react) | Error boundaries + breadcrumbs |
| PDF | @react-pdf/renderer | Pull sheet export |
| Testing | Vitest + Testing Library + Playwright | See Testing section |

### Dependency Notes

- **TanStack Query:** Wraps entire app via `QueryClientProvider` at root. staleTime: 5min, gcTime: 10min, retry: 1. **Policy:** Keep where used; do not introduce to new code. Prefer direct Firestore onSnapshot for new features.
- **tiptap:** Heavy dependency used in shot notes and product descriptions. Keep where used; evaluate before adding to new surfaces.
- **react-select:** Used in pickers/dropdowns. Prefer Radix Select for new pickers.
- **react-easy-crop:** Image cropping. Keep where used.

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
├── pages/                 # Route-level page components (38+)
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
| `/login` | LoginPage | Google sign-in. Statically imported (Safari OAuth). |
| `/pulls/shared/:shareToken` | PullPublicViewPage | Public pull sheet (read-only) |
| `/pulls/shared/:shareToken/guide` | WarehousePickGuidePage | Guided pick flow (full-screen stepper) |
| `/demo/*` | DemoPage | Demo mode (blocks writes) |

### Authenticated Routes

| Route | Page | Notes |
|-------|------|-------|
| `/` | Redirect -> `/projects` | |
| `/projects` | ProjectsPage | Statically imported (post-OAuth landing) |
| `/projects/:id` | Redirect -> `dashboard` | |
| `/projects/:id/dashboard` | ProjectDashboardPage | Readiness overview |
| `/projects/:id/shots` | ShotsPage | Shot list + planner view toggle |
| `/projects/:id/shots/:sid` | ShotEditorPageV3 | V3 canvas editor (default) |
| `/projects/:id/catalogue` | CataloguePage | People + locations |
| `/projects/:id/catalogue/people` | CataloguePeoplePage | Talent + crew |
| `/projects/:id/catalogue/locations` | CatalogueLocationsPage | |
| `/projects/:id/assets` | ProjectAssetsPage | |
| `/projects/:id/callsheet` | CallSheetPage | Desktop-only |
| `/projects/:id/departments` | ProjectDepartmentsPage | |
| `/projects/:id/settings` | ProjectSettingsPage | |
| `/products` | ProductsPage | Org-level product library |
| `/products/:productId` | ProductDetailPageV3 | Default (flags control V2/V3) |
| `/import-products` | ImportProducts | CSV import |
| `/library` | LibraryPage | Redirect -> `/library/talent` |
| `/library/talent` | LibraryTalentPage | Full CRUD: card grid, inline detail, measurements, portfolio, castings |
| `/library/crew` | LibraryCrewPage | Table list with search, create dialog, row click to detail |
| `/library/crew/:crewId` | CrewDetailPage | Inline edit all fields, notes, delete with confirmation |
| `/library/locations` | LibraryLocationsPage | Table list with search, create dialog, row click to detail |
| `/library/locations/:locationId` | LocationDetailPage | Photo upload, address sub-fields, inline edit, delete |
| `/library/departments` | DepartmentsPage | |
| `/library/tags` | TagManagementPage | |
| `/library/palette` | PalettePage | Color swatches |
| `/pulls` | PullsPage | Org-level pulls list |
| `/pulls/:pullId/edit` | PullEditorPage | |
| `/account` | AccountSettingsPage | |
| `/admin` | AdminPage | Role-gated: admin only |

### Legacy Redirects

| Old Route | Redirects To |
|-----------|-------------|
| `/shots` | `/projects/:currentProjectId/shots` |
| `/planner` | `/projects/:currentProjectId/shots?view=planner` |
| `/projects/:id/planner` | `../shots?view=planner` |
| `/projects/:id/schedule` | `../callsheet` |
| `/talent` | `/library/talent` |
| `/locations` | `/library/locations` |
| `/palette` | `/library/palette` |
| `/tags` | `/library/tags` |
| `/library/profiles` | `/library/talent` |

### Dev-Only Routes (import.meta.env.DEV)

`/dev/richtext`, `/dev/image-diagnostics`, `/dev/brand-lockup-test`, `/dev/page-header-test`

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
  └── notifications/{notificationId}/

/shotShares/{shareToken}               # Denormalized public share docs
/systemAdmins/{email}                  # System admin list
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

### Path Builders

All Firestore paths built via `src-vnext/shared/lib/paths.ts`. Every function requires explicit `clientId` -- no hardcoded defaults. Returns string arrays for `collection()` / `doc()`.

Key path builders: `projectsPath`, `shotsPath`, `productFamiliesPath`, `talentPath`, `locationsPath`, `crewPath`, `crewDocPath`, `locationDocPath`, `departmentsPath`, `departmentPositionsPath`.

---

## State Management

### Hybrid Approach

1. **TanStack Query** -- Wraps app root. Data fetching with caching, loading/error states. Config: staleTime 5min, gcTime 10min, retry 1, refetchOnWindowFocus false.
2. **Firestore onSnapshot** -- Direct real-time subscriptions for entities needing live updates (shot list, pull fulfillment). Custom hooks: `useFirestoreDoc`, `useFirestoreCollection`.
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
| `shotEditorV3` | ON | V3 shot editor (canvas layout) -- now the default |
| `productsV3` | OFF | V3 product detail page |
| `productsV2` | OFF | V2 product detail page (superseded by V3) |
| `pullsEditorV2` | OFF | V2 pulls editor |
| `callSheetBuilder` | OFF | Call sheet builder surface |
| `pdfExport` | OFF | PDF export modal |
| `demoMode` | OFF | Demo mode (blocks writes, optimistic UI only) |
| `productSearch` | OFF | Product search feature |
| `newNavbar` | OFF | New navbar design |
| `calendarPlanner` | OFF | Calendar planner view |

**Cleanup plan:** Flags defaulting to ON (`newAuthContext`, `projectScoping`, `projectScopedAssets`, `shotEditorV3`) should have their off-path code removed. Flags defaulting to OFF with V2/V3 suffixes should be consolidated when the older version is deprecated.

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

- **Project-scoped roles:** `resolveEffectiveRole()` combines global role + per-project role override
- **Cloud Function:** `setUserClaims` (admin-only, sets role + clientId on user)

### Cloud Functions

| Function | Type | Purpose |
|----------|------|---------|
| `setUserClaims` | Callable | Set role + clientId on Firebase Auth user |
| `resolvePullShareToken` | HTTP POST | Resolve public pull share token to pull data |
| `resolveShotShareToken` | HTTP POST | Resolve denormalized shot share doc |

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

Single source of design truth. CSS custom properties for colors, spacing, typography, shadows, radius. Referenced by Tailwind config. Micro font sizes: `text-3xs` (9px), `text-2xs` (10px), `text-xxs` (11px).

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

Generated primitives in `src/components/ui/` (legacy) and `src-vnext/ui/` (vNext). Components: Avatar, Badge, Button, Card, Dialog, Dropdown, Label, Popover, Select, Separator, Sheet, Switch, Tabs, Toast, Tooltip. Customization via Tailwind config + tokens.css only -- never modify generated files inline.

### Custom UI Components

`LoadingSpinner`, `LoadingState` (skeleton prop + stuck overlay), `EmptyState`, `InlineEmpty` (dashed border sub-section empties), `Skeleton` (SkeletonLine, SkeletonBlock, ListPageSkeleton, TableSkeleton, DetailPageSkeleton, CardSkeleton), `PageHeader`, `PageToolbar`, `StatusBadge`, `TagBadge`, `ErrorBoundary`, `OfflineBanner`, `NetworkErrorBanner`, `ForbiddenPage` (403), `NotFoundPage` (404), `SearchCommand`, `NotificationBell`, `FilterPresetManager`, `ResponsiveDialog`, `FloatingActionBar`, `ActiveEditorsBar` (presence: expandable editor list), `CompactActiveEditors` (presence: avatar dots + ping), `InlineEdit` (click-to-edit inline field), `ConfirmDialog` (destructive action confirmation)

### Library Entity Modules (Phase 7B)

| Module | Path | Purpose |
|---|---|---|
| `crewWrites.ts` | `features/library/lib/` | Create/update/delete crew members |
| `locationWrites.ts` | `features/library/lib/` | Create/update/delete locations + photo upload |
| `talentWrites.ts` | `features/library/lib/` | Full talent CRUD: create, update, delete, headshot, portfolio, casting images |
| `measurementOptions.ts` | `features/library/lib/` | Gender-specific measurement field definitions (men: 7, women: 6, other: all) |
| `useCrewLibrary.ts` | `features/library/hooks/` | Real-time Firestore subscription for crew list |
| `useLocationLibrary.ts` | `features/library/hooks/` | Real-time Firestore subscription for locations list |
| `useTalentLibrary.ts` | `features/library/hooks/` | Real-time Firestore subscription for talent list |
| `CreateCrewDialog.tsx` | `features/library/components/` | ResponsiveDialog for creating crew members |
| `CreateLocationDialog.tsx` | `features/library/components/` | ResponsiveDialog for creating locations |
| `CrewDetailPage.tsx` | `features/library/components/` | Detail/edit page for crew members |
| `LocationDetailPage.tsx` | `features/library/components/` | Detail/edit page with photo upload and address fields |

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
