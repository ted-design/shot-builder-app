# Repository Guidelines

## Project Structure & Module Organization
Shot Builder runs on Vite + React. All runtime code stays in `src/`: `components/` for shared UI, `pages/` for routes, `routes/` for guards/layouts, `auth/` + `context/` for session state, and `hooks/`/`lib/` for reusable logic (feature switches live in `src/lib/flags.js`). Tests live beside features in `__tests__/`. Firebase Cloud Functions sit in `functions/`, docs in `docs/`, and production assets are emitted to `dist/`.

## Build, Test, and Development Commands
- `npm run dev` – start the Vite dev server (http://localhost:5173).
- `npm run build` – produce a production bundle in `dist/`.
- `npm run preview` – serve the build for smoke-testing.
- `npm run test` / `npm run test:watch` – run Vitest suites once or in watch mode; both use the threaded pool expected in CI.
- `npm run lint` – enforce ESLint rules; the pipeline fails on warnings.
- `npm run deploy` – deploy hosting and functions through the Firebase CLI (requires authenticated Firebase credentials).

## Coding Style & Naming Conventions
Favor function components and hooks with ES modules. Use PascalCase for React components (`NavBarWithAuth.jsx`), camelCase for utilities (`deleteImage.js`), and suffix hooks with `use`. Code is indented with two spaces and double-quoted strings. Run `npm run lint` before opening a PR; avoid blanket `eslint-disable` comments—scope them to a single line when unavoidable.

## Testing Guidelines
Vitest plus Testing Library power unit and interaction tests. Create `*.test.jsx` or `*.test.ts` files under a nearby `__tests__/` folder to keep intent clear. Assert user-visible behavior with queries by role/text instead of DOM traversal. When you add or change a flag, verify both on/off paths and document manual steps in the PR.

## Commit & Pull Request Guidelines
Commits follow a conventional format: `type(scope): summary` (e.g. `ci(wif): set explicit audience`). Keep the subject imperative and under ~80 characters, and include follow-up details in the body if needed. PRs should link tickets, explain flag defaults or cleanup plans, attach UI screenshots when visuals shift, and list automated tests executed.

## Feature Flags & Environment Notes
Update `src/lib/flags.js` when introducing a flag; defaults come from `import.meta.env` and can be overridden via `localStorage` helpers or the `?auth=on/off` query. Use flags to stage risky changes and capture sunset criteria in the PR. Provide Firebase environment secrets via CI/CD (e.g. GitHub Secrets) and use a local `.env` (or `.env.development.local`) for development if needed; never commit real credentials.
