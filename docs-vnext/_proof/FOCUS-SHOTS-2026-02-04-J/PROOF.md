# Proof — FOCUS-SHOTS-2026-02-04-J

**Domain:** SHOTS (Create Shot Persistence Trust)  
**Focus ID:** FOCUS-SHOTS-2026-02-04-J  
**Date:** 2026-02-04  

## Problem

Producer creates a shot, sees “created” toast, but the shot does not appear in the shots list even after refresh.

## Root Cause (Likely)

The shots list query orders by `date` (`orderBy("date", "asc")`). New shots created without a `date` field can be excluded from the query depending on Firestore ordering behavior.

## Fix

1) Ensure new shots always write `date: null` at creation time.
2) Add an “Open” action on the success toast so the user can jump directly to the created shot detail (even if list queries/filters temporarily hide it).

## Touched Files

- `src-vnext/features/shots/components/CreateShotDialog.tsx`
- `src-vnext/features/shots/components/ShotListPage.tsx`

## Automated Checks (2026-02-04)

- `npm run test` ✅
- `npm run lint` ✅ (0 warnings)
- `npm run build` ✅

## Manual QA Required

⚠️ Chrome extension unavailable for visual verification in this session.

| Scenario | Steps | Expected |
|---|---|---|
| Create shows in list | Shots list (no filters) → Create shot | Shot appears in list without refresh |
| Create open action | Create shot → click **Open** on toast | Navigates to shot detail |
| Create under filters | Apply status/search filters → Create shot | Toast offers **Show shot**; clears filters + navigates |

**User Action:** Run `npm run dev` and verify scenarios above.

