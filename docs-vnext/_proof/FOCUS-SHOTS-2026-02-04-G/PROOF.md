# Proof — FOCUS-SHOTS-2026-02-04-G

**Domain:** SHOTS (Shot Detail)  
**Focus ID:** FOCUS-SHOTS-2026-02-04-G  
**Date:** 2026-02-04  

## Goal

Ship a producer-grade, timestamped comment thread on Shot Detail for team collaboration.

## What Shipped

- Shot Detail includes a **Comments** section backed by Firestore:
  - Real-time subscription to `clients/{clientId}/shots/{shotId}/comments`
  - Create comment (producer/admin/crew)
  - Soft-delete own comment with confirmation (`deleted: true`)
- Explicit UI states: loading, error, empty.

## Contract

- Path: `clients/{clientId}/shots/{shotId}/comments/{commentId}`
- Fields written: `body`, `createdAt`, `createdBy`, `createdByName`, `createdByAvatar`, `deleted`
- Security: existing Firestore rules enforce author ownership + immutable creator fields.

## Touched Files

- `src-vnext/shared/lib/paths.ts`
- `src-vnext/shared/types/index.ts`
- `src-vnext/features/shots/hooks/useShotComments.ts`
- `src-vnext/features/shots/lib/mapShotComment.ts`
- `src-vnext/features/shots/lib/shotCommentWrites.ts`
- `src-vnext/features/shots/components/ShotCommentsSection.tsx`
- `src-vnext/features/shots/components/ShotDetailPage.tsx`
- `src-vnext/features/shots/components/__tests__/ShotCommentsSection.test.tsx`
- `src-vnext/features/shots/components/__tests__/ShotDetailPage.test.tsx`
- `docs-vnext/slices/slice-4-comments-activity.md`

## Automated Checks (2026-02-04)

- `npm run test` ✅
- `npm run lint` ✅ (0 warnings)
- `npm run build` ✅

## Manual QA Required

⚠️ Chrome extension unavailable for visual verification in this session.

| Scenario | Steps | Expected |
|---|---|---|
| Empty comments | Open a shot with no comment docs | Comments card shows “No comments yet.” |
| Post comment | Type in Comments box → Post | Comment appears with author + timestamp; draft clears |
| Create failure | Temporarily deny writes (or simulate offline) → Post | Error toast; draft remains |
| Delete own comment | Click Delete → confirm | Comment body becomes “Deleted comment”; author/time still visible |
| Permissions | Log in as viewer | Comments are readable; composer hidden; “Read-only” badge shown |

**User Action:** Run `npm run dev` and verify scenarios above.

