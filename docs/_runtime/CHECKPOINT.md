# CHECKPOINT — Sprint S21: Share Column Config, Tag Dedup, Tag Colors, Export Improvements (2026-04-06)

## Build clean. Lint zero. 151 test files / 1593 tests pass. Production build succeeds.

## New/Modified Files

### New Files
| File | Purpose |
|------|---------|
| `src-vnext/shared/lib/tagDedup.ts` | Tag normalization, canonical lookup, deduplication |
| `src-vnext/shared/lib/__tests__/tagDedup.test.ts` | 19 unit tests for tagDedup |
| `src-vnext/shared/components/ColumnSettingsList.tsx` | Extracted DnD column list (reusable) |
| `scripts/migrations/2026-04-deduplicate-shot-tags.ts` | Migration for existing tag duplicates |

### Modified Files
| File | Change |
|------|--------|
| `src-vnext/features/shots/lib/mapShot.ts` | Canonicalize tags at Firestore→React boundary |
| `src-vnext/features/shots/hooks/useAvailableTags.ts` | Label-keyed aggregation |
| `src-vnext/features/shots/components/TagManagementPage.tsx` | Label-keyed buildTagLibrary |
| `src-vnext/features/shots/components/TagEditor.tsx` | Check DEFAULT_TAGS before creating |
| `src-vnext/features/shots/lib/shotTableColumns.ts` | ShareColumnEntry, PUBLIC_SHARE_COLUMNS |
| `src-vnext/shared/components/ColumnSettingsPopover.tsx` | Refactored to use ColumnSettingsList |
| `src-vnext/features/shots/lib/resolveShotsForShare.ts` | Tags/links in resolved data; deleted filter fix |
| `src-vnext/features/shots/components/ShotsShareDialog.tsx` | Column config UI + Firestore persistence |
| `src-vnext/features/shots/components/PublicShotSharePage.tsx` | Column-driven table with viewer toggles |
| `src-vnext/features/export/types/exportBuilder.ts` | order field on ShotGridColumn |
| `src-vnext/features/export/lib/blockDefaults.ts` | order values on defaults |
| `src-vnext/features/export/components/settings/ColumnTableSettings.tsx` | DnD column reorder |
| `src-vnext/features/export/lib/pdf/blocks/ShotGridBlockPdf.tsx` | Sort by order; tag badge rendering |
| `src-vnext/features/export/components/ShotGridBlockView.tsx` | Sort by order in preview |
| `src-vnext/features/export/lib/pdf/pdfStyles.ts` | PDF_TAG_CATEGORY_COLORS |

---

# Previous: Permissions Fix + Comment Moderation (2026-04-05)

## Hotfix: Admin Invite Permissions (P0)
- `firestore.rules:333` — fixed user doc CREATE rule to allow admin creation
- `useExportReports.ts` — hardened saveReport from `setDoc(merge)` to `updateDoc`

## Admin Comment Moderation (P2)
- Shot + product comment Firestore rules with full immutable field protection
- Admin "Remove" button + confirm dialog in ShotCommentsSection + ProductActivitySection
