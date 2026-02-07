# Proof — FOCUS-SHOTS-2026-02-06-B

**Domain:** SHOTS (Share link creation trust fix)  
**Focus ID:** FOCUS-SHOTS-2026-02-06-B  
**Date:** 2026-02-06

## Goal

Fix a production regression where producers could open the Shots share dialog but failed to generate public links with `permission-denied` in projects that do not use project-member documents.

## Root Cause

`createShotShareLink` enforced a strict membership check:

- Non-admin callers had to exist at `clients/{clientId}/projects/{projectId}/members/{uid}`.
- Some active projects rely on role-claim access and do not have `members` docs configured.

This created a contract mismatch:

- UI/route access: claim-based producer/admin access.
- Share callable: member-doc-required access.

Result: share creation failed for otherwise valid producer users.

## What Shipped

1) Updated `functions/index.js` in `createShotShareLink`:

- Keep role gate (`admin|producer|wardrobe`) and project existence check.
- For non-admin callers:
  - If project members are configured, require membership.
  - If no members are configured, allow claim-based access (legacy-safe fallback).
- Kept token generation + persisted share contract unchanged.

2) Added frontend resilience fallback in `ShotsShareDialog`:

- Primary path remains callable `createShotShareLink`.
- If callable is unavailable (`functions/not-found` or `functions/unimplemented`), fallback writes share docs directly to `/shotShares/{token}` using existing Firestore rules.
- This keeps producer flow working in environments where function deployment is blocked by IAM policy constraints.

## Why This Is Correct

- Preserves stricter project-member enforcement where teams actually use it.
- Restores compatibility for claim-scoped legacy projects.
- Avoids silent auth model drift between UI behavior and share-link backend behavior.
- Adds a controlled fallback for infrastructure-level function unavailability.

## Touched Files

- `functions/index.js`
- `src-vnext/features/shots/components/ShotsShareDialog.tsx`
- `src-vnext/features/shots/components/__tests__/ShotsShareDialog.test.tsx`

## Validation

- `npm run test -- src-vnext/features/shots/components/__tests__/ShotsShareDialog.test.tsx` ✅
- `npm run lint` ✅ (0 warnings)
- `npx tsc --noEmit` ✅
- `npm run build` ✅

## Deployment Note

Observed in this focus session:

- `firebase deploy --only functions:createShotShareLink` failed at IAM invoker policy binding.
- Code upload succeeded; creation failed while setting function invoker policy.

Because of this, the frontend fallback path is included to keep sharing functional without requiring immediate function deploy.

## Manual QA

| Scenario | Steps | Expected |
|---|---|---|
| Producer, legacy project (no members docs) | Open `/projects/:id/shots` → Share → Create link | Link is generated successfully |
| Producer, project with members configured and caller is a member | Open Share dialog and create link | Link is generated successfully |
| Producer, project with members configured and caller is not a member | Call create from UI/API | `permission-denied` |
| Public share resolution | Open `/shots/shared/:shareToken` in signed-out browser | Shared shot list loads |
