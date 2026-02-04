# PROOF — FOCUS-TALENT-2026-02-04-A

Date: 2026-02-04

## Goal

Make `/library/talent` a producer-grade casting workspace:
- Fast browse + search
- Create talent
- Inline edit core fields
- Measurements + notes captured reliably
- Headshot upload supported (Storage rules compatible)
- Mobile is read-only but fully viewable

## Contract

- Talent docs: `clients/{cid}/talent/{talentId}`
- Headshots stored under `images/talent/{talentId}/headshot.webp`
- `projectIds?: string[]` links talent to projects (membership)

## Verification

### Automated (required)
- `npm test` — PASS
- `npm run lint` — PASS (0 warnings)
- `npm run build` — PASS

### Manual QA Required

⚠️ Chrome extension unavailable in this environment for visual verification.

| Scenario | Steps | Expected |
|---------|-------|----------|
| Empty state | Open `/library/talent` with 0 talent docs | Empty state shows CTA to create |
| Create talent | Desktop `/library/talent` → `New talent` → enter name → Create | Talent appears; cockpit opens on new talent |
| Edit inline | Select a talent → click name/agency/email/phone/url → edit → blur | Field persists; failures show error toast |
| Headshot upload | Select a talent → `Upload` headshot | Image shows; stored at `images/talent/{id}/headshot.webp` |
| Remove headshot | Select a talent with headshot → `Remove` → confirm | Headshot removed from doc and storage (best-effort) |
| Project link | Select a talent → Projects → Add to project | `projectIds` updates; tag appears |
| Mobile reader | Open `/library/talent` on mobile viewport | Browse + detail works; create/edit/upload disabled |
