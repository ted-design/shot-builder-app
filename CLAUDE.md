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

Images are uploaded to Firebase Storage with compression:

```javascript
import { uploadImageFile } from '../lib/firebase';

const { downloadURL, path } = await uploadImageFile(file, {
  folder: 'shots',      // images/shots/{id}/{filename}
  id: shotId,
  filename: 'optional-name.jpg', // Defaults to timestamped name
});
```

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

## Common Pitfalls & Gotchas

1. **Custom claims don't update immediately**: Call `user.getIdToken(true)` to force refresh
2. **Client scoping**: Always check `clientId` matches in queries and security rules
3. **Offline behavior**: Firestore caches data; handle stale reads gracefully
4. **Image compression**: Client-side compression in `uploadImageFile` may take time
5. **Activity feed**: Activities are immutable (audit trail); updates blocked by rules
6. **Pull sheet sharing**: Public sharing uses `shareToken` (32+ char cryptographic string)
7. **Legacy data**: Old root-level collections are blocked; migration required
8. **Role-based UI**: Always check permissions before rendering admin/producer actions

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
