# PROOF — FOCUS-PALETTE-2026-02-04-A

Date: 2026-02-04

## Goal

Ship producer-grade palette (color swatches) management:
- View org swatches on mobile (Reader)
- Create + edit swatches on desktop (Producer/Admin)
- Delete swatches on desktop (Admin-only)

## Contract

- Swatches live at `clients/{cid}/colorSwatches/{swatchId}`
- `swatchId` is a stable key (derived at create-time; legacy-compatible)
- `hexColor` must be `#RRGGBB` when present

## Verification

### Automated (required)
- `npm test` — PASS
- `npm run lint` — PASS (0 warnings)
- `npm run build` — PASS

### Manual QA Required

⚠️ Chrome extension unavailable in this environment for visual verification.

| Scenario | Steps | Expected |
|---------|-------|----------|
| View palette on mobile | Open `/library/palette` on a mobile viewport | Swatches render read-only; editing disabled with clear note |
| Create swatch | Desktop `/library/palette` → New swatch → enter name + hex → `Create` | Swatch appears in list; toast success |
| Edit name | Desktop `/library/palette` → click swatch name → edit → blur | Name updates; toast success |
| Edit hex | Desktop `/library/palette` → click hex → enter `#RRGGBB` → blur | Preview updates; invalid hex shows inline error |
| Producer delete gate | Login as Producer → `/library/palette` | Delete actions are not shown |
| Admin delete | Login as Admin → `/library/palette` → Delete → confirm | Swatch doc removed; toast success |
