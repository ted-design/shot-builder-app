# Proof — FOCUS-SHOTS-2026-02-04-K

**Domain:** SHOTS (Backfill repair)  
**Focus ID:** FOCUS-SHOTS-2026-02-04-K  
**Date:** 2026-02-04  

## Goal

Backfill legacy shots that were created without a `date` field so they re-enter the shots list query (which orders by `date`).

## What Shipped

- On Shots list → Filters menu: **Repair missing shot dates**
  - Finds shots in the current project where `date` is missing and/or `deleted` is missing (skips `deleted == true`)
  - Writes `date: null` and/or `deleted: false` (only when missing), plus `updatedAt` (and `updatedBy` when available)
  - These shots then appear in the list immediately via the existing subscription

## Touched Files

- `src-vnext/features/shots/lib/backfillShotDates.ts`
- `src-vnext/features/shots/lib/backfillShotDates.test.ts`
- `src-vnext/features/shots/components/ShotListPage.tsx`
- `src-vnext/shared/components/ConfirmDialog.tsx`

## Automated Checks (2026-02-04)

- `npm run test` ✅
- `npm run lint` ✅ (0 warnings)
- `npm run build` ✅

## Manual QA Required

⚠️ Chrome extension unavailable for visual verification in this session.

| Scenario | Steps | Expected |
|---|---|---|
| Repair surfaces missing shots | Shots list → Filters → Repair missing shot dates → Repair | Previously-missing shots appear without refresh |
| No-op path | Run repair again | Toast says no shots needed repair |

**User Action:** Run `npm run dev` and verify scenarios above.
