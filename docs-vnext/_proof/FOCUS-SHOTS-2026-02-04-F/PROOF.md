# Proof — FOCUS-SHOTS-2026-02-04-F

**Domain:** SHOTS (Shot Detail + Shots List)  
**Focus ID:** FOCUS-SHOTS-2026-02-04-F  
**Date:** 2026-02-04  

## Goals

1) Remove redundant product editing surfaces on Shot Detail so producers only manage products inside **Look options**.
2) Prevent legacy HTML from leaking into the **Description** field display in vNext.

## What Shipped

### 1) Remove duplicate “Products” section on Shot Detail

- Shot Detail no longer renders a separate shot-level Products picker directly below Look options.
- Products are managed inside Look options (Primary/Alt looks).

### 2) Strip HTML from Description display (and edit start)

- Description is rendered as plain text derived from the stored string (HTML tags stripped + entities decoded).
- Editing starts from the same plain-text value so producers don’t see raw tags like `<p></p>`.
- This does not rewrite Firestore unless the user edits/saves the description.

## Touched Files

- `src-vnext/features/shots/components/ShotDetailPage.tsx`
- `src-vnext/features/shots/components/ShotListPage.tsx`
- `src-vnext/features/shots/components/__tests__/ShotDetailPage.test.tsx`

## Automated Checks (2026-02-04)

- `npm run test` ✅
- `npm run lint` ✅ (0 warnings)
- `npm run build` ✅

## Manual QA Required

| Scenario | Steps | Expected |
|---|---|---|
| No duplicate products | Open Shot Detail with Look options present | Only the Look options product editor exists (no second Products section below) |
| Description HTML stripped | Open a shot whose description is stored as HTML (e.g. `<p></p>` or `<p>Hello</p>`) | UI shows `No description`/placeholder or `Hello`, not raw tags |
| List table description | Shots list → Table view with “Description preview” enabled | Shows plain-text preview (no tags) |

