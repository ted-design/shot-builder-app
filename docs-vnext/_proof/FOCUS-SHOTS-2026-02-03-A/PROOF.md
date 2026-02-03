# Proof — FOCUS-SHOTS-2026-02-03-A

**Domain:** SHOTS  
**Focus ID:** FOCUS-SHOTS-2026-02-03-A  
**Date:** 2026-02-03  

## Governing docs (contract)

- `docs-vnext/design/experience-spec.md`
- `docs-vnext/engineering/build-strategy.md`
- `docs-vnext/engineering/architecture.md`
- `docs/claude-code-tooling.md`
- `docs-vnext/slices/slice-2-shot-editing.md`

## Packages log

### WP1 — Assigned products truth (union + dedupe)

**Spec alignment:** Aligned with `docs-vnext/slices/slice-2-shot-editing.md` (trust: “products assigned” must not contradict editor reality). No schema changes. No new Firestore reads.

**Change summary**
- Introduced a shared derivation for “assigned products” count that unions:
  - `shot.products[]` (legacy/direct)
  - `shot.looks[].products[]` (V3 editor)
  - fallback: `shot.productIds[]` only when no product objects exist
- Wired this count into:
  - Shot Editor V3 context counts (dock + mobile reader chips)
  - Shots “Visual Gallery” cards (product count line)

**Touched surfaces**
- `src/pages/ShotEditorPageV3.jsx`
- `src/pages/ShotsPage.jsx`
- `src/lib/shotAssignedProducts.js`
- `src/lib/__tests__/shotAssignedProducts.test.js`

**Checks (2026-02-03)**
- `npx tsc --noEmit` ✅
- `npm test` ✅

**Manual QA required (Chrome proof pending)**
⚠️ Chrome extension not available in this session for screenshots.

| Scenario | Steps | Expected |
|---|---|---|
| Look-only products show as assigned | Create/choose a shot where products exist only under `looks[].products` (not `shot.products`). Visit shot list + visual gallery + editor. | Counts show non-zero products everywhere. |
| Legacy products still count | Use a shot with only `shot.products`. | Counts match previous behavior. |
| Legacy `productIds` fallback counts | Use a shot with only `productIds` populated. | Counts show assigned products (even without full product objects). |

## Screenshots index

_Screenshots live in `docs-vnext/_proof/FOCUS-SHOTS-2026-02-03-A/images/`._
