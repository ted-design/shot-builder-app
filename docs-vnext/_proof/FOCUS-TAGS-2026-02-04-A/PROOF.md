# PROOF — FOCUS-TAGS-2026-02-04-A

Date: 2026-02-04

## Goal

Ship producer-grade tag management:
- Add/remove/create tags on shots
- Rename/recolor/merge/delete tags across a project
- Preserve legacy compatibility (no new tag collections)

## Contract

- Tags live on shot docs: `clients/{cid}/shots/{sid}.tags = [{id,label,color}]`
- Default tags are shipped as templates (usageCount 0 until used)
- Tag colors support legacy color keys (`red`, `amber`, …) and CSS-color fallback

## Verification

### Automated (required)
- `npm test` — PASS
- `npm run lint` — PASS (0 warnings)
- `npm run build` — PASS

### Manual QA Required

⚠️ Chrome extension unavailable in this environment for visual verification.

| Scenario | Steps | Expected |
|---------|-------|----------|
| Create + assign tag | Shot Detail → Tags → type label → `Create` → `Save` | Tag appears on shot and in `/projects/:id/tags` list |
| Reuse tag | Shot Detail → Tags → select existing tag → `Save` | Tag added; no duplicates |
| Rename tag | `/projects/:id/tags` → select tag → click name → rename | Tag label updates on all shots using it |
| Recolor tag | `/projects/:id/tags` → select tag → change color | Tag color updates on all shots using it |
| Merge tags | `/projects/:id/tags` → select 2+ via checkboxes → `Merge` | All merged tags replaced by target |
| Delete tag | `/projects/:id/tags` → select tag → `Delete` | Tag removed from all shots |
| Mobile guard | Open `/projects/:id/tags` on mobile | Redirects to `/projects/:id/shots` with toast |
