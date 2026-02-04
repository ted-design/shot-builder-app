# Proof — FOCUS-SHOTS-2026-02-04-E

**Domain:** SHOTS (Shot Editor — Looks)  
**Focus ID:** FOCUS-SHOTS-2026-02-04-E  
**Date:** 2026-02-04  

## Problem

Opening a Shot Detail page could hit the error boundary with:
> `A <Select.Item /> must have a value prop that is not an empty string`

This prevented the page from rendering (“Something went wrong”).

## Root Cause

In `ShotLooksSection`, the “No hero product” option used:
- `<SelectItem value="">No hero product</SelectItem>`

Radix Select reserves the empty string as a special “clear selection / show placeholder” state and **forbids** using `""` as an item value.

## Fix

- Replace the empty-string item value with a sentinel value (`"__none__"`).
- Map the sentinel to/from `heroProductId: null` in state/writes.
- Add a regression test that renders the hero-product select without throwing.

## Touched Files

- `src-vnext/features/shots/components/ShotLooksSection.tsx`
- `src-vnext/features/shots/components/__tests__/ShotLooksSection.test.tsx`

## Automated Checks (2026-02-04)

- `npm run test` ✅
- `npm run lint` ✅ (0 warnings)
- `npm run build` ✅

## Manual QA Required

| Scenario | Steps | Expected |
|---|---|---|
| Load shot detail | Open any shot with Looks enabled | No error boundary |
| Hero product unset | In a look with products, open the hero select | “No hero product” visible; no crash |
| Toggle hero | Select a hero product, then select “No hero product” | Hero clears (stored as null) |

