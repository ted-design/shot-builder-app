# Shot Builder React/Firebase Starter Kit

This repository contains a starter implementation for a shot‑planning and wardrobe management web application. It is designed to run on Firebase and uses React for the front end. The project is multi‑tenant aware and uses Firestore collections and subcollections to model shots, product families, projects, and reservations.

## Features included

* Authentication via Firebase Auth (Google sign‑in by default).
* Role‑based access control using custom claims and project membership documents.
* Multi‑project support with per‑project scoping.
* Products split into **families** (shared images and metadata) and size‑specific SKUs.
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

## Next steps

This starter kit intentionally leaves many implementation details up to you. You can tailor the UI components, pages, and Cloud Functions to suit your production workflow. Consult the architecture plan provided in the discussion to structure your Firestore collections and Cloud Functions.
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
