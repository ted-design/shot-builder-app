# Slice — Tag Management (Project-scoped, schema-free)

## Why this exists

Tags are a high-leverage way producers communicate intent (“High Priority”, “Video”, “Men”) and slice the shot list under pressure.

vNext must support:
- Assigning tags to shots (creation + reuse)
- Managing tags across the project (rename, recolor, merge, delete)

## Data contract (no schema change)

Tags are **embedded on shot documents**:

- Collection: `clients/{cid}/shots/{sid}`
- Field: `tags?: [{ id: string; label: string; color: string }]`

There is **no** `clients/{cid}/tags` collection.

### Default tags

vNext ships a small default set (priority/gender/media) that appears in pickers and tag management with `usageCount = 0` until used.

Color values may be:
- A **color key** (legacy): `red`, `amber`, `emerald`, etc.
- A CSS color string (legacy/unknown): allowed, rendered as an outline fallback

## User workflows

### 1) Assign tags on a shot
- Shot Detail → Tags → add existing tags or create a new tag
- Saving updates the shot’s `tags` array (versioned via existing shot versioning)

### 2) Manage tags for the project (desktop only)
Route: `/projects/:id/tags`

Actions:
- Rename tag (updates tag label on all shots that contain it)
- Recolor tag (updates tag color on all shots that contain it)
- Merge tags (replaces merged tags with a single target tag across all shots)
- Delete tag (removes the tag from all shots)

## Safety / trust rules
- Desktop-only surface: mobile redirects to `/projects/:id/shots` with a toast.
- Bulk operations chunk writes to respect Firestore batch limits.
- All tag operations show explicit success/failure feedback.
- Default tags cannot be deleted.

