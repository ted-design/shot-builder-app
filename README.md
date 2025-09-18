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

   Create a `.env.local` file (git-ignored) with the Firebase config copied from the **same project** you plan to deploy to. All keys must use the Vite `VITE_FIREBASE_*` prefix that our app reads at build time:

   ```bash
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   VITE_FIREBASE_MEASUREMENT_ID=...
   ```

   The project ID in `.env.local` should match the hosting site declared in `firebase.json`. If it does not, the app will warn about a project mismatch on startup.

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

## Product management

- Product families appear as responsive cards (two columns on tablet, three on desktop) with 4:5 imagery, status badges and quick action menus. A dedicated tile and toolbar button launch the creation flow.
- `NewProductModal` and `EditProductModal` share the `ProductFamilyForm`, capturing style metadata, optional previous style numbers, timestamped notes and header imagery (aim for 1600×2000 px under 2.5 MB; uploads are compressed client-side).
- SKUs are stored as documents under `/productFamilies/{familyId}/skus`, each recording colour name, SKU code, optional size list, status and image. Producers can add, archive or restore SKUs without touching the family document.
- Role helpers (`canEditProducts`, `canArchiveProducts`, `canDeleteProducts`) gate UI actions: producers can create/edit/archive, while only admins can permanently delete families or SKUs. Updated Firestore rules enforce the same constraints and provide a soft-delete archive path.
- The callable `migrateProductsToFamilies` function lifts legacy `/products/{productId}` documents into the new structure. The CSV importer (`ImportProducts` page) now writes directly to product families and nested SKUs.

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
