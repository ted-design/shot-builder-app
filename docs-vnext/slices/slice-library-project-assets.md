# Slice — Library Project Assets (Talent/Locations/Crew)

## Why this exists

Producers need a **project-scoped subset** of the org Library so pickers and downstream outputs (call sheets, exports) stay fast and trustworthy under pressure.

Legacy behavior (kept intentionally): a Library entity can belong to **zero or more projects**, and Project Assets is the surface where that membership is managed.

## User workflows

### 1) Add existing Library items to a project
- Producer opens `/projects/:id/assets`
- Chooses **Add** under Talent / Locations / Crew
- Selects one or more existing items from the org Library
- Items become “in project” immediately

### 2) Create new Library items from inside a project
- Producer opens `/projects/:id/assets`
- Chooses **New**
- Enters minimal info (name + optional metadata)
- Item is created in the org Library and **auto-assigned to the project**

### 3) Remove from project
- Producer removes an item from the project list
- If the item is referenced by shots, the UI prompts for confirmation
- Removing from the project does **not** delete the Library item

## Firestore contract

### Collections (existing)
- `clients/{cid}/talent/{tid}`
- `clients/{cid}/locations/{lid}`
- `clients/{cid}/crew/{crid}`

### Fields (existing / legacy-compatible)

Library docs may include:
- `projectIds?: string[]` — array of project document ids the item is included in

Writes:
- Add to project: `projectIds = arrayUnion(projectId)`
- Remove from project: `projectIds = arrayRemove(projectId)`
- Create inside project: `projectIds = [projectId]`

Audit fields on create/update:
- `createdAt`, `updatedAt` set via `serverTimestamp()`

## UX + safety rules
- Desktop-first editing; mobile is read-only (actions disabled).
- No “silent” failure paths: add/remove/create operations show success/failure toasts.
- Removal confirmation appears when the item is referenced by shots (prevents accidental picker breakage).

## Out of scope (intentionally)
- Full profile editing surfaces for Talent/Locations/Crew
- Project crew assignments (department/position per project)
- Tags / palette management

