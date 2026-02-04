# Slice — Palette (Color Swatches, org-scoped)

## Why this exists

Producers need a single, trustworthy color vocabulary for products (“Olive”, “Ecru”, “Charcoal”) so:
- Product colorways stay consistent across teams and seasons
- Exports (pull sheets, call sheets, PDFs) can reference stable color labels
- The system avoids drift (“Off white”, “Off-White”, “Offwhite”)

## Data contract (no schema change)

Swatches are stored as org-level documents:

- Collection: `clients/{cid}/colorSwatches/{swatchId}`
- `swatchId` is a stable key (legacy convention: equals `colorKey`)

Recommended fields (legacy-compatible):
- `name: string` (required)
- `colorKey: string` (should equal `swatchId`)
- `normalizedName: string` (lowercased, trimmed)
- `hexColor?: string | null` (`#RRGGBB`, optional)
- `aliases?: string[]` (optional)
- `swatchImagePath?: string | null` (optional; not required for v1)
- `createdAt`, `updatedAt` (timestamps; legacy may contain epoch ms)

## User workflows

Route: `/library/palette`

### 1) View palette (mobile-safe)
- Mobile renders a read-only grid of swatches
- Editing is disabled and explained (“Editing is available on desktop”)

### 2) Create swatch (desktop)
- Add a new swatch with `name` and optional `hexColor`
- `swatchId` is derived from `name` (normalized key)

### 3) Edit swatch (desktop)
- Inline edit `name` and `hexColor`
- Swatch id remains stable; edits update the existing document

### 4) Delete swatch (desktop, admin-only)
- Destructive confirmation required
- Delete is gated by role (Firestore rules enforce admin-only)

## Safety / trust rules

- No silent failures: create/edit/delete show explicit success/failure feedback.
- No optimistic create: the UI only resets the “New swatch” form after the Firestore write resolves.
- Hex validation: only `#RRGGBB` accepted; invalid values are rejected with visible feedback.
- Mobile is **Reader** (not desktop-only): palette remains accessible on-set for reference.

