# Notes — FOCUS-PRODUCTS-2026-02-04-A

## Decisions

- Treat “transparent popups/modals” as a **blocking trust defect** (filters, editors, confirmations are unreadable).
- Fix the root cause in vNext UI primitives and Tailwind semantic tokens (no per-feature hacks).
- Implement Products list view switching + field visibility as **producer-throughput features** (calm density) without reintroducing legacy batch-write risk.

## Tradeoffs

- View mode is primarily a **user preference** (not domain data); we persist it locally and keep URL state for filters shareable.
- Category scaffolding is derived from existing fields (`gender`, `productType`, `productSubcategory`). Mixed historical values are normalized best-effort; we prefer resilience over strict enforcement.

## Follow-ups (explicitly out of scope)

- Product workspace features from legacy (samples/supply tracking, comments/discussion, notes, documents) require an explicit vNext slice spec and a data contract review before shipping.
