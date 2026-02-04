# Slice — Talent Casting Workspace (Org Library)

## Why this exists

Casting work requires a calm but information-dense workspace that stays reliable under pressure:
- Browse faces quickly (headshot-first scanning)
- Store contact + agency details in one place
- Keep wardrobe-relevant measurements available for picks and outputs
- Link talent to projects for fast project-scoped asset selection

## Data contract (no schema change)

Talent lives at:
- `clients/{cid}/talent/{talentId}`

Legacy-compatible fields supported by this slice:
- `name: string` (required)
- `firstName?: string`, `lastName?: string` (optional legacy; display fallback only)
- `agency?: string | null`
- `email?: string | null`
- `phone?: string | null`
- `url?: string | null`
- `gender?: string | null`
- `notes?: string | null` (stored as plain text in vNext UI)
- `measurements?: Record<string, string | number> | null`
- `projectIds?: string[]` (org talent membership in projects)

Headshot fields (legacy-compatible):
- `headshotPath?: string | null` (Firebase Storage path; vNext uploads under `images/talent/{talentId}/headshot.webp`)
- `headshotUrl?: string | null` (optional denormalized URL)
- `imageUrl?: string | null` (legacy; vNext sets this to the same Storage path for compatibility)

## User workflows

Route: `/library/talent`

### 1) Browse talent (desktop + mobile)
- Gallery-style grid with search across name/agency/email/phone
- Selecting a tile opens a portrait-centric detail cockpit below

### 2) Create talent (desktop)
- “New talent” dialog creates a talent doc with minimal required info
- No optimistic create: the new profile appears after Firestore confirms the write

### 3) Edit talent (desktop)
- Inline edit for name + key contact fields
- Measurements and notes are editable with explicit validation-free inputs (producer speed)
- Errors are never silent (toast on failure)

### 4) Project linking (desktop)
- Add/remove project membership from the talent cockpit (`projectIds` array)

### 5) Mobile reader mode
- All editing is disabled on mobile; details remain visible and scannable

## Safety / trust rules

- No blank states: empty, loading, error all have explicit UI.
- No silent failures: write failures show errors and preserve current view.
- Storage path is consistent with existing rules (`/images/**`), avoiding new Storage rule changes.

