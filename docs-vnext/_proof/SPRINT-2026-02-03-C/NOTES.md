# Sprint Notes — SPRINT-2026-02-03-C

## Decisions

- Treat legacy `shot.notes` as immutable HTML in vNext surfaces (read-only rendering only).
- Add operational notes via append-only `notesAddendum` field (plain text).
- Type legacy `shotNumber` in vNext `Shot` model (no schema change).

## Constraints & Guardrails

- No `git pull` / merge / rebase.
- No destructive git operations (`reset --hard`, `clean -fd`).
- Avoid schema creep; only new field in scope is `notesAddendum` (per slice-2 spec).

## Manual QA Required

⚠️ Chrome screenshot capture is not available in this Codex environment. Screenshots must be captured manually in a real browser and saved under `docs-vnext/_proof/SPRINT-2026-02-03-C/images/`.

## Checks Run

- `npx tsc --noEmit` (2026-02-03) ✅
- `npm test` (2026-02-03) ✅
