# Sprint Notes — SPRINT-2026-02-03-A

## Decisions

- Proof artifacts live in tracked `docs-vnext/_proof/SPRINT-2026-02-03-A/` (docs/_runtime is gitignored).
- Public warehouse pull route is `/pulls/shared/:shareToken` (unauth) and uses Cloud Function `publicUpdatePull` for writes.
- Call sheet nav destination is `/projects/:id/callsheet` (schedule list lives there); `/projects/:id/schedules` redirects for backward compatibility.
- Org library routes added: `/library/talent`, `/library/locations`, `/library/crew` (read-only).
- Project assets route added: `/projects/:id/assets` (derived from shots; no per-id reads).

## Constraints & Guardrails

- No `git pull` / merge / rebase.
- No destructive git operations (`reset --hard`, `clean -fd`).
- Avoid schema creep; prefer compatibility fields and defensive mapping.
- Avoid fan-out / N+1 reads in new surfaces.

## Follow-ups

- Add richer warehouse fulfillment actions (unavailable/substituted) only if required by producers.
