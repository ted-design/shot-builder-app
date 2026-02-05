# Notes — SPRINT-2026-02-03-B

## Decisions

- Proceeding without in-session screenshots from Codex CLI; screenshots will be captured via Claude-in-Chrome using a copy/paste prompt.

## Tradeoffs

- `participatingTalentIds` is computed in-session (not written to Firestore) to avoid schema drift and extra writes; trust warnings are accurate for the current editor session.

## Follow-ups

- TBD
