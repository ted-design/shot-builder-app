# Proof — FOCUS-SHOTS-2026-02-04-D

**Domain:** SHOTS (Shot Editor — Active Look Cover)  
**Focus ID:** FOCUS-SHOTS-2026-02-04-D  
**Date:** 2026-02-04  

## Goal

Restore a producer-grade “Active look” concept:
- A shot can have multiple looks (Primary + alternates)
- One look can be marked **Active**
- The **shot cover/hero image follows the Active look** (so list cards, tables, and downstream surfaces stay deterministic)

## Key Decisions (Trust > Parity)

- **Persisted, not local.** Active look is stored on the shot document as `activeLookId` so the cover shown across the app is stable across users/devices and is export-safe.
- **Per-look cover allowed.** Each look may have its own `displayImageId`; the effective cover is derived from the **active** look first.
- **Safe fallback.** If the active look has no usable cover/hero/reference, cover derivation falls back to the existing scan order so the shot still has a reasonable cover instead of going blank.

## Contract (Firestore)

- `shot.activeLookId?: string | null`
  - Optional.
  - When set to a valid look id, cover derivation prioritizes that look.
  - If null/absent/invalid, cover derivation falls back to existing rules.

## What Shipped

### 1) Cover derivation prefers Active look

`mapShot` cover priority:
1) `shot.heroImage` manual override
2) Active look: `displayImageId` → `heroProductId` → first reference
3) Fallback across all looks: `displayImageId` → `heroProductId` → first reference
4) Legacy attachments / legacy single image fields

### 2) Shot Detail UI: select Active look

- Look tabs show an **Active** badge for the look currently driving the cover.
- A “Make active” action sets `activeLookId` for the shot.
- Reference “Cover” badge is explicit:
  - `Cover (active)` when the selected look is active
  - `Cover set` when a non-active look has a cover configured

## Touched Files

- `src-vnext/shared/types/index.ts`
- `src-vnext/features/shots/lib/mapShot.ts`
- `src-vnext/features/shots/lib/mapShot.test.ts`
- `src-vnext/features/shots/components/ShotLooksSection.tsx`

## Automated Checks (2026-02-04)

- `npm run test` ✅
- `npm run lint` ✅ (0 warnings)
- `npm run build` ✅

## Manual QA Required

⚠️ **Chrome extension unavailable** for visual verification in this session.

| Scenario | Steps | Expected |
|---|---|---|
| Set Active look | Shot Detail → Looks → select Alt tab → “Make active” | Tab shows “Active” badge; refresh keeps active |
| Cover follows active | Give Primary a cover ref; make Alt active with a different cover ref | Shot card/table cover matches active look’s cover |
| Active fallback behavior | Make a look active that has no refs/hero; ensure another look has a cover | Shot still shows a cover (fallback) rather than blank |
| Delete active look | Make an Alt active → delete it | Active look moves to Primary; cover follows new active |
| Cover per look | Set cover on Primary and Alt | Switching active swaps which cover is used |

**User Action:** Run `npm run dev` and verify scenarios above.
