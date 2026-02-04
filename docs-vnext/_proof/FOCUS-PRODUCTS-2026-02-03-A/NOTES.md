# Notes — FOCUS-PRODUCTS-2026-02-03-A

## Decisions

- Product Library vNext slice is explicitly specced (missing before this run) to prevent accidental scope creep and to keep “mobile read-only” constraints enforceable.
- vNext product mappers accept legacy aliases (`colorName`/`name`, `hexColor`/`colourHex`, `productType`/`category`) to avoid runtime failures from mixed historical data.
- vNext list browsing is URL-driven (query params) rather than legacy localStorage presets to keep state shareable and debuggable.
- vNext explicitly rejects `/products` SKU fan-out; `/products` remains a single-subscription surface to preserve performance trust.
- SKU sizes treat blank as “inherit family sizes” to match legacy editing expectations and avoid accidentally storing empty sizes.
- Product family delete/restore is implemented as soft-delete (`deleted`, `deletedAt`) to avoid destructive data loss while still removing items from default pickers.

## Tradeoffs

- Product timestamps are normalized best-effort (Timestamp, {seconds,nanoseconds}, ms number, ISO string). Invalid values become `undefined` rather than throwing, prioritizing UI resilience.
- vNext skips legacy inline table editing and batch operations for now to avoid accidental writes and to keep the slice small and trustworthy.

## Follow-ups (explicitly out of scope)

- Product import tooling (`/import-products`) in vNext.
- Product “workspace” sections (samples/assets/activity) from legacy ProductDetailPageV3.

## Legacy notes (context for future decisions)

- Legacy product list optimized producer throughput with density + batch flows, but introduced N+1/SKU fan-out risk and higher accidental-write risk (blur-to-save).
- Legacy product detail was a “workspace viewer” and not real-time; vNext should prefer real-time subscriptions for trust unless there’s a measured reason not to.
