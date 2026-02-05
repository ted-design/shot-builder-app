# Proof — FOCUS-SHOTS-2026-02-04-H

**Domain:** SHOTS (Version History + Restore)  
**Focus ID:** FOCUS-SHOTS-2026-02-04-H  
**Date:** 2026-02-04  

## Goal

Track shot mutations with immutable version snapshots and allow producers to restore prior versions safely.

## What Shipped

### 1) Version snapshots on shot writes (best-effort)

- Shot status changes, hero changes, look changes, and Shot Detail edits now write a version doc under:
  - `clients/{clientId}/shots/{shotId}/versions/{versionId}`
- Version write failures never block the underlying shot update.

### 2) Shot Detail: History + Restore (calm, minimal UI)

- A collapsible **History** card lists recent versions (most recent first).
- Producer/admin (desktop-only) can restore a version via confirmation.
- A restore action writes a new `rollback` version entry.

## Contract

- Slice spec: `docs-vnext/slices/slice-5-shot-versions.md`
- Path builder: `src-vnext/shared/lib/paths.ts` (`shotVersionsPath`)
- Types: `src-vnext/shared/types/index.ts` (`ShotVersion`)

## Touched Files

- `src-vnext/shared/lib/paths.ts`
- `src-vnext/shared/types/index.ts`
- `src-vnext/features/shots/lib/shotVersioning.ts`
- `src-vnext/features/shots/lib/updateShotWithVersion.ts`
- `src-vnext/features/shots/hooks/useShotVersions.ts`
- `src-vnext/features/shots/lib/mapShotVersion.ts`
- `src-vnext/features/shots/components/ShotVersionHistorySection.tsx`
- `src-vnext/features/shots/components/ShotDetailPage.tsx`
- `src-vnext/features/shots/components/ShotStatusSelect.tsx`
- `src-vnext/features/shots/components/HeroImageSection.tsx`
- `src-vnext/features/shots/components/ShotLooksSection.tsx`
- `src-vnext/features/shots/components/CreateShotDialog.tsx`

## Automated Checks (2026-02-04)

- `npm run test` ✅
- `npm run lint` ✅ (0 warnings)
- `npm run build` ✅

## Manual QA Required

⚠️ Chrome extension unavailable for visual verification in this session.

| Scenario | Steps | Expected |
|---|---|---|
| Version created on edit | Open Shot Detail → change Title or Location | New History entry appears with updated timestamp + “Updated” summary |
| Version created on status change | Shot list or detail → change Status | New History entry appears |
| Restore | History → pick an older version → Restore | Shot fields update; new “Restored” (`rollback`) entry appears at top |
| Permissions | Log in as crew/viewer | History visible; Restore button hidden |
| Safety | Simulate version write failure (deny `versions` create) | Shot edit still succeeds; History may not update |

**User Action:** Run `npm run dev` and verify scenarios above.

