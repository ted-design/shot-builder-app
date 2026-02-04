# PROOF — FOCUS-TALENT-2026-02-04-A

Date: 2026-02-04

## Goal

Make `/library/talent` a producer-grade casting workspace:
- Fast browse + search
- Create talent
- Inline edit core fields
- Measurements + notes captured reliably
- Headshot upload supported (Storage rules compatible)
- Portfolio gallery: multi-image upload + captions + ordering
- Castings/auditions: grouped images + notes per session
- Mobile is read-only but fully viewable

## Contract

- Talent docs: `clients/{cid}/talent/{talentId}`
- Headshots stored under `images/talent/{talentId}/headshot.webp`
- Portfolio images stored under `images/talent/{talentId}/gallery/{imageId}.webp`
- Casting images stored under `images/talent/{talentId}/casting/{sessionId}/{imageId}.webp`
- `projectIds?: string[]` links talent to projects (membership)
- `galleryImages[]` stores portfolio images (legacy-compatible)
- `castingSessions[]` stores casting sessions (embedded on talent doc)

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
| Upload portfolio | Select a talent → Portfolio → Upload images | Images appear in grid; captions editable; drag reorder persists |
| Remove portfolio image | Portfolio → remove image → confirm | Image removed from doc and storage (best-effort) |
| Create casting | Castings → Add casting → set date/title → Add | Session appears; can open it |
| Add casting notes | Open a casting → edit notes → blur | Notes persist |
| Upload casting images | Open a casting → Upload | Images appear under that casting; captions + reorder persist |
| Delete casting | Open casting → Delete | Session removed; images deleted (best-effort) |
| Mobile reader | Open `/library/talent` on mobile viewport | Browse + detail works; create/edit/upload disabled |
