# AGENT_GUIDE.md — Shot Builder App

> A living, repo-native brief for code agents (e.g., Codex) and human contributors. Drop this file at the repo root and keep it updated. Treat it as source-of-truth for how to plan, implement, and land changes.

---

## 1) Project purpose (1-pager)
Shot Builder App is a React + Vite + Tailwind web tool to plan and manage commercial shoots (shot lists, schedules, wardrobe pulls, multi-unit logistics). It integrates with Firebase (Auth + Firestore) and is built to scale via feature flags, route guards, and CI gates.

**Primary goals**
- Reliable, flag-gated auth context and route protection (no flashes, predictable redirects)
- Clean, tested UI for creating and manipulating shot data
- Safe secret handling and repeatable CI/CD (tests → build → preview deploy)

**Non-goals (for now)**
- Server rendering
- Multi-tenant role/ACL model beyond basic auth gating

---

## 2) Tech stack & conventions
- Frontend: React 18, Vite, Tailwind. Minimal dependencies; prefer first-party React patterns
- Routing: react-router v6
- Auth: Firebase Auth (context-driven), optional flag gate
- Data: Firebase Firestore (client SDK)
- Testing: Vitest + @testing-library/react
- CI: GitHub Actions (lint, test, build; preview deploy guarded when secrets unavailable)
- Flags: `VITE_*` envs; URL/localStorage overrides allowed for developers

**Code style**
- ES2022+, functional components, hooks; no class components
- Named exports by default; single default export only for React pages/components
- Keep side-effects at entry points; components pure when possible

---

## 3) Working agreements for Codex (and any code agent)
Always do this on every task/PR
1. Plan: Post a short plan (bulleted) in the PR body before coding
2. Branch: `feature/<slug>` or `fix/<slug>`; 1 topic per PR
3. Tests: Add/adjust tests that prove behavior; run locally
4. Safety: No secrets in code; read from `import.meta.env`
5. CI: Ensure `npm ci || npm install`, `npm run test`, `npm run build` pass
6. Preview deploy: If secrets are missing (forks), skip gracefully; do not fail the PR
7. Docs: Update this file or relevant docs when behavior/flags change

Review stance (Codex must challenge assumptions)
- Identify hidden assumptions, provide counterpoints, test logic, offer alternatives, and prioritize truth over agreement. If a requirement conflicts with security, tests, or flags, call it out in the PR body and propose a safer approach.

Acceptance checklist (include as checkboxes in PR body)
- [ ] Tests cover the new/changed behavior
- [ ] Auth flows preserve `state.from` on redirects
- [ ] No flashes while `auth.initializing`
- [ ] Flags default OFF; override precedence works; console warns when overridden
- [ ] CI green; preview deploy conditionally skipped on missing secrets

---

## 4) Feature flags
Env

```
VITE_FLAG_NEW_AUTH_CONTEXT=0
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
```

Override precedence (agent must honor)
1. `localStorage` developer overrides (key: `flag.newAuthContext`)
2. URL query `?auth=on|off|true|false|1|0|yes|no` (and `?auth=clear` to remove override)
3. `.env` / build-time default (`VITE_FLAG_NEW_AUTH_CONTEXT`)

Agent behavior
- When a flag is overridden by localStorage or URL, log a single console.warn (include source of override)
- Tests should assert pass-through behavior when flags are OFF

---

## 5) Auth & routing
- `RequireAuthRoute`: react-router guard. When flag ON and signed-out, redirect to `/login` with `state={{ from: location }}`. When initializing, render `null` or a tiny skeleton (no content flash). When flag OFF, render children (pass-through)
- `ProtectedLayout`: optional wrapper that centralizes guards for entire trees; keep a short explicit public allow-list (`/`, `/login`, `/privacy`, etc.) and guard everything else

Agent tasks
- Keep one guard boundary (layout-level) wherever possible; remove ad-hoc inline guards over time
- Add tests that assert: (a) redirect preserves `from`, (b) no render while initializing, (c) public routes remain public

---

## 6) CI/CD & security
- Workflows: `ci.yml` (lint/test/build), `deploy-preview.yml` (Firebase)
- Preview: Guard deploy steps with `if: github.event.pull_request.head.repo.fork == false && secrets.FIREBASE_TOKEN != ''`
- Secret scanning: Add `gitleaks` workflow; treat findings as PR-blocking later. For this initial PR, mark the job `continue-on-error: true` to avoid noise while evaluating the rule set.
- No secrets in repo history: If any previous keys leaked, rotate and rewrite history as needed

---

## 7) How to run locally (agent & human)

```
nvm use --lts
npm ci || npm install
cp .env.example .env # fill in Firebase + flags as needed
npm run dev
npm run test
npm run build
```

---

## 8) PR template (codex fills this)
Use the template below (see file in .github/).

---

## 9) Backlog labels
- `codex` — tasks suitable for the agent
- `security` — keys, secrets, auth changes
- `flags` — anything involving feature flags
- `tests` — new coverage or refactors

---

## 10) Definition of Done
- Behavior demonstrably correct (tests + manual QA steps in PR)
- Flags honoring precedence; OFF implies no change to legacy behavior
- CI green; preview deploy either successful (with secrets) or gracefully skipped
- Docs updated (this file and any touched feature docs)
