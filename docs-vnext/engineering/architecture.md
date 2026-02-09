# Architecture — Shot Builder vNext

> Draft v1 — 2026-01-30

## Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| **Framework** | React 18+ (SPA) | Same as current. No SSR requirement. |
| **Build** | Vite | Same as current. |
| **Styling** | Tailwind CSS + tokens.css | `tokens.css` is the single source of design truth. |
| **Component Primitives** | shadcn/ui (Radix) | Replace custom `src/components/ui/` with shadcn primitives. Customized via Tailwind + tokens. |
| **State** | React Context + Firestore real-time | No Redux. Server state via Firestore subscriptions. Local state via React. |
| **Backend** | Firebase (Auth, Firestore, Storage, Functions) | Unchanged. No re-architecture. |
| **Testing** | Vitest + Testing Library | Same as current. Add Playwright for critical flows. |
| **Error Tracking** | Sentry | Same as current. |
| **Routing** | React Router v6 | Same as current. |

## Module Boundaries

```
src/
├── app/                        # App shell, providers, router
│   ├── App.tsx
│   ├── providers/              # Auth, Theme, Scope, Search providers
│   └── routes/                 # Route definitions + guards
│
├── features/                   # Feature modules (domain-driven)
│   ├── projects/               # Project dashboard, creation, readiness
│   │   ├── components/
│   │   ├── hooks/
│   │   └── lib/
│   ├── shots/                  # Shot list, detail, inline editing
│   │   ├── components/
│   │   ├── hooks/
│   │   └── lib/
│   ├── pulls/                  # Pull sheets, fulfillment, sharing
│   │   ├── components/
│   │   ├── hooks/
│   │   └── lib/
│   ├── products/               # Product library, families, SKUs
│   │   ├── components/
│   │   ├── hooks/
│   │   └── lib/
│   ├── library/                # Talent, Locations, Crew
│   │   ├── components/
│   │   ├── hooks/
│   │   └── lib/
│   └── auth/                   # Login, auth state, claims
│       ├── components/
│       ├── hooks/
│       └── lib/
│
├── shared/                     # Shared utilities (no domain logic)
│   ├── components/             # Layout shells, nav, common UI wrappers
│   ├── hooks/                  # useMediaQuery, useDebounce, etc.
│   ├── lib/                    # Firebase init, paths, rbac, utils
│   └── types/                  # Shared TypeScript types
│
└── ui/                         # shadcn/ui components (generated)
    ├── button.tsx
    ├── card.tsx
    ├── dialog.tsx
    └── ...
```

### Module Rules

1. **Features are self-contained.** A feature module owns its components, hooks, and lib. Cross-feature imports go through `shared/`.
2. **No circular dependencies.** Features never import from other features directly. If two features need shared logic, extract to `shared/`.
3. **`ui/` is the primitive layer.** shadcn/ui components are never modified inline. Customization happens via Tailwind config and tokens.css.
4. **`shared/lib/` owns Firebase.** All Firestore path builders, Firebase init, RBAC helpers, and utility functions live here. Features import from `shared/lib/`.

---

## Data Contracts (Firestore)

vNext primarily reuses the existing Firestore collections and document shapes (no migration).

**Exception (explicitly approved):** Some slices may introduce **new collections or subcollections** (schema extensions) under existing client scope (e.g., `productFamilies/{fid}/...`, `productClassifications`). These must ship with:
- Updated Firestore + Storage rules
- A documented contract in `docs-vnext/slices/`
- Proof + verification logs in `docs-vnext/_proof/`

### Collection Reference

| Collection Path | Owner Feature | Read Pattern | Write Pattern |
|-----------------|---------------|--------------|---------------|
| `clients/{cid}/projects/{pid}` | projects | Real-time subscription | Create/Update |
| `clients/{cid}/projects/{pid}/members/{uid}` | projects | On-demand read | Admin writes |
| `clients/{cid}/shots/{sid}` | shots | Real-time (filtered by projectId) | Create/Update/Soft-delete |
| `clients/{cid}/shots/{sid}/comments/{cmid}` | shots | Real-time | Create |
| `clients/{cid}/projects/{pid}/pulls/{plid}` | pulls | Real-time | Create/Update |
| `clients/{cid}/projects/{pid}/lanes/{lid}` | shots (planner) | Real-time | Create/Update/Delete |
| `clients/{cid}/productFamilies/{fid}` | products | Real-time | Create/Update |
| `clients/{cid}/productClassifications/{clid}` | products | Real-time | Create/Update/Delete |
| `clients/{cid}/productFamilies/{fid}/skus/{skid}` | products | Real-time (nested) | Create/Update |
| `clients/{cid}/productFamilies/{fid}/samples/{sid}` | products | Real-time (nested) | Create/Update/Delete |
| `clients/{cid}/productFamilies/{fid}/documents/{did}` | products | Real-time (nested) | Create/Update/Delete |
| `clients/{cid}/productFamilies/{fid}/comments/{cid}` | products | Real-time (nested) | Create/Update/Delete |
| `clients/{cid}/talent/{tid}` | library | Real-time | Create/Update |
| `clients/{cid}/locations/{lid}` | library | Real-time | Create/Update |
| `clients/{cid}/crew/{crid}` | library | Real-time | Create/Update |
| `clients/{cid}/colorSwatches/{swid}` | library | Real-time | Create/Update/Delete |
| `clients/{cid}/notifications/{nid}` | shared | Real-time (filtered by userId) | Create (Cloud Function) |
| `clients/{cid}/activities/{pid}/{aid}` | shared | Paginated query | Create (append-only) |

### Key Document Shapes (Preserved)

These types are carried forward from `src/types/models.ts`. vNext will re-export them with stricter TypeScript (no `any`).

**Shot:**
```typescript
interface Shot {
  id: string;
  title: string;
  description?: string;
  projectId: string;
  clientId: string;
  status: 'draft' | 'planned' | 'in-progress' | 'shot' | 'needs-reshoot' | 'approved';
  talent: string[];           // talentId references
  products: ProductAssignment[];
  locationId?: string;
  laneId?: string;
  sortOrder: number;
  notes?: string;
  heroImage?: { path: string; downloadURL: string };
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}
```

**Pull / PullItem:**
```typescript
interface Pull {
  id: string;
  projectId: string;
  clientId: string;
  shotIds: string[];
  items: PullItem[];
  status: 'draft' | 'pending' | 'in-progress' | 'fulfilled' | 'complete';
  shareToken?: string;
  shareEnabled: boolean;
  exportSettings?: object;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface PullItem {
  familyId: string;
  colourId?: string;
  sizes: { size: string; quantity: number; fulfilled: boolean }[];
  fulfillmentStatus: 'pending' | 'picked' | 'not-available' | 'substituted';
  notes?: string;
  changeOrders: ChangeOrder[];
}
```

**Project:**
```typescript
interface Project {
  id: string;
  name: string;
  clientId: string;
  status: 'active' | 'completed' | 'archived';
  /** Legacy contract: date-only strings (YYYY-MM-DD). */
  shootDates: string[];
  notes?: string;
  briefUrl?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Status Mapping Clarification (Slice 1)

Firestore stores legacy enum values that differ from the type definitions above:

- **Shots:** `todo`, `in_progress`, `complete`, `on_hold` (not `draft`, `planned`, `in-progress`, `shot`, `needs-reshoot`, `approved`)
- **Pulls:** `draft`, `in-progress`, `fulfilled` (not `pending`, `complete`)
- **Pull items:** `pending`, `fulfilled`, `partial`, `substituted` (not `picked`, `not-available`)

The `statusMappings` module in `shared/lib/statusMappings.ts` bridges these legacy Firestore values to vNext UI semantics. The type definitions above represent the target semantic model; the mapping layer bridges the gap without requiring schema changes.

**Slice 1 exclusions:** "Approved" and "Needs Reshoot" shot statuses have no legacy backing value and are excluded. Readiness indicators require a Cloud Function to denormalize aggregates onto the project document and are deferred to a follow-up slice.

---

## State Strategy

### Rules

1. **Server state = Firestore subscriptions.** All entity data (shots, pulls, products, etc.) is managed via `onSnapshot` subscriptions. No local cache layer beyond Firestore's built-in offline persistence.
2. **Subscription lifecycle.** List views must aggressively unsubscribe on unmount to avoid fan-out. Every `onSnapshot` must be cleaned up in the hook's teardown. Detail views may use scoped subscriptions (single-document listeners) that live for the duration of the detail page.
3. **UI state = React state / context.** Sidebar open/closed, selected filters, modal visibility, form drafts — all React `useState` or lightweight context.
4. **No global store.** No Redux, Zustand, or similar. Firestore IS the store. React context is for auth, theme, scope, and search command state only.
5. **Optimistic updates — constrained.** Optimistic updates are allowed only for idempotent state transitions (e.g., shot status toggles, fulfillment status changes). On failure, revert and show error toast. **Never optimistic-create entities** — all entity creation must await the Firestore write confirmation before reflecting in the UI. This is a hard rule; no exceptions.
6. **No duplicate state.** Never cache Firestore data in React state and then try to keep them in sync. Subscribe and render.
7. **Readiness indicators are denormalized aggregates.** Project readiness (e.g., shots planned, products assigned, pulls fulfilled) must be stored as precomputed summary fields on the parent document (e.g., the project document), updated atomically during writes. Do not compute readiness by fan-out client-side queries across child collections.

### Context Providers (Minimal Set)

| Provider | Data | Consumers |
|----------|------|-----------|
| `AuthProvider` | User, claims, clientId, role | Everything |
| `ProjectScopeProvider` | Active projectId, project metadata | Project-scoped features |
| `ThemeProvider` | Dark/light mode | UI layer |
| `SearchCommandProvider` | Command palette state | Global (provider scaffolded in app shell; palette UI deferred to slice 7) |

---

## Performance Budgets (Mobile)

| Metric | Budget | Measurement |
|--------|--------|-------------|
| **LCP** (Largest Contentful Paint) | < 2.5s on 4G | Lighthouse mobile |
| **FID** (First Input Delay) | < 100ms | Web Vitals |
| **CLS** (Cumulative Layout Shift) | < 0.1 | Web Vitals |
| **JS Bundle (initial)** | < 150 KB gzipped | Vite build output |
| **Route chunk** | < 50 KB gzipped per lazy route | Vite build output |
| **Firestore reads per page load** | < 5 queries | Firebase console |
| **Time to Interactive** | < 3.5s on 4G | Lighthouse mobile |

### Performance Rules

1. **Route-level code splitting.** Every route is `React.lazy()`. No eagerly loaded page components.
2. **Minimize Firestore fan-out.** Prefer one query with a filter over multiple `getDoc()` calls.
3. **Image optimization.** Serve WebP via Firebase Storage + CDN. Client-side compression before upload (existing pattern).
4. **No blocking waterfall.** Auth initialization must not block shell rendering. Show skeleton immediately, hydrate when auth resolves.
5. **Preload adjacent routes.** On desktop, prefetch the next likely route (e.g., when hovering a project card, prefetch that project's shots query).

---

## Security Checklist

### Authentication

- [x] Firebase Auth with Google sign-in (existing)
- [x] Custom claims (`role`, `clientId`) enforced server-side (existing)
- [x] Token refresh on app start via `onIdTokenChanged` (existing)
- [ ] Add `Content-Security-Policy` headers to hosting config
- [ ] Validate redirect URLs after OAuth to prevent open redirects

### Authorization

- [x] Firestore security rules enforce `clientId` scoping (existing, 16.5KB rules file)
- [x] Role-based route guards (RequireAuth, RequireRole) (existing)
- [ ] Audit all vNext routes have appropriate guards before launch
- [ ] Ensure public pull share routes validate `shareToken` server-side (existing pattern)

### Data Safety

- [x] XSS prevention via `sanitizeHtml.ts` (existing)
- [ ] Validate all user input at form boundaries (Zod schemas)
- [ ] Sanitize rich text / markdown before rendering
- [ ] No `dangerouslySetInnerHTML` without sanitization

### Infrastructure

- [x] Firebase App Check for production (existing)
- [x] Sentry error tracking (existing)
- [ ] Enable Firestore Audit Logging for admin operations
- [ ] Review Storage security rules for vNext upload paths

### Threat Model Prompts

For each new feature, answer these before shipping:

1. Can a user access data outside their `clientId`?
2. Can a user escalate their role via client-side manipulation?
3. Can a user modify data they should only read?
4. Can untrusted input be rendered as HTML/JS?
5. Can a public share link leak private data beyond the intended scope?
6. Can a race condition cause duplicate writes or data corruption?

---

## Offline / PWA Strategy (v1)

### Read-Only Offline

- Enable Firestore persistence (`enableIndexedDbPersistence` or `enableMultiTabIndexedDbPersistence`).
- Firestore SDK handles offline reads transparently from IndexedDB cache. This default IndexedDB persistence is allowed and relied upon for cached reads.
- No custom service worker for v1.
- Writes require connectivity. If offline, show "You're offline. Changes will sync when reconnected." banner.
- Firestore's built-in offline write queue operates transparently but vNext does not build any custom offline mutation handling on top of it. No custom queue, no retry UI, no conflict resolution — the Firestore SDK's native behavior is the ceiling.
- **Explicitly out of scope for v1:** Custom offline mutation queue, conflict resolution UI, sync status indicators, or any offline-aware write orchestration beyond what the Firestore SDK provides natively.

### PWA Metadata

- Add `manifest.json` for "Add to Home Screen" on mobile.
- App shell (nav + skeleton) should render without network.
- No push notifications in v1 (use in-app notifications only).

---

## Logging & Observability

### Sentry Conventions

| What | How |
|------|-----|
| **Unhandled errors** | Auto-captured by `@sentry/react` (existing) |
| **Component errors** | `Sentry.ErrorBoundary` wrapping each feature module |
| **Breadcrumbs** | Auto-captured for navigation, clicks, Firestore operations |
| **Custom events** | `Sentry.captureMessage()` for business-logic anomalies (e.g., pull sheet with 0 items) |
| **Performance** | `Sentry.startTransaction()` for key flows (project load, pull generation) |
| **User context** | Set `Sentry.setUser({ id, email, role, clientId })` on auth |

### Activity Logging (Existing)

- `logActivity()` for user actions (shot.created, pull.fulfilled, etc.)
- Stored in `clients/{cid}/activities/{pid}/{aid}`
- 90-day retention (Cloud Function cleanup)
- Append-only (Firestore rules block updates)
- vNext reuses this system unchanged.

### Console Logging Rules

- **Development:** `console.log` / `console.warn` allowed for debugging.
- **Production:** No `console.log`. Use `console.error` for unexpected states + Sentry capture.
- Lint rule: `no-console` with exceptions for `error` and `warn`.

---

## Testing Strategy

### Unit Tests (Vitest)

- Test hooks and lib functions in isolation.
- Mock Firestore with `vi.mock()` — do not hit real Firestore in unit tests.
- Target: 80%+ coverage for `shared/lib/` and feature `lib/` modules.

### Component Tests (Vitest + Testing Library)

- Test component rendering, user interactions, and state changes.
- Use `@testing-library/react` for DOM assertions.
- Mock context providers (Auth, Scope) with test utilities.

### E2E Tests (Playwright) — Post-v1 Hardening

E2E tests are valuable but are **not a requirement for the first vertical slice.** They are planned as a post-v1 hardening activity once the core workflows stabilize.

When implemented:
- Cover the first-slice workflow end-to-end: Project → Shots → Pull Sheet.
- Run against Firebase Emulators (auth, Firestore, storage).
- Capture screenshots on failure.
- Target: 1 happy-path E2E per key flow, 1 error-path per flow.

### Visual Regression

- Not in v1. Consider after design stabilizes.
