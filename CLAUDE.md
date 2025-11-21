# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Shot Builder is a Firebase-based React application for planning and managing commercial photo/video shoots. It handles shot planning, wardrobe/product management, talent coordination, and warehouse fulfillment through pull sheets. The app is multi-tenant with per-client data isolation enforced through Firebase Auth custom claims and Firestore security rules.

## Essential Commands

### Development
```bash
npm install                    # Install dependencies
npm run dev                    # Start development server (localhost:5173)
npm run build                  # Build for production
npm run preview                # Preview production build locally
```

### Testing
```bash
npm test                       # Run tests with Vitest
npm run test:watch            # Run tests in watch mode
npm run test:ui               # Open Vitest UI
npm run lint                  # Run ESLint (zero warnings allowed)
```

### Deployment
```bash
npm run deploy                # Deploy hosting, functions, and storage rules to Firebase
```

### Firebase Emulators
```bash
# Set VITE_USE_FIREBASE_EMULATORS=1 to connect to local emulators
# Default ports: auth:9099, firestore:8080, functions:5001, storage:9199
firebase emulators:start --only auth,firestore,functions,storage
```

## Architecture

### Data Model & Multi-Tenancy

All data is scoped by `clientId` (derived from Firebase Auth custom claims). Firestore collections follow this pattern:

```
/clients/{clientId}/
  ├── users/{userId}              # User profiles with role and project access
  ├── projects/{projectId}/       # Projects with shoot dates and member roles
  │   ├── activities/{activityId} # Activity feed (90-day retention)
  │   └── pulls/{pullId}          # Pull sheets for warehouse fulfillment
  ├── shots/{shotId}              # Shots with talent, products, locations
  │   └── comments/{commentId}    # Threaded comments with @mentions
  ├── productFamilies/{familyId}/ # Product families (shared metadata)
  │   └── skus/{skuId}            # Size/color-specific SKUs
  ├── talent/{talentId}           # Model profiles with sizing info
  ├── locations/{locationId}      # Shooting locations
  └── notifications/{notificationId} # Per-user notifications
```

**Legacy collections** (`/shots`, `/talent`, `/locations`, `/products`) are deprecated and blocked by security rules. All new data uses the client-scoped structure.

### Authentication & Authorization

- **Firebase Auth** with Google sign-in (default) and email/password
- **Custom claims** required: `role` and `clientId` (or `orgId`)
- **Roles**: `admin`, `producer`, `wardrobe`, `crew`, `viewer`
- Role validation happens in:
  1. Firestore security rules (`firestore.rules`)
  2. React route guards (`src/components/common/RequireAuthRoute.jsx`)
  3. UI permission helpers (`src/lib/rbac.js`)

**Custom claims setup:**
```bash
cd functions
node scripts/setCustomClaims.js --uid="<firebase-uid>" --role=producer --clientId=unbound-merino
```

Users must sign out/in or call `getIdToken(true)` to refresh claims after updates.

### Firebase Configuration

**Required environment variables** (prefix with `VITE_` for Vite):
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

**Optional:**
- `VITE_FIREBASE_MEASUREMENT_ID` (Analytics)
- `VITE_FIREBASE_APPCHECK_RECAPTCHA_SITE_KEY` (App Check for production)

Missing required vars will warn in dev and throw in production builds. Firebase initialization is in `src/lib/firebase.ts`.

### Feature Flags

Flags are defined in `src/flags.ts` and default to `false`. Enable via:
1. localStorage: `flag.{flagName}`
2. URL params: `?{flag}=on` (persists to localStorage)
3. Env vars: `VITE_FLAG_{FLAG_NAME}`

**Current flags:**
- `newAuthContext`: New Firebase auth flow (default ON in production)

Remove flags once features are stable. See `docs/flags.md` for details.

## Key Code Patterns

### Component Structure

```
src/
├── App.jsx                  # Router + global providers
├── main.jsx                 # Vite entry point
├── components/
│   ├── common/             # Reusable UI primitives (buttons, modals, forms)
│   ├── shots/              # Shot management components
│   ├── products/           # Product family & SKU components
│   ├── planner/            # Drag-and-drop planner board
│   ├── pulls/              # Pull sheet aggregation & fulfillment
│   ├── talent/             # Talent profile cards
│   ├── locations/          # Location management
│   ├── comments/           # Comment threads with @mentions
│   ├── activity/           # Activity timeline components
│   ├── mentions/           # User mention picker
│   └── admin/              # User/role management
├── pages/                  # Route-level page components
├── context/                # React Context providers (Auth, etc.)
├── hooks/                  # Custom React hooks
├── lib/                    # Firebase, utilities, helpers
├── types/                  # TypeScript type definitions
└── schemas/                # Zod validation schemas
```

### React Conventions

- **Functional components only** (no class components)
- Use **hooks** for state and side effects
- **Context providers** for auth, flags, and global state
- **React Router v6** for routing with `RequireAuthRoute` guard
- **Tailwind CSS** for styling (avoid custom CSS)

### Firestore Patterns

**Reading data:**
```javascript
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

// Subscribe to real-time updates
const unsubscribe = onSnapshot(
  doc(db, 'clients', clientId, 'shots', shotId),
  (snapshot) => {
    const data = snapshot.data();
    // Handle data
  }
);
```

**Writing data:**
```javascript
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

await setDoc(doc(db, 'clients', clientId, 'shots', shotId), {
  title: 'New Shot',
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});
```

**Batch operations:**
```javascript
import { writeBatch } from 'firebase/firestore';

const batch = writeBatch(db);
batch.set(doc1Ref, data1);
batch.update(doc2Ref, { field: 'value' });
await batch.commit();
```

### Security Rules Validation

Before deploying rule changes:
1. Review `firestore.rules` for client scoping: `clientMatches(clientId)`
2. Test with Firebase Emulator Suite
3. Ensure role checks use `isAdmin()`, `isProducer()`, or `hasProjectRole()`
4. **Default deny**: Only explicitly allow safe operations

### Image Upload Pattern

Images are uploaded to Firebase Storage with compression. **Always wrap image operations in try-catch blocks:**

#### SingleImageDropzone Component (Recommended)

For single image uploads with drag-and-drop support, use the `SingleImageDropzone` component:

```javascript
import SingleImageDropzone from '../components/common/SingleImageDropzone';

function MyComponent() {
  const [imageFile, setImageFile] = useState(null);

  return (
    <SingleImageDropzone
      value={imageFile}
      onChange={setImageFile}
      disabled={saving}
      existingImageUrl={existingImage?.path}
      onRemoveExisting={() => setExistingImage(null)}
      showPreview={true}  // Optional: show preview below dropzone
    />
  );
}
```

**Features:**
- Drag-and-drop zone with visual feedback
- Click-to-browse fallback
- File type validation (JPEG, PNG, WebP, GIF)
- File size validation (50MB max)
- Optional image preview
- Keyboard accessible
- Error handling built-in

**Props:**
- `value`: Current File object or null
- `onChange`: Callback receiving File or null
- `disabled`: Disable the dropzone
- `existingImageUrl`: URL of existing image to display
- `onRemoveExisting`: Callback when existing image is removed
- `showPreview`: Boolean to show/hide preview (default: true)
- `accept`: File types (default: "image/*")
- `maxSize`: Max file size in bytes (default: 50MB)

#### Direct Upload Pattern

For direct uploads to Firebase Storage:

```javascript
import { uploadImageFile } from '../lib/firebase';
import { compressImageFile } from '../lib/images';

// Upload with compression
try {
  const { downloadURL, path } = await uploadImageFile(file, {
    folder: 'shots',      // images/shots/{id}/{filename}
    id: shotId,
    filename: 'optional-name.jpg', // Defaults to timestamped name
  });
} catch (error) {
  console.error('Upload failed:', error);
  setError('Unable to upload image. Please try a different file.');
}

// Manual compression before upload
try {
  const compressed = await compressImageFile(file, {
    maxDimension: 1600,
    quality: 0.82,
  });
  // Use compressed file...
} catch (error) {
  console.error('Compression failed:', error);
  setError('Unable to process image. Please try a different file.');
}
```

#### Multiple Image Uploads

For batch uploads, use the `BatchImageUploader` component (see `src/components/common/BatchImageUploader.jsx`).

### Activity Logging

Track user actions in project activity feeds:

```javascript
import { logActivity } from '../lib/activityLogger';

await logActivity({
  projectId,
  actorId: user.uid,
  actionType: 'shot.created',
  targetType: 'shot',
  targetId: shotId,
  metadata: { shotName: 'My Shot' },
});
```

Activities auto-expire after 90 days (Cloud Function cleanup).

## Testing Guidelines

- **Vitest** with `@testing-library/react` for component tests
- **jsdom** environment for DOM operations
- Test files: `__tests__/*.test.{js,jsx,ts,tsx}`
- Run single test: `npm test -- src/path/to/__tests__/file.test.js`

**Example test structure:**
```javascript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MyComponent from './MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

## Git Workflow

- Branch naming: `feature/<slug>` or `fix/<slug>` (current: `feat/phase17b-activity-feed`)
- One topic per PR
- Commit message format: Conventional Commits style
- Main branch: `main`
- CI runs linting and tests on every push
- Deploy workflow runs on merge to `main`

## Firebase Performance & Monitoring

**Performance Monitoring** (production only):
```javascript
import { measurePerformance } from '../lib/firebase';

const result = await measurePerformance('load_products', async () => {
  return await fetchProducts();
});
```

**Sentry Integration**: Error tracking configured with `@sentry/react` (see `src/main.jsx`).

## Keyboard Shortcuts

Shot Builder includes global keyboard shortcuts for faster navigation and actions. The shortcuts are implemented using `react-hotkeys-hook` in `src/components/GlobalKeyboardShortcuts.jsx`.

Keyboard shortcuts are displayed inline within the Command K menu (`Cmd+K` or `Shift+/`), making them easily discoverable and contextual to the current page.

### Available Shortcuts

**General:**
- `Cmd+K` (Mac) / `Ctrl+K` (Windows): Open command palette
- `Shift+/` (or `?`): Open command palette showing keyboard shortcuts
- `c`: Open command palette (when not typing in a form)

**Navigation:**
- `Alt+D`: Go to Dashboard (Projects page)
- `Alt+S`: Go to Shots (requires active project)
- `Alt+P`: Go to Products
- `Alt+T`: Go to Talent
- `Alt+L`: Go to Locations
- `Alt+U`: Go to Pulls

**Page-Specific Shortcuts:**

*Planner Page:*
- `↑`/`↓`: Move shot within lane (keyboard reordering)
- `Alt + ←/→`: Move shot to previous/next lane
- `Cmd/Ctrl + Z`: Undo last move

**Usage Notes:**
- All shortcuts work globally, even when typing in form fields (except single-key shortcuts like `c`)
- Press `Shift+/` to open the Command K menu directly to the keyboard shortcuts section
- Navigation shortcuts (`Alt+D/S/P/T/L/U`) are shown inline next to navigation items in the Command K menu
- Page-specific shortcuts (like Planner) are automatically displayed in the Command K menu when on that page
- Shots navigation (`Alt+S`) checks for an active project and redirects to Projects if none is selected
- The command palette provides search, quick actions, recent items, and keyboard shortcuts in one unified interface

### Implementation Details

The keyboard shortcut system consists of:
1. `GlobalKeyboardShortcuts.jsx` - Global shortcut handler component (registers all keyboard shortcuts)
2. `SearchCommand.jsx` - Command palette with `cmdk` library (displays shortcuts inline)
3. `usePageShortcuts.js` - Hook that returns page-specific shortcuts based on current route
4. `SearchCommandContext.jsx` - Context that manages command palette state, including `openSearchForShortcuts()`
5. `react-hotkeys-hook` - Declarative keyboard shortcut management

**Adding New Global Shortcuts:**
```javascript
// In GlobalKeyboardShortcuts.jsx
useHotkeys('alt+n', navigateToNewPage, {
  enableOnFormTags: true,  // Allow in form fields
  preventDefault: true,     // Prevent default browser behavior
});
```

**Adding Page-Specific Shortcuts:**
```javascript
// In usePageShortcuts.js
if (pathname.includes('/my-page')) {
  return {
    title: 'My Page Shortcuts',
    shortcuts: [
      {
        keys: ['Cmd/Ctrl', 'S'],
        description: 'Save changes',
      },
    ],
  };
}
```

**Note**: For special characters produced by key combinations (like `?` from `Shift+/`), use the `useKey: true` option to listen for the character rather than the key code.

## Shared Hooks

Shot Builder includes reusable hooks to eliminate code duplication across pages.

### useEntityExport

**Location**: `src/hooks/useEntityExport.js`

**Purpose**: Provides CSV and PDF export functionality for any entity type (shots, products, talent, etc.).

**Usage:**
```javascript
import { useEntityExport } from '../hooks/useEntityExport';

// Define columns for your entity
const columns = [
  { key: 'name', label: 'Name' },
  { key: 'status', label: 'Status' },
  { key: 'createdAt', label: 'Created', format: (val) => new Date(val).toLocaleDateString() },
];

function ShotsPage() {
  const [shots, setShots] = useState([]);

  const { exportToCSV, exportToPDF, isExporting } = useEntityExport(
    'shots',  // Entity type (used in filename)
    shots,    // Array of data to export
    columns   // Column definitions
  );

  return (
    <button onClick={exportToCSV} disabled={isExporting}>
      Export to CSV
    </button>
  );
}
```

**Features:**
- Automatic CSV generation with proper escaping
- Customizable column definitions with optional formatters
- Loading state management (`isExporting`)
- Toast notifications for success/error
- Works with any array of objects

**Replaces**: ~40-50 lines of duplicate export logic per page

### useBulkSelection

**Location**: `src/hooks/useBulkSelection.js`

**Purpose**: Manages selection state for bulk operations (selecting multiple items in a list/table).

**Usage:**
```javascript
import { useBulkSelection } from '../hooks/useBulkSelection';

function ShotsPage() {
  const [shots, setShots] = useState([]);

  const {
    selectedIds,      // Set of selected IDs
    selectedItems,    // Array of selected items
    selectAll,        // Select all items
    deselectAll,      // Clear selection
    toggle,           // Toggle single item
    toggleMultiple,   // Toggle multiple items
    isSelected,       // Check if item is selected
    hasSelection,     // Check if any items selected
    isAllSelected,    // Check if all items selected
    isIndeterminate   // Check if some (but not all) selected
  } = useBulkSelection(shots, 'id');  // 'id' is the key to use for identification

  return (
    <>
      <input
        type="checkbox"
        checked={isAllSelected}
        indeterminate={isIndeterminate}
        onChange={isAllSelected ? deselectAll : selectAll}
      />

      {shots.map(shot => (
        <div key={shot.id}>
          <input
            type="checkbox"
            checked={isSelected(shot.id)}
            onChange={() => toggle(shot.id)}
          />
          {shot.name}
        </div>
      ))}

      {hasSelection && (
        <button onClick={() => deleteSelected(selectedIds)}>
          Delete {selectedIds.size} items
        </button>
      )}
    </>
  );
}
```

**Features:**
- Complete selection API (select all, toggle, check state)
- Indeterminate checkbox state support
- Works with any array of objects
- Efficient Set-based storage for O(1) lookups
- Returns both IDs and full item objects

**Replaces**: ~20-30 lines of selection state management per page

## Common Pitfalls & Gotchas

1. **Custom claims don't update immediately**: Call `user.getIdToken(true)` to force refresh
2. **Client scoping**: Always check `clientId` matches in queries and security rules
3. **Offline behavior**: Firestore caches data; handle stale reads gracefully
4. **Image compression**: Client-side compression in `compressImageFile` may take time and can fail with invalid/corrupted files
5. **Image upload errors**: Always wrap `compressImageFile()` and `uploadImageFile()` in try-catch blocks to handle invalid files gracefully
6. **Activity feed**: Activities are immutable (audit trail); updates blocked by rules
7. **Pull sheet sharing**: Public sharing uses `shareToken` (32+ char cryptographic string)
8. **Legacy data**: Old root-level collections are blocked; migration required
9. **Role-based UI**: Always check permissions before rendering admin/producer actions

## Documentation References

- Architecture: `docs/shot_builder_structure.md`
- Overview: `docs/shot_builder_overview_updated.md`
- Agent Guide: `docs/shot_builder_agent_reference.md`
- Guardrails: `docs/shot_builder_guardrails.md`
- Roadmap: `docs/shot_builder_roadmap_updated.md`
- Flags: `docs/flags.md`

## Firebase CLI Tips

```bash
# View Firebase logs
firebase functions:log

# Deploy only specific targets
firebase deploy --only hosting
firebase deploy --only functions:functionName
firebase deploy --only firestore:rules

# Check security rules
firebase firestore:rules:check

# List Firestore indexes
firebase firestore:indexes
```

## Current Phase: Phase 17B - Activity Feed

The application recently integrated an activity feed system that logs user actions across projects. Key components:
- `ActivityTimeline` component for displaying feed
- Activity logging via `logActivity()` helper
- 90-day retention enforced by Cloud Function
- Firestore rules prevent activity updates (immutability)

Activity types: `shot.created`, `shot.updated`, `shot.deleted`, `pull.created`, etc.
## 2025-11-20 – Navigation & Scope Refactor Plan

Summary
- Clarify the distinction between organization-level (global) navigation and project-level (workspace) views.
- Make project context the primary organizing principle for the Shot Builder workspace.
- Avoid duplicate UIs for Talent/Locations by converging on scope-aware, shared components.

Target Top-Level Navigation
- Dashboard (`/projects`) — project selector / landing page.
- Shot Builder — visible only with an active project; defaults to `Builder` at `/projects/:projectId/shots`.
- Products (`/products`) — org-level product library.
- Library (`/library/...`) — org-level assets with tabs for Talent, Locations, Tags.
- Settings (`/admin`) — org-level settings (replaces “Admin” label, route unchanged).

Behavior Notes
- Attempting to access Shot Builder without an active project disables the nav entry; direct `/shots` hits redirect to Dashboard (`/projects`) with a gentle nudge.
- Library pages are explicitly org-level and should avoid project-specific phrasing in headers and empty states.
- Project-scoped Assets live inside the Shot Builder workspace (tabbed) and use the same scope-aware components where possible.

Scope Model
```ts
type Scope =
  | { type: "org" }
  | { type: "project"; projectId: string };
```
- Org scope shows the complete talent/location sets for the organization.
- Project scope shows the subset linked to a project (via `projectIds` array on org records).
- A small hook will expose scope from route/context when needed.

Shared Components Strategy
- Create scope-aware list/detail components used by both:
  - Library (org scope): `TalentList({ type: 'org' })`, `LocationList({ type: 'org' })`.
  - Project Assets (project scope): `TalentList({ type: 'project', projectId })`, `LocationList({ type: 'project', projectId })`.
- Primary actions vary by scope:
  - Org: Create/Edit/Archive master records; secondary action “Assign to project…”.
  - Project: “Add from Library” (search across org), “Create new” (create org-level then link), “Remove from project” (detach without deleting).
- Permissions: enforce via existing RBAC; users might be read-only in Library but allowed to add/remove within their project.

Routing Plan
- New parent: `/library` with tabs/routes:
  - `/library/talent` → org Talent
  - `/library/locations` → org Locations
  - `/library/tags` → Tags management
- Keep legacy routes (`/talent`, `/locations`, `/tags`) as redirects to their `/library/*` equivalents.
- Shot Builder remains project-scoped under `/projects/:projectId/shots` with internal tabs: Builder, Planner, Assets.

Implementation Notes (this session)
- Add Scope type + helper hook.
- Introduce Library parent layout + routes and move org pages under it (with redirects from legacy routes).
- Consolidate top nav to: Dashboard, Shot Builder (project-only), Products, Library, Settings.
- Keep existing “Pulls” routes accessible but remove from top nav (not a primary IA pillar).

TODO Checklist
- [x] Document plan and IA in Claude.md
- [x] Introduce Scope type and helper
- [ ] Refactor Talent list/detail to be Scope-aware
- [ ] Refactor Location list/detail to be Scope-aware
- [ ] Wire Library routes to org scope (pages under `/library/*`)
- [x] Wire project Assets tab to project scope (shared lists)
- [ ] Update empty states and CTAs for both scopes
- [ ] Implement consolidated top-level nav
- [ ] Ensure redirects for missing/invalid project IDs are friendly
- [ ] Run tests and lint, fix issues
- [ ] Update docs/screenshots if needed

Notes & Edge Cases
- Users with no projects should only see Dashboard + org-level areas.
- Deep links to `/shots` without a current project redirect to Dashboard; consider a toast (“Select a project to use Shot Builder”).
- Admin remains routed at `/admin` but labeled “Settings” in nav to avoid breaking links.
