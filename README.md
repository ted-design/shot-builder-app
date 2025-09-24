# Shot Builder React/Firebase Starter Kit

This repository contains a starter implementation for a shot‑planning and wardrobe management web application. It is designed to run on Firebase and uses React for the front end. The project is multi‑tenant aware and uses Firestore collections and subcollections to model shots, product families, projects, and reservations.

## Features included

* Authentication via Firebase Auth (Google sign‑in by default).
* Role‑based access control using custom claims and project membership documents.
* Multi‑project support with per‑project scoping.
* Products split into **families** (shared metadata, notes, header image) and size-specific SKUs managed via `NewProductModal`/`EditProductModal` and a responsive card grid.
* A “Create/Edit Shot” page with support for per‑model outfit items and attachments.
* A day planner view for assigning shots to dates and reordering them via drag and drop.
* A pull‑sheet aggregation model for wardrobe fulfillment.
* Firestore and Storage security rules that enforce org and project boundaries.
* Cloud Functions stubs for product synchronization, nightly snapshotting, event logging, and PDF generation.

## Getting started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Initialize Firebase**

   Ensure you have the Firebase CLI installed and authenticated:

   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init
   ```

   Select **Hosting**, **Functions**, and **Firestore**. Use the existing `firebase.json`, `firestore.rules`, and `storage.rules` files when prompted. Choose TypeScript for functions if you prefer.

   Configure Firebase credentials via environment variables using the Vite `VITE_FIREBASE_*` prefix. In CI/CD, set these as GitHub Secrets so they are available during `npm run build` and deploys. For local development, you can export them in your shell or create a git‑ignored `.env` (or `.env.development.local`) file based on `.env.example`:

   ```bash
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   VITE_FIREBASE_MEASUREMENT_ID=...
   ```

   The configured project ID should match the hosting site declared in `firebase.json`. If it does not, the app will warn about a project mismatch on startup.

   The Firebase bootstrap in `src/lib/firebase.ts` validates these keys on load. Missing values log a loud warning in development and throw during production builds, so ensure the required variables are set before running `npm run build` or deploying.

### Configure custom claims (role/clientId)

Shot Builder relies on Firebase Auth custom claims to determine permissions and match the active client/tenant. Every user who needs write access must have a `role` (for example `producer` or `admin`) and either a `clientId` or `orgId` that matches the Firestore data they operate on.

1. Create or locate the Firebase Auth user (they must sign in at least once).
2. Use the admin helper script to grant claims:

   ```bash
   cd functions
   node scripts/setCustomClaims.js --uid="<firebase-uid>" --role=producer --clientId=unbound-merino
   ```

   Provide `--orgId=<value>` if your tenant mapping uses `orgId` instead of `clientId`. Pass `--project=<your-project-id>` when the default credentials do not include the target project.

3. After the script runs, ask the user to sign out/in or trigger the in-app refresh from the auth menu so the client calls `getIdToken(true)` and pulls the new claims.

   For day-to-day development, sign in through the app's Google/email authentication flow using an account that already exists in the project. When you need to test in isolation, start the Firebase emulators locally with `firebase emulators:start --only auth,firestore,functions,storage` and launch Vite with `VITE_USE_FIREBASE_EMULATORS=1`. Override the default ports (`9099`, `8080`, `5001`, `9199`) by setting the corresponding `VITE_FIREBASE_*_EMULATOR_PORT` variables if your local environment requires it.

3. **Run locally**

   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:5173` by default.

4. **Deploy**

   Deploy both hosting and functions with:

   ```bash
   npm run deploy
   ```

### Deploy: Env sanity check

- Required Vite env vars must be present at build time: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` (see `.env.example`).
- Optional: `VITE_FIREBASE_MEASUREMENT_ID` (Analytics). Missing this only disables Analytics.
- For local prod preview, put values in `.env.production.local` and run `npm run build && npm run preview`.
- For CI/Hosting deploys, set these as environment variables (e.g., GitHub Secrets) so `vite build` can inline them.
- Ensure `VITE_USE_FIREBASE_EMULATORS` is NOT set for production builds.
- This repo configures a Hosting predeploy hook to run `npm run build` automatically (see `firebase.json`).

## Directory structure

```
shot-builder-app/
├── functions/            # Cloud Functions (sync, snapshots, logs, PDF)
├── public/               # Static assets (optional)
├── src/
│   ├── App.jsx          # Application root with routing
│   ├── main.jsx         # Vite entry point
│   ├── components/      # Reusable UI components
│   ├── pages/           # Route-level components (Shots, Planner, etc.)
│   └── styles/          # Tailwind config (optional)
├── firebase.json        # Firebase Hosting configuration
├── firestore.rules      # Firestore security rules
├── storage.rules        # Storage security rules
└── ...
```

## Planner

- The Planner board preloads lanes for each upcoming shoot date and always shows an **Unassigned** lane for undated shots.
- Drag shots between lanes to schedule or clear dates; changes sync instantly to the underlying Firestore documents.
- A talent multi-select filter above the board narrows the view to specific cast members without persisting the filter to Firestore.
- Use the **Export PDF** button to capture the current board (including active filters) via jsPDF for quick handoffs.

## Shots

- Manage per-project shot lists with inline creation, talent assignments, product tagging, and rich notes.
- The page header stays pinned so the search field and `New shot` action remain visible while scrolling long lists.

## Talent

- Centralise model records with agency contacts, sizing details, links, and headshots.
- The sticky header keeps global search and the `New talent` shortcut accessible on both mobile and desktop.

## Locations

- Catalogue studios and on-site venues with addresses, reference photos, notes, and contact info.
- The page header pins search and the `New location` action so you can add venues without losing your place in the list.

## Product management

- The sticky header keeps product search and the `New product` button within reach while you browse large catalogues.
- Sort families by style name (A→Z / Z→A) or style number using the header sort menu.
- Product families appear as responsive cards (two columns on tablet, three on desktop) with 4:5 imagery, status badges and quick action menus. A dedicated tile and toolbar button launch the creation flow.
- `NewProductModal` and `EditProductModal` share the `ProductFamilyForm`, capturing style metadata, optional previous style numbers, timestamped notes and header imagery (aim for 1600×2000 px under 2.5 MB; uploads are compressed client-side).
- SKUs are stored as documents under `/productFamilies/{familyId}/skus`, each recording colour name, SKU code, optional size list, status and image. Producers can add, archive or restore SKUs without touching the family document.
- Role helpers (`canEditProducts`, `canArchiveProducts`, `canDeleteProducts`) gate UI actions: producers can create/edit/archive, while only admins can permanently delete families or SKUs. Updated Firestore rules enforce the same constraints and provide a soft-delete archive path.
- The callable `migrateProductsToFamilies` function lifts legacy `/products/{productId}` documents into the new structure. The CSV importer (`ImportProducts` page) now writes directly to product families and nested SKUs.
- Select multiple families to archive, restore, delete, or bulk edit style numbers—the batch action bar chunks Firestore writes in sets of 200 for safety.

## Next steps

This starter kit intentionally leaves many implementation details up to you. You can tailor the UI components, pages, and Cloud Functions to suit your production workflow. Consult the architecture plan provided in the discussion to structure your Firestore collections and Cloud Functions.

### Role management deployment checklist

- Deploy the callable `setUserClaims` function so the Admin screen can assign roles:

  ```bash
  firebase deploy --only functions:setUserClaims
  ```
- Ensure each teammate signs in at least once; their profile document is created automatically and the Admin page can then adjust their claims.
- Use the Admin “Invite or Update User” form to set roles for new emails—the function looks up the Firebase Auth user and writes the matching Firestore document.

## Contributor Guide

Review `AGENTS.md` for repository workflow, coding standards, and release expectations before opening a pull request.
## CI Status
![CI](https://github.com/ted-design/shot-builder-app/actions/workflows/ci.yml/badge.svg)

## Deploy Status
[![Deploy (live) after CI](https://github.com/ted-design/shot-builder-app/actions/workflows/deploy-live.yml/badge.svg)](https://github.com/ted-design/shot-builder-app/actions/workflows/deploy-live.yml)
[![Deploy preview on PR](https://github.com/ted-design/shot-builder-app/actions/workflows/deploy-preview.yml/badge.svg)](https://github.com/ted-design/shot-builder-app/actions/workflows/deploy-preview.yml)

## Feature Flags & Rollout
New features are gated in `src/lib/flags.js` and default to `false`.
Enable flags only for testing/rollout; remove the flag once a feature is fully stable.

### Auth Flag (newAuthContext)
- Set `VITE_FLAG_NEW_AUTH_CONTEXT=1` in staging to enable new Firebase auth path.
- Locally, toggle via `?auth=on` or `?auth=off` (persists to localStorage and reloads).
- Precedence: localStorage override → env var → default `false`.
