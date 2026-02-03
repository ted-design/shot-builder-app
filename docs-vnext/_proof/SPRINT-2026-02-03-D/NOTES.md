# Sprint Notes — SPRINT-2026-02-03-D

## Decisions

- vNext shot title mapping now falls back to legacy `shot.name` when `shot.title` is missing/empty.
- vNext shot hero image now derives from legacy `looks[].references[]` and `attachments[]` when `shot.heroImage` is absent (no Storage fetch; uses existing download URLs only).
- Pull sheet generation is implemented as a desktop bulk action on the shots list; pull items are aggregated by `familyId+colourId`, and `sizeScope="all"` expands to SKU sizes (best-effort).
- Call sheet renderer header includes project name + schedule name, and export flow shows an explicit “Background graphics” hint.

## Constraints & Guardrails

- No `git pull` / merge / rebase.
- No destructive git operations (`reset --hard`, `clean -fd`).
- No schema creep unless contract requires it.
- Avoid Firestore N+1 reads / fan-out regressions.

## Manual QA Required (Screenshots)

Capture screenshots listed in `PROOF.md` and save under `docs-vnext/_proof/SPRINT-2026-02-03-D/images/`.
