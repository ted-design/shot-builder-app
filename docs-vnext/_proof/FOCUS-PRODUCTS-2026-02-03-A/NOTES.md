# Notes — FOCUS-PRODUCTS-2026-02-03-A

## Decisions

- Product Library vNext slice is explicitly specced (missing before this run) to prevent accidental scope creep and to keep “mobile read-only” constraints enforceable.
- vNext product mappers accept legacy aliases (`colorName`/`name`, `hexColor`/`colourHex`, `productType`/`category`) to avoid runtime failures from mixed historical data.

## Tradeoffs

- Product timestamps are normalized best-effort (Timestamp, {seconds,nanoseconds}, ms number, ISO string). Invalid values become `undefined` rather than throwing, prioritizing UI resilience.

## Follow-ups (explicitly out of scope)

- Product import tooling (`/import-products`) in vNext.
- Product “workspace” sections (samples/assets/activity) from legacy ProductDetailPageV3.

