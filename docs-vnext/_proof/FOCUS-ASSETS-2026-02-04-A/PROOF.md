# PROOF — FOCUS-ASSETS-2026-02-04-A

Date: 2026-02-04

## Goal

Make `/projects/:id/assets` a functional producer-grade surface to:
- Add Talent / Locations / Crew from the org Library to a project
- Create new Talent / Locations / Crew inside the project (auto-saved to Library + auto-assigned to the project)

## What changed (high level)
- Project Assets now manages **project-scoped membership** via `projectIds` on Library docs (legacy-compatible).
- Added create + add/remove flows with explicit success/error feedback.

## Verification

### Automated (required)
- `npm test` — PASS (includes `src-vnext/features/assets/components/__tests__/ProjectAssetsPage.test.tsx`)
- `npm run lint` — PASS (0 warnings)
- `npm run build` — PASS

### Manual QA Required

⚠️ Chrome extension unavailable in this environment for visual verification.

| Scenario | Steps | Expected |
|---------|-------|----------|
| Add existing talent | Open `Assets` → Talent → `Add` → select an item → `Add` | Item appears in Talent list; toast “Added …” |
| Create new location | Open `Assets` → Locations → `New` → enter name/address → `Create` | New location appears in Locations list; exists in org `/library/locations` |
| Remove used talent | Ensure a shot references a talent → `Remove` talent from Assets | Confirmation dialog appears; after confirm, talent removed from project list |
| Mobile read-only | Narrow viewport / mobile | Add/New/Remove disabled |
