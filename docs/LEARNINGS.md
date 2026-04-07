# Learnings & Pitfalls Reference

A distilled reference of every significant error, pitfall, and hard-won lesson encountered during Production Hub vNext development (Sprints S8-S24). Each entry documents the problem, root cause, fix, and prevention strategy.

---

## 1. Firestore Rules

### 1.1 Missing field access throws — the `expiresAt` gotcha

**Problem:** Unauthenticated reads on `castingShares` documents were denied even though rules appeared correct.

**What went wrong:** The `createCastingShareLink` function omitted the `expiresAt` field from the document write. The security rule checked `resource.data.expiresAt == null`, expecting it to return `true` for missing fields.

**Root cause:** Firestore rules and JavaScript handle missing properties differently:

```
JavaScript:    obj.missingField       --> undefined    (undefined == null --> true)
Firestore:     resource.data.missing  --> ERROR        (rule evaluates to false/deny)
```

**Fix:** Always write optional fields with explicit `null`:

```javascript
// WRONG: omit the field
{ name: "Share Link", clientId: "abc" }

// CORRECT: explicit null
{ name: "Share Link", clientId: "abc", expiresAt: null }
```

**Prevention:**
- Compare write functions against rules: every field accessed in rules must be written by the create function.
- In rules, use defensive existence checks: `!('expiresAt' in resource.data) || resource.data.expiresAt == null || ...`
- Test unauthenticated reads with the Firebase CLIENT SDK (not Admin SDK or REST API) to catch this exact failure mode.

---

### 1.2 List vs Get split — `resource.data` in collection list queries

**Problem:** A `allow read` rule with `resource.data.*` conditions worked for single-document gets but silently denied list queries on the same collection.

**Root cause:** For Firestore list queries, `resource.data` is not available in the same way. Conditions on `resource.data` in a generic `allow read` rule will fail for list operations. Firestore evaluates rules per-document on list, but the query planner needs to prove the rule can be satisfied for ALL potential results.

**Fix:** Split `allow read` into separate `allow get` and `allow list` rules. Put `resource.data.*` conditions only in `allow get`. For `allow list`, use `request.auth`-based conditions or request query constraints.

**Prevention:** Never put `resource.data.*` conditions in `allow read` for collections that will be queried with `getDocs` or `onSnapshot` on a collection reference. Always test with actual collection list queries, not just single-doc reads.

---

### 1.3 `deleted != true` excludes docs WITHOUT the `deleted` field

**Problem:** A Firestore query `where("deleted", "==", false)` returned far fewer documents than expected.

**Root cause:** Documents that predate the soft-delete feature have no `deleted` field at all. Firestore's `where("deleted", "==", false)` only matches documents where `deleted` explicitly equals `false` -- it excludes documents where the field is entirely absent.

**Fix:** Remove the server-side Firestore `where` filter. Use client-side filtering instead:

```typescript
// WRONG: server-side filter
query(collectionRef, where("deleted", "==", false))

// CORRECT: client-side filter
const docs = snapshot.docs.filter(doc => doc.data().deleted !== true)
```

**Prevention:** Never use `where("field", "==", false)` for boolean fields that may be absent on older documents. Always filter client-side with `!== true` (which treats both `false` and `undefined` as "not deleted").

---

### 1.4 Comment subcollection authorId binding

**Problem:** Admin product merge needed to transfer comments from one product to another, but the `allow create` rule required `request.resource.data.createdBy == request.auth.uid`.

**Root cause:** The authorId binding on comment creation is a security measure to prevent impersonation, but it also blocks legitimate admin operations like transferring comments during a merge.

**Fix:** Added `|| isAdmin()` override to the product family comment `allow create` rule. This enables comment transfer during admin merge operations while preserving the binding for normal users.

**Prevention:** When designing subcollection rules with author binding, consider whether admin override operations will be needed. Add `|| isAdmin()` proactively if admin data management is a known requirement.

---

### 1.5 `keys().hasOnly()` for field validation on unauthenticated writes

**Problem:** Unauthenticated vote submissions on casting shares could potentially inject arbitrary fields into the document.

**Root cause:** Without field validation, any client can add unexpected fields to a Firestore document, potentially corrupting data or enabling future exploits.

**Fix:** Use `request.resource.data.keys().hasOnly([...])` on create and update rules to whitelist allowed fields:

```
allow create: if request.resource.data.keys().hasOnly(
  ['reviewerEmail', 'reviewerName', 'talentId', 'decision', 'comment', 'createdAt']
);
```

**Prevention:** All unauthenticated or low-trust write rules must include `keys().hasOnly()` validation. Also enforce immutability on update by checking that sensitive fields haven't changed: `request.resource.data.reviewerEmail == resource.data.reviewerEmail`.

---

### 1.6 User doc CREATE rule blocking admin invites

**Problem:** Admin users could not invite existing Firebase Auth users because the user doc CREATE rule was self-only (`request.auth.uid == userId`).

**Root cause:** When an admin invites a user who already has a Firebase Auth account but no Firestore user document, the admin's invite flow needs to create the user doc on their behalf.

**Fix:** Changed the rule to `isAdmin() || (isAuthed() && request.auth.uid == userId)`.

**Prevention:** When designing document creation rules, always consider admin flows that may need to create documents on behalf of other users.

---

### 1.7 Rules must align with rbac.ts

**Problem:** Firestore write rules for shots were tightened to `isAdmin() || isProducer()`, but crew users have `canManageShots` in `rbac.ts`.

**Root cause:** The RBAC system in the app and the Firestore security rules were not in sync. The TypeScript RBAC allows crew to manage shots, but the rules would have denied those writes.

**Fix:** Shots use `isAuthed()` for write access. Talent and locations use `isAdmin() || isProducer()`.

**Prevention:** Always grep `canManage*` and `canEdit*` in `rbac.ts` before changing Firestore write rules. The rules must be at least as permissive as the client-side RBAC.

---

## 2. Firestore Writes

### 2.1 `writeBatch` limit: 500 operations

**Problem:** Bulk operations (shot creation, tag dedup migration, bulk delete) failed silently or threw when exceeding 500 operations per batch.

**Root cause:** Firestore's `writeBatch` has a hard limit of 500 operations per commit.

**Fix:** Chunk operations at 250 documents (leaving room for related writes like version snapshots):

```typescript
const BATCH_CHUNK_SIZE = 250

for (let i = 0; i < docs.length; i += BATCH_CHUNK_SIZE) {
  const batch = writeBatch(db)
  const chunk = docs.slice(i, i + BATCH_CHUNK_SIZE)
  chunk.forEach(doc => batch.update(doc.ref, updates))
  await batch.commit()
}
```

**Prevention:** Always chunk at 250, not 500. The remaining 250 ops are headroom for related writes (parent doc updates, version snapshots). Skip version snapshots on bulk operations entirely.

---

### 2.2 `merge: true` overwrites ALL specified fields

**Problem:** `setDoc(ref, { lastSignInAt: timestamp }, { merge: true })` was overwriting creation-only fields that happened to be included in the update object.

**Root cause:** `merge: true` merges at the top level, but every field in the data object is written. If you accidentally include fields like `createdAt` or `createdBy` in the object, they get overwritten.

**Fix:** Use `mergeFields` array to explicitly list which fields to update:

```typescript
// WRONG: merge:true writes ALL specified fields
setDoc(ref, { name, email, createdBy, lastSignInAt }, { merge: true })

// CORRECT: mergeFields limits which fields are written
setDoc(ref, { lastSignInAt }, { merge: true })

// OR: use updateDoc when you don't need upsert behavior
updateDoc(ref, { lastSignInAt })
```

**Prevention:** Prefer `updateDoc` over `setDoc(merge: true)` for updates. Use `setDoc(merge: true)` only for upserts. When using merge, keep the data object minimal -- only include fields you intend to change.

---

### 2.3 `setDoc(merge: true)` can create documents without required fields

**Problem:** `useExportReports.ts` used `setDoc(merge: true)` for saves, which could accidentally CREATE a document without the `createdBy` field if the document didn't already exist.

**Root cause:** `setDoc(merge: true)` is an upsert -- it creates the document if it doesn't exist. If the update payload doesn't include all required fields (like `createdBy`), the created document is incomplete.

**Fix:** Changed from `setDoc(merge: true)` to `updateDoc`, which fails if the document doesn't exist rather than creating an incomplete one.

**Prevention:** Use `updateDoc` for save paths where the document must already exist. Reserve `setDoc(merge: true)` for intentional upserts where you handle the creation case.

---

### 2.4 Denormalized fields must have write paths

**Problem:** `sampleCount`, `samplesArrivedCount`, `earliestSampleEta` were defined in TypeScript types, mapped in the reader (`mapProduct.ts`), and consumed by UI, but **never written by any vNext code**. Every product had `undefined` for these fields.

**Root cause:** The type definition and reader mapping were added without corresponding write paths in the CRUD functions. The fields existed in the type system and the UI consumed them, but nothing ever populated them in Firestore.

**Fix:** Added atomic batch writes in `createProductSample()` and `updateProductSample()` that sync these fields to the family doc. Also ran a backfill migration for existing data.

**Prevention:**
- When adding a new denormalized field, add the write path IN THE SAME PR as the type definition.
- Before consuming a denormalized field, grep for `updateDoc`/`setDoc`/`batch.update` that writes the field name. If no write path exists, the field is orphaned.
- After adding new denormalized fields, run a backfill migration for existing data.

---

### 2.5 `serverTimestamp()` for all timestamp fields

**Problem:** Client-created timestamps (`new Date()`, `Timestamp.now()`) can drift from server time, causing inconsistent ordering.

**Root cause:** Client clocks may be inaccurate. Firestore's `serverTimestamp()` uses the server's authoritative clock.

**Fix:** Always use `serverTimestamp()` for `createdAt` and `updatedAt` fields:

```typescript
import { serverTimestamp } from 'firebase/firestore'

const data = {
  ...fields,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
}
```

**Prevention:** Use `serverTimestamp()` for all timestamp fields that represent "when this action happened." Only use client-side dates for user-input fields (launch dates, scheduled dates).

---

### 2.6 Version snapshots: best-effort, never blocking

**Problem:** Version snapshot creation could fail and block the core write operation.

**Root cause:** Version writes are secondary to the actual data write. If the version subcollection write fails (permissions, quota, network), the user's primary action should still succeed.

**Fix:** Fire-and-forget pattern:

```typescript
// Version write never blocks core write
void createProductVersionSnapshot({ ... }).catch(err =>
  console.error('Version snapshot failed:', err)
)
```

**Prevention:** All version/audit trail writes use the fire-and-forget pattern. Skip version snapshots entirely on bulk operations (too many writes, diminishing value).

---

## 3. Data Modeling

### 3.1 Fix data inconsistencies at the ingestion boundary

**Problem:** Tags with the same label ("Men") had different IDs across different shots, causing duplicates in the tag manager and incorrect filter counts.

**Root cause:** Each shot's gender tag was generated with `crypto.randomUUID()`, so identical labels got different IDs. The initial fix attempt patched individual consumers (`useAvailableTags`, `TagManagementPage`, `TagEditor`), but that was O(n) work with O(n) risk of missing a consumer.

**Fix:** Fixed at the Firestore-to-React boundary in `mapShot.ts`:

```typescript
// mapShot.ts
function normalizeTags(tags: ShotTag[]): ShotTag[] {
  return tags.map(tag => canonicalizeTag(tag))
}
```

ALL downstream consumers automatically get canonical IDs -- no per-consumer dedup needed.

**Prevention:** When you encounter data inconsistency issues:
1. Trace the data flow back to the ingestion point (`mapShot`, `mapProduct`, etc.)
2. Fix there once
3. Keep consumer-side changes as defense-in-depth, not the primary fix
4. Write a migration script to clean up existing Firestore data for permanent resolution

---

### 3.2 SKU vs family granularity -- shots reference specific colorways

**Problem:** The "Reqs" column on a shot showed "3 needed" meaning 3 SKUs across the whole family had requirements, not that the specific colorway assigned to the shot needed 3 things.

**Root cause:** The initial implementation used family-level aggregates (`activeRequirementCount`) for shot-level display. But shots reference specific colorways via `ProductAssignment.skuId`.

**Fix:** Added `useHeroProductData` hook that batch-loads SKU + sample docs via one-time `getDocs`. `computeShotReadiness` now resolves per-SKU requirements and samples.

**Prevention:** Whenever displaying product metadata (requirements, samples, launch dates) in a shot context:
1. Check if `ProductAssignment.skuId` is present
2. If yes, load the specific SKU doc and show its data
3. If no, fall back to family-level aggregates
4. Family-level denormalized fields are for dashboard widgets, not shot-level display

---

### 3.3 Denormalize names for fallback display

**Problem:** When a talent is deleted after being cast in a shot, the shot's talent reference becomes a dangling ID with no name to display.

**Root cause:** The shot only stored `talentId`, relying on a live join to the talent doc. When the talent doc is soft-deleted or removed, the join returns nothing.

**Fix:** Denormalize `talentName` onto the casting board entry and shot assignments. If the talent doc is unavailable, the denormalized name provides a fallback.

**Prevention:** For any entity that references another entity by ID, store a denormalized display name alongside the ID. This is especially critical for entities that can be deleted (talent, products, locations).

---

### 3.4 Launch date fallback misleads users

**Problem:** When a colorway had no specific launch date, the system fell back to the family's `earliestLaunchDate`, which could be from a completely different colorway that was already shot.

**Root cause:** Family `earliestLaunchDate` is an aggregate across ALL colorways. Using it as a fallback for a specific colorway implied that colorway had a launch date, when it didn't.

**Fix:** Per user decision: if a colorway does NOT have a specific launch date, show NO date. Do not fall back to the family aggregate.

**Prevention:** Denormalized aggregates on parent documents are for aggregate views (dashboards, widgets). Never use them as fallbacks for child-level display where the absence of data is meaningful.

---

### 3.5 Check if import scripts already write the data before proposing new fields

**Problem:** The architect agent proposed 3 new Firestore fields + a migration script for `styleNumbers` data.

**Root cause:** The `styleNumbers` field was already being written to Firestore by the import script. The TypeScript type definition hadn't been updated to reflect what was actually in the documents.

**Fix:** Formalized the existing TypeScript type to match what was already in Firestore. Zero new fields, zero migration, 7 files changed instead of 13.

**Prevention:** Before proposing new Firestore fields:
1. Check if import scripts, legacy code, or Cloud Functions already write the data
2. Query Firestore directly to see what fields exist on actual documents
3. TypeScript types may lag behind what's actually in documents

---

### 3.6 Computed values: compute at render time, never store

**Problem:** The architect proposed storing a `sizeRangeSummary` field to avoid recomputation.

**Root cause:** Over-engineering. `compressSizeRange()` is a pure function that takes microseconds to compute from existing `sizeOptions[]` data.

**Fix:** Compute at render time with a pure function. No new fields, no migration.

**Prevention:** If a display value is a pure function of existing data, compute it at render time. Only denormalize when the computation requires fan-out queries (loading subcollections) or is genuinely expensive.

---

## 4. Deployment & CI

### 4.1 Production asset staleness after deploy

**Problem:** After merging multiple PRs, the production site showed blank pages on lazy-loaded routes. Browser console showed 404s for JS chunk files.

**Root cause:** Vite generates content-hashed filenames. When multiple PRs merge in quick succession, each triggers a separate CI build+deploy. If the CDN serves a cached `index.html` that references chunk filenames from a previous build, those chunks no longer exist.

**Fix:** Manually run `firebase deploy --only hosting` from the latest main.

**Prevention:**
1. After deploying, verify with `curl -s <url> | grep 'index-'` to confirm the served `index.html` matches the expected build.
2. For critical features (new public pages), test the production URL immediately after deploy.
3. Consider adding a post-deploy verification step to CI that checks the live site's hash.

---

### 4.2 CI test pool configuration mismatch

**Problem:** CI tests timed out at 26+ minutes while passing locally in 3 minutes.

**Root cause:** `scripts/run-vitest.cjs` forced `--pool threads --singleThread` on ALL environments. This wrapper exists for a macOS-specific tinypool bug with paths containing spaces. On CI (Linux), the override was unnecessary and made tests materially slower.

**Fix:** The wrapper now checks `process.env.CI` and only applies the pool override locally:

```javascript
if (!process.env.CI) {
  args.push('--pool', 'threads', '--poolOptions.threads.singleThread')
}
```

**Prevention:** When CI tests are slow but pass locally (or vice versa), check whether the test runner configuration differs between environments. Don't just increase timeouts -- find the root cause.

---

### 4.3 Firestore rules and composite indexes deploy separately

**Problem:** A new query with composite index requirements returned zero results in production even though rules and hosting were deployed.

**Root cause:** `firebase deploy --only hosting` does not deploy Firestore rules or indexes. These are separate deploy targets.

**Fix:** Deploy rules and indexes explicitly:

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only hosting
```

**Prevention:** After adding new Firestore queries with composite conditions, always deploy indexes before the hosting build that uses them. Add composite indexes to `firestore.indexes.json` and deploy with `firebase deploy --only firestore:indexes`.

---

## 5. GitHub Actions & CI YAML

### 5.1 Heredoc content indentation in `run: |` blocks

**Problem:** GitHub Actions workflow failed to parse a multi-line command that used a heredoc inside a `run: |` block.

**Root cause:** Heredoc content inside a YAML `run: |` block must be consistently indented relative to the block, and the heredoc delimiter must not be indented.

**Prevention:** Test workflow changes in a branch PR before merging. For complex multi-line commands, prefer writing a shell script and calling it from the workflow.

---

### 5.2 `secrets.*` in job-level `if` causes workflow errors

**Problem:** Using `secrets.SOME_SECRET` in a job-level `if:` condition caused a cryptic "workflow file issue" error.

**Root cause:** GitHub Actions has restrictions on where `secrets` context can be referenced. Job-level `if:` conditions cannot directly access secrets.

**Fix:** Use `vars.*` or environment variables instead, or move the condition to a step-level `if:`.

**Prevention:** Only reference `secrets.*` inside step-level `env:` or `run:` blocks, not in job-level `if:` conditions.

---

### 5.3 Firebase emulators require Java 21+

**Problem:** Firebase emulator suite failed to start in CI with a cryptic Java version error.

**Root cause:** Recent Firebase emulator versions require Java 21 or later. The CI runner had an older Java version.

**Fix:** Add a Java setup step to the workflow:

```yaml
- uses: actions/setup-java@v4
  with:
    distribution: 'temurin'
    java-version: '21'
```

**Prevention:** Pin the Java version in CI workflows. When upgrading Firebase tools, check the emulator's Java requirements.

---

## 6. Authentication & Auth

### 6.1 `revokeRefreshTokens` -- NEVER on the requesting user

**Problem:** Calling `revokeRefreshTokens(uid)` on the requesting user's own UID during a deactivation flow caused the admin to be logged out immediately.

**Root cause:** `revokeRefreshTokens` invalidates ALL refresh tokens for the given UID. If the admin deactivates their own account or the function mistakenly targets the caller's UID, the admin's session is destroyed.

**Fix:** Always validate that the target UID is not the requesting user's UID before revoking tokens.

**Prevention:** Add a guard at the top of any token revocation flow:

```typescript
if (targetUid === requestingUid) {
  throw new Error('Cannot revoke tokens for the requesting user')
}
```

---

### 6.2 `onSnapshot` must always have an error callback

**Problem:** Firestore subscriptions silently broke when permissions changed or the user's session expired. The UI showed stale data with no error indication.

**Root cause:** `onSnapshot` without an error callback swallows permission errors. The subscription dies but the component doesn't know.

**Fix:** Always pass both success and error callbacks:

```typescript
const unsubscribe = onSnapshot(
  query,
  (snapshot) => {
    // handle data
  },
  (error) => {
    console.error('Subscription failed:', error)
    // show error state in UI
  }
)
```

**Prevention:** Lint or code review for any `onSnapshot` call that doesn't have an error callback. Consider a wrapper hook that enforces this pattern.

---

### 6.3 `normalizeGender` must handle all conventions

**Problem:** `normalizeGender()` only handled "men"/"women" but the UI stores gender as "male"/"female". Talent set via the UI got wrong measurement display groups.

**Root cause:** Different parts of the system used different gender conventions. Import scripts used "men"/"women", the UI form stored "male"/"female", and older data had "man"/"woman".

**Fix:** Updated `normalizeGender()` to handle all variants:

```typescript
function normalizeGender(value: string): 'male' | 'female' | undefined {
  const lower = value.toLowerCase().trim()
  if (['male', 'man', 'men', 'm'].includes(lower)) return 'male'
  if (['female', 'woman', 'women', 'f'].includes(lower)) return 'female'
  return undefined
}
```

**Prevention:** When writing normalization functions, enumerate ALL known variants from all data sources (UI forms, imports, legacy data, API responses). Store a single canonical form and normalize on ingestion.

---

## 7. UI & UX

### 7.1 JSX attribute Unicode escapes render literally

**Problem:** `placeholder="\u2026"` in a JSX attribute rendered as the literal string `\u2026` instead of the ellipsis character.

**Root cause:** Unicode escape sequences inside JSX string attributes (double quotes) are treated as literal text, not as escape sequences.

**Fix:** Use curly braces with a JavaScript string:

```tsx
// WRONG: renders literal "\u2026"
<input placeholder="Select\u2026" />

// CORRECT: renders "Select..."
<input placeholder={"Select\u2026"} />

// ALSO CORRECT: use the actual character
<input placeholder="Select..." />
```

**Prevention:** Never use `\uXXXX` escapes inside JSX attribute strings. Use curly braces `{" "}` or paste the actual Unicode character.

---

### 7.2 Gender tags must use stable default IDs

**Problem:** `buildGenderTag()` used `crypto.randomUUID()` for tag IDs, creating duplicate tags with identical labels but different IDs. The Tags page showed "Men" appearing N times.

**Root cause:** Each shot got a new UUID for its gender tag, so the same label ("Men") existed with hundreds of different IDs in the system.

**Fix:** Use `GENDER_TAG_MAP` with stable default tag IDs from `shared/lib/defaultTags.ts`:

```typescript
const GENDER_TAG_MAP = {
  men: { id: 'default-gender-men', label: 'Men', ... },
  women: { id: 'default-gender-women', label: 'Women', ... },
  unisex: { id: 'default-gender-unisex', label: 'Unisex', ... },
}
```

**Prevention:** When adding auto-generated tags, always check `defaultTags.ts` for existing stable IDs before generating new ones. Tags that represent canonical concepts (gender, shot type) must have deterministic IDs.

---

### 7.3 Sticky banners need solid backgrounds

**Problem:** Sticky action bars and banners at the top/bottom of scrollable areas showed content bleeding through from behind.

**Root cause:** Using semi-transparent surface colors (e.g., `bg-surface-secondary` with alpha) instead of solid background colors for position-sticky elements.

**Fix:** Use solid background tokens:

```tsx
// WRONG: semi-transparent, content bleeds through
<div className="sticky top-0 bg-[var(--color-surface-secondary)]">

// CORRECT: solid background
<div className="sticky top-0 bg-[var(--color-bg)]">
```

**Prevention:** All `position: sticky` or `position: fixed` elements must use solid (opaque) background colors, never semi-transparent surface colors.

---

### 7.4 Tag badges: neutral body with subtle accent borders

**Problem:** Tag badges used rainbow `getTagColorClasses()` which produced visually noisy, inconsistent coloring across the app.

**Root cause:** The initial implementation applied full background + text color per tag, creating a "rainbow explosion" effect that clashed with the editorial design system.

**Fix:** Tag badges use a neutral body with a subtle left border in the tag's color (individual `tag.color` first, category as fallback):

```tsx
<span className="border-l-2" style={{ borderColor: tagColor }}>
  {tag.label}
</span>
```

**Prevention:** Follow `DESIGN_SYSTEM.md` for tag badge styling. Never use `getTagColorClasses()` on `TagBadge`. The design system mandates neutral body + accent border.

---

### 7.5 `[object Object]` in table cells from Firestore objects

**Problem:** Talent table measurement cells displayed `[object Object]` instead of actual values.

**Root cause:** Some Firestore measurement values are stored as objects (with nested properties) rather than plain strings. The `getMeasurementValue` function stringified the whole object.

**Fix:** Type-check the value and extract the relevant property:

```typescript
function getMeasurementValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (value && typeof value === 'object' && 'value' in value) {
    return String((value as { value: unknown }).value)
  }
  return ''
}
```

**Prevention:** Always handle the case where a Firestore field is an object, not just a primitive. Legacy data may have inconsistent shapes.

---

### 7.6 HTML tags in notes from legacy data

**Problem:** Talent detail cards showed raw HTML tags (`<p><span>...`) in notes fields.

**Root cause:** Legacy data was created with a rich text editor (TipTap) that stored HTML. The vNext display component rendered it as plain text.

**Fix:** Strip HTML tags at the display boundary, or render with `dangerouslySetInnerHTML` after sanitization.

**Prevention:** When displaying text fields that may contain legacy rich text, always sanitize and strip HTML. Consider a shared `stripHtml()` utility.

---

### 7.7 X-Frame-Options DENY blocks embedded browsers

**Problem:** Share links opened in Slack's in-app browser showed blank pages.

**Root cause:** Firebase Hosting's default `X-Frame-Options: DENY` header prevents the page from being rendered in any iframe, including Slack's in-app browser which uses a webview.

**Fix:** Configure Firebase Hosting headers to allow framing for public share pages, or accept that users must open in a real browser.

**Prevention:** When building public-facing pages intended for sharing via messaging platforms, test in Slack/Teams/Discord in-app browsers. Consider `X-Frame-Options: SAMEORIGIN` or CSP `frame-ancestors` configuration.

---

### 7.8 Design system token enforcement

**Problem:** Components used hardcoded Tailwind classes (`text-[13px]`, `bg-gray-800`) instead of design system tokens.

**Root cause:** Developers (and AI agents) defaulted to Tailwind primitives instead of the project's semantic token system.

**Fix:** Use semantic classes and custom token sizes:

```tsx
// WRONG: hardcoded
<h1 className="text-xl font-semibold">Title</h1>
<p className="text-[13px]">Body</p>

// CORRECT: design tokens
<h1 className="heading-page">Title</h1>
<p className="text-sm">Body</p>  // text-sm = 13px in this project
```

Key mappings: `text-3xs` (9px), `text-2xs` (10px), `text-xxs` (11px), `text-sm` (13px), `text-base` (14px). These are overridden in `tailwind.config.js` to be 1-2px smaller than Tailwind defaults.

**Prevention:** Read `docs/DESIGN_SYSTEM.md` before any UI work. Use semantic classes (`heading-page`, `heading-section`, `heading-subsection`, `label-meta`, `body-text`, `caption`). Never use arbitrary values like `text-[13px]`.

---

## 8. Import & Data Migration

### 8.1 Height format normalization

**Problem:** Height values like `6' 1"` (with a space) and `5'11.5"` (with half-inches) failed to parse correctly.

**Root cause:** The measurement parser regex only handled the compact format `6'1"` without spaces, and didn't support decimal inches.

**Fix:** Updated `parseMeasurementValue` regex to handle spaces and decimals:

```typescript
// Handles: 6'1", 6' 1", 5'11.5", 6'0"
const heightRegex = /^(\d+)'\s*(\d+(?:\.\d+)?)?"?$/
```

**Prevention:** When writing parsers for human-entered data, test with real-world samples including edge cases: spaces, decimal values, missing components, inconsistent formatting.

---

### 8.2 SKU color name deduplication during import

**Problem:** Importing SKUs created duplicate colorways because legacy SKUs used "Black" while imports used "Black (0101)" with vendor codes.

**Root cause:** The import matched by exact color name, but vendor-coded names like "Black (0101)" didn't match the legacy "Black".

**Fix:** Strip vendor code suffix before matching:

```typescript
const baseColorName = colorName.replace(/\s*\([^)]*\)$/, '')
// "Black (0101)" --> "Black"
```

Always merge into the existing legacy SKU to preserve doc IDs that may be referenced by project product selections.

**Prevention:** When matching imported data against existing records, normalize both sides before comparison. Strip vendor codes, trim whitespace, case-normalize.

---

### 8.3 Always dry-run before write

**Problem:** An early import run wrote incorrect data that had to be manually cleaned up.

**Root cause:** The import script didn't have a dry-run mode, so the first execution was a live write.

**Fix:** All scripts follow the audit-dry-run-write-verify pattern:

```bash
# Step 1: Audit
npx tsx scripts/migrations/fix.ts --clientId abc123

# Step 2: Review dry-run output

# Step 3: Write (only after user approval)
npx tsx scripts/migrations/fix.ts --clientId abc123 --write

# Step 4: Re-audit to verify
npx tsx scripts/migrations/fix.ts --clientId abc123
```

**Prevention:** Every data migration script must be dry-run by default (`--write` flag to execute). Present findings to the user and get explicit approval before running with `--write`.

---

### 8.4 Headshot files may be corrupt

**Problem:** Uploaded headshot images displayed as broken images. The files were 58 bytes and contained HTML error responses.

**Root cause:** The image download step received a 403 Forbidden HTML response instead of the actual image. The script saved the error page as if it were the image file.

**Fix:** Validate downloaded files before upload:

```typescript
const response = await fetch(url)
if (!response.ok) throw new Error(`HTTP ${response.status}`)
const buffer = await response.arrayBuffer()
if (buffer.byteLength < 1000) {
  throw new Error(`Suspiciously small file: ${buffer.byteLength} bytes`)
}
```

**Prevention:** Always validate file size and content type after download, before upload. Small files (<1KB for images) are almost certainly error responses, not real images.

---

### 8.5 Gender storage convention

**Problem:** Gender was stored inconsistently: "men"/"women" from imports, "male"/"female" from the UI, "man"/"woman" from some legacy data.

**Root cause:** No canonical format was established before multiple data sources started writing gender values.

**Fix:** Store as "male"/"female" to match the UI convention. Normalize on ingestion from all sources.

**Prevention:** Establish canonical storage formats for enumerated values before building the first write path. Document the canonical format and normalize at every ingestion boundary.

---

### 8.6 Data extraction agent context overflow

**Problem:** A single AI agent tasked with extracting data from 3 PDFs (48 pages, 197 products) only completed the first document and partially covered the second.

**Root cause:** The agent's context window filled up with extracted data, leaving insufficient room for processing remaining pages.

**Fix:** Split extraction across multiple agents (one per document), then consolidate with a separate agent.

**Prevention:** For data extraction tasks, if >50 items or >15 pages, split across multiple agents. Always deploy a separate auditor agent per extraction agent. Run programmatic validation after consolidation.

---

## 9. React & State Management

### 9.1 Never cache Firestore data in React state

**Problem:** Components that copied `onSnapshot` data into `useState` showed stale data after Firestore updates.

**Root cause:** Duplicating Firestore subscription data into React state creates two sources of truth. The React state doesn't auto-update when Firestore changes.

**Fix:** Subscribe and render directly:

```typescript
// WRONG: duplicate state
const [data, setData] = useState<Shot[]>([])
useEffect(() => {
  return onSnapshot(query, snap => setData(snap.docs.map(mapShot)))
}, [])

// This is actually fine -- the useState IS the subscription target.
// The anti-pattern is copying subscription data into ADDITIONAL state.
```

**Prevention:** Server state = Firestore subscriptions. No Redux, Zustand, or additional client-side cache. If you need derived data, compute it from the subscription data in a `useMemo`.

---

### 9.2 Optimistic creates are forbidden

**Problem:** Optimistic entity creation caused phantom items that disappeared when the write failed.

**Root cause:** The UI showed the entity immediately before Firestore confirmed the write. If the write failed (permissions, validation), the entity vanished with no explanation.

**Fix:** All creates must await Firestore write confirmation before appearing in the UI. Only idempotent state transitions (status toggles) may be optimistic.

**Prevention:** Optimistic updates are allowed ONLY for idempotent state transitions. Show a loading state during creation, then render after confirmation.

---

### 9.3 Aggressive subscription cleanup on unmount

**Problem:** List views with many active `onSnapshot` subscriptions caused memory leaks and excessive Firestore reads when navigating between pages.

**Root cause:** Subscriptions were not being cleaned up when the component unmounted. Each navigation created new subscriptions without closing old ones.

**Fix:** Every `onSnapshot` call must return its unsubscribe function, and the `useEffect` cleanup must call it:

```typescript
useEffect(() => {
  const unsubscribe = onSnapshot(query, callback, errorCallback)
  return () => unsubscribe()
}, [dependencies])
```

**Prevention:** Treat every `onSnapshot` as a resource that must be released. Use the `useEffect` return value for cleanup. In list views, be especially aggressive about unsubscribing.

---

## 10. Multi-Agent Development Patterns

### 10.1 Non-overlapping file ownership

**Problem:** Two agents modified the same file. The second agent read the old file state and overwrote the first agent's changes.

**Root cause:** Parallel agents don't see each other's file changes in real-time. If they touch the same file, the last writer wins.

**Fix:** Assign clear, non-overlapping file ownership to each agent. After every batch of parallel agents, run a reconciliation pass.

**Prevention:** Before launching parallel agents, map out which files each will modify. If overlap is unavoidable, run those agents sequentially. After parallel execution, grep for known patterns to verify changes weren't reverted.

---

### 10.2 Always deploy a critic agent after planning

**Problem:** The architect agent proposed a 13-file change with 3 new Firestore fields and a migration script. A critic agent found the data already existed and reduced it to a 7-file display change with zero new fields.

**Root cause:** Planning agents optimize for completeness and correctness, not minimalism. Without a counterweight, they over-engineer.

**Fix:** Deploy a critic/devil's advocate agent AFTER the planning phase with explicit instructions to find the MINIMUM viable change.

**Key critic questions:**
- "Does this data already exist in Firestore under a different field name?"
- "Is this stored field a pure function of existing data?"
- "Which of these file changes are required vs nice-to-have?"
- "Can a fallback chain avoid a migration entirely?"

**Prevention:** For any non-trivial plan, budget time for a critic pass. It consistently saves more time than it costs.

---

### 10.3 Agent context doesn't persist between invocations

**Problem:** Re-assigned agents referenced prior context that they no longer had access to, producing confused or incomplete output.

**Root cause:** Each agent invocation starts with a fresh context. Agents don't carry memory from previous invocations.

**Fix:** When reassigning an agent to a new task, send the FULL task brief with all relevant context, file paths, and constraints. Never reference prior messages.

**Prevention:** Treat every agent invocation as independent. Include all necessary context in the prompt, even if it was provided before.

---

## 11. Firestore Query Patterns

### 11.1 Client-side filtering for boolean fields with missing values

As covered in section 1.3, use `!== true` client-side instead of `where("field", "==", false)` for booleans that may be absent.

### 11.2 Composite indexes must be deployed before queries

New Firestore queries with multiple `where` conditions or `orderBy` combined with `where` require composite indexes. These must be deployed BEFORE the code that uses them. Deploying hosting without the indexes results in runtime query failures.

### 11.3 One-time `getDocs` for bulk operations

**Problem:** Subscription-based queries (`onSnapshot`) for bulk operations created unnecessary persistent connections.

**Fix:** Use one-time `getDocs` for bulk operations that need current data once:

```typescript
// For bulk operations, use getDocs (not onSnapshot)
const snapshot = await getDocs(query(collectionRef, where(...)))
const ids = snapshot.docs.map(doc => doc.id)
```

**Prevention:** Use `onSnapshot` for live-updating UI. Use `getDocs` for one-shot reads (bulk operations, migrations, export data gathering).

---

## 12. PDF Generation

### 12.1 Image pre-resolution must cover all block types

**Problem:** PDF generation failed or showed broken images because not all image sources were pre-resolved.

**Root cause:** The image pre-resolution step only collected URLs from `ImageBlock`, but shot-grid and shot-detail blocks also reference hero images.

**Fix:** Collect image URLs from ALL block types that render images before starting PDF generation.

**Prevention:** When adding a new block type that displays images, update the image pre-resolution step in `resolveExportImages.ts`.

---

### 12.2 Render tokens don't work in rich-text blocks

**Problem:** `{{pageNumber}}` and `{{pageCount}}` tokens printed literally inside rich-text blocks in the PDF.

**Root cause:** The HTML rendering path in `TextBlockPdf` returns before reaching the render-token branch. Tokens are only processed in the plain-text path.

**Fix:** Known limitation. Handle render tokens in the HTML path as well, or document that tokens only work in plain-text blocks.

**Prevention:** When adding template token systems, ensure they work across all rendering paths (plain text, rich text, PDF).

---

## 13. Testing

### 13.1 macOS path-with-spaces causes test runner issues

**Problem:** Vitest with the `forks` pool mode failed on macOS when the project path contained spaces.

**Root cause:** Tinypool (used by Vitest) has a bug with paths containing spaces on macOS.

**Fix:** `scripts/run-vitest.cjs` forces `--pool threads --singleThread` locally, but lets CI use the default `forks` pool.

**Prevention:** Be aware of this wrapper when debugging test issues. If tests behave differently locally vs CI, the pool configuration is the likely cause.

---

### 13.2 localStorage in tests

**Problem:** Tests that relied on `localStorage` persisted state (like filter settings) produced different results depending on test execution order.

**Root cause:** Default localStorage keys like `sb:readiness-requirements-filter` persisted between tests, affecting filter behavior.

**Fix:** Either mock `localStorage` in tests, or ensure test data satisfies filter criteria regardless of persisted state.

**Prevention:** Tests should be independent of localStorage state. Mock or clear localStorage in `beforeEach` for components that read persisted preferences.
