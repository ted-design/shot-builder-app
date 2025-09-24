Title: Hardening Firebase deploys and fixing production auth bootstrap

Summary
- Prevent double builds and missing env at deploy time by removing Hosting’s predeploy build and ensuring workflows pass Vite env during deploy.
- Correct Storage bucket config in production env file to the SDK‑expected bucket name.

Changes
- firebase.json: remove hosting.predeploy (avoids a second build during firebase deploy that previously lacked VITE_* env).
- .github/workflows/deploy-live.yml: pass VITE_* env to deploy step so any build invoked by the CLI still has secrets.
- .github/workflows/deploy-preview.yml: same as live; env is provided to the deploy step.
- .env.production.local: set VITE_FIREBASE_STORAGE_BUCKET=um-shotbuilder.appspot.com (SDK bucket name, not the download domain).
- .env.example: same bucket correction to prevent drift.

Why
- The live site showed: “Missing Firebase env vars …” then auth/invalid-api-key. Root cause was the Hosting predeploy step rebuilding without VITE_* env in the deploy job, stripping credentials from the bundle and breaking auth bootstrap.

Impact
- Deploys rely on the explicit Build step in CI; firebase deploy no longer triggers an extra build.
- Both preview/live deploys receive VITE_* during deploy (defense in depth) even if a future predeploy is reintroduced.

Manual verification
1) CI: Ensure GitHub Secrets exist for all required VITE_* keys referenced by the workflows.
2) Local prod smoke test: `npm run build && npm run preview`, then visit http://localhost:4173/?auth=off — app should load without the missing‑env warning.
3) Live: After the next deploy, hard refresh https://um-shotbuilder.firebaseapp.com — no missing‑env warning; auth should initialize.

Notes
- In Firebase config, storageBucket must be the appspot.com bucket (um-shotbuilder.appspot.com). The firebasestorage.app domain is used for download URLs, not for the SDK bucket name.

