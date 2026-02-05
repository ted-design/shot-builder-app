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

Portfolio gallery fields (legacy-compatible):
- `galleryImages?: {id,path,downloadURL?,description?,order?,cropData?}[]`

Casting / audition sessions (vNext, embedded on talent doc):
- `castingSessions?: {id,date,title?,projectId?,location?,brief?,decision?,rating?,notes?,images[]}[]`
  - `date` is `YYYY-MM-DD`
  - `projectId` is optional (does not imply `projectIds` membership)
  - `decision` is stored as a string from a controlled list (e.g. `pending|shortlist|hold|pass|booked`)
  - `rating` is optional and constrained to 1–5
  - `images[]` uses the same shape as `galleryImages`

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

### 3b) Portfolio gallery (desktop)
- Upload multiple images to the talent’s portfolio
- Add/edit captions per image
- Drag to reorder

### 3c) Casting / auditions (desktop)
- Create a casting session (date + optional title)
- Optional session metadata: project link, location, role/brief, decision, rating
- Store notes per session
- Upload + caption + reorder images within the session
- Each session acts as a time-scoped “bin” for reference under pressure

### 3d) Export casting contact sheet (desktop)
- From an expanded casting session, `Export PDF` opens the system print dialog (Save as PDF).
- Export includes: talent contact + headshot (if present), session metadata, notes, and an image grid with captions.

### 4) Project linking (desktop)
- Add/remove project membership from the talent cockpit (`projectIds` array)

### 5) Mobile reader mode
- All editing is disabled on mobile; details remain visible and scannable

## Safety / trust rules

- No blank states: empty, loading, error all have explicit UI.
- No silent failures: write failures show errors and preserve current view.
- Storage path is consistent with existing rules (`/images/**`), avoiding new Storage rule changes.
  - Portfolio images: `images/talent/{talentId}/gallery/{imageId}.webp`
  - Casting images: `images/talent/{talentId}/casting/{sessionId}/{imageId}.webp`
