/**
 * Phase 1 — three-store localStorage preference consolidation (shots build
 * plan §Phase 1, `2026-08-10-shots-build-plan.md`).
 *
 * Today the shots list/table preferences live in THREE independent
 * localStorage keys ("Store 1/2/3" below) that can disagree, and one of
 * them (the legacy `migrateOldColumnPrefs` in ShotsTable.tsx) actively
 * DELETES another's live key on render. This module introduces a fourth,
 * consolidated key (v2) as a **dual-write mirror + one-time backfill** —
 * it does NOT change what anyone reads yet. Store 1/2/3 stay the read
 * path for every surface until Phase 2 flips reads to v2 and sweeps them.
 *
 * Reconciliation-discipline safeguards encoded here (build plan §1.3):
 *   (a) gate the backfill on the `_mig.v2` MARKER, never on a field value.
 *   (b) never delete a legacy key (handled at the ShotsTable.tsx call site
 *       — the destructive `removeItem` this module replaces is deleted
 *       there, not migrated here).
 *   (c) a NEW marker (`_mig.v2`), stamped even on the "neither store
 *       present" no-match case — a future correction is `_mig.v3`, never
 *       an edit to this pass.
 *   (d) capture `rawSnapshot` (the raw legacy strings) on first v2 write,
 *       so a future `_mig.v3` can recover from whatever the pre-existing
 *       destructive migration already collapsed.
 *   (e)/(g) tested from persisted-blob fixtures; this module never sweeps
 *       Store 1/2/3 — see the test file for the "no sweep" assertions.
 */

import type { TableColumnConfig } from "@/shared/types/table"
import { SHOT_TABLE_COLUMNS, columnKeyToFieldKey } from "./shotTableColumns"
import { DEFAULT_FIELDS, type ShotsListFields, type ViewMode } from "./shotListFilters"

// ---------------------------------------------------------------------------
// Key templates (verbatim — see build plan §1.0/§1.4 and the Phase-1 recon
// corrections). `tableV3Key` already includes the `sb:` prefix that
// `useTableColumns` applies internally to the `shots-table:{c}:{p}`
// storageKey ShotsTable passes it — do not double-prefix.
// ---------------------------------------------------------------------------

export function fieldsV1Key(clientId: string, projectId: string): string {
  return `sb:shots:list:${clientId}:${projectId}:fields:v1`
}

export function viewV1Key(clientId: string, projectId: string): string {
  return `sb:shots:list:${clientId}:${projectId}:view:v1`
}

export function tableV3Key(clientId: string, projectId: string): string {
  return `sb:shots-table:${clientId}:${projectId}`
}

export function prefsV2Key(clientId: string, projectId: string): string {
  return `sb:shots:prefs:v2:${clientId}:${projectId}`
}

// ---------------------------------------------------------------------------
// v2 shape
// ---------------------------------------------------------------------------

export type ColumnGeometry = {
  readonly width: number
  readonly order: number
}

export type ShotsPrefsV2RawSnapshot = {
  readonly fieldsV1: string | null
  readonly tableV3: string | null
  readonly viewV1: string | null
}

export type ShotsPrefsV2 = {
  readonly fields: ShotsListFields
  /** Dense-only geometry sidecar — width/order only; visibility lives in `fields`. */
  readonly columns: Readonly<Record<string, ColumnGeometry>>
  /** null = never explicitly set (absorbs Store 2; preserves the "unset" distinction). */
  readonly view: ViewMode | null
  /** The raw legacy blobs captured on first v2 write. null once a fresh-install
   *  ("neither store present") user is stamped — still captured, just empty fields. */
  readonly rawSnapshot: ShotsPrefsV2RawSnapshot | null
  readonly _mig: { readonly v2: boolean }
}

const EMPTY_PREFS_V2: ShotsPrefsV2 = {
  fields: DEFAULT_FIELDS,
  columns: {},
  view: null,
  rawSnapshot: null,
  _mig: { v2: false },
}

// ---------------------------------------------------------------------------
// Safe storage helpers — never let a migration failure break the shots surface.
// ---------------------------------------------------------------------------

function safeGetItem(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null
  } catch {
    return null
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value)
  } catch {
    // Ignore storage errors (private mode, quota, etc.) — v2 is a mirror,
    // never the only copy of a preference.
  }
}

/**
 * Read the current v2 blob. Three outcomes, deliberately distinguished:
 *
 *   ABSENT   (no key)            → `EMPTY_PREFS_V2` — a valid starting point;
 *                                  a mirror may safely read-modify-write it.
 *   OK       (well-formed blob)  → the parsed prefs.
 *   CORRUPT  (unparseable, or a
 *             non-object such as
 *             an array / `null`) → `null`.
 *
 * CORRUPT must NOT collapse into ABSENT. A mirror that read-modify-writes an
 * unparseable blob would silently rewrite it as `_mig.v2: false` +
 * `rawSnapshot: null` — destroying both the marker and the ONLY recovery copy
 * of the legacy stores, on a code path nobody is watching. Mirrors therefore
 * skip entirely on CORRUPT; the next mount's backfill (which treats an
 * unstamped-or-unreadable blob as unstamped) rebuilds from the legacy stores,
 * which are still the authoritative read path this phase.
 */
function readPrefsV2(clientId: string, projectId: string): ShotsPrefsV2 | null {
  const raw = safeGetItem(prefsV2Key(clientId, projectId))
  if (!raw) return EMPTY_PREFS_V2
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null
    const blob = parsed as Partial<ShotsPrefsV2>
    const columns =
      blob.columns && typeof blob.columns === "object" && !Array.isArray(blob.columns)
        ? blob.columns
        : {}
    return {
      fields: { ...DEFAULT_FIELDS, ...(blob.fields ?? {}) },
      columns,
      view: blob.view === "table" || blob.view === "card" ? blob.view : null,
      rawSnapshot: blob.rawSnapshot ?? null,
      _mig: { v2: blob._mig?.v2 === true },
    }
  } catch {
    return null
  }
}

function writePrefsV2(clientId: string, projectId: string, prefs: ShotsPrefsV2): void {
  safeSetItem(prefsV2Key(clientId, projectId), JSON.stringify(prefs))
}

// ---------------------------------------------------------------------------
// View field resolution — preserves "never stored" as `null`. This mirrors
// the CONTRACT of useShotListState's resolver reader (`storedExplicitView`,
// useShotListState.ts:301-311), duplicated here on purpose: the hook's
// existing readers are untouched by Phase 1 (verified against main), so this
// module owns its own copy rather than reaching into the hook's internals.
// ---------------------------------------------------------------------------

export function resolveViewV2FromRaw(raw: string | null): ViewMode | null {
  // Backward compat: "gallery" and "visual" both migrate to "card".
  if (raw === "card" || raw === "gallery" || raw === "visual") return "card"
  return raw === "table" ? "table" : null
}

// ---------------------------------------------------------------------------
// Fields <-> columns key ladder (build plan §1.2 "the fields↔columns key
// ladder"). Built once from the single source of truth (COLUMN_TO_FIELD via
// the exported `columnKeyToFieldKey`), not re-declared here.
// ---------------------------------------------------------------------------

function buildFieldToColumnMap(): ReadonlyMap<keyof ShotsListFields, string> {
  const map = new Map<keyof ShotsListFields, string>()
  for (const col of SHOT_TABLE_COLUMNS) {
    const fieldKey = columnKeyToFieldKey(col.key)
    if (fieldKey) map.set(fieldKey, col.key)
  }
  return map
}

const FIELD_TO_COLUMN = buildFieldToColumnMap()
const FIELD_KEYS = Object.keys(DEFAULT_FIELDS) as ReadonlyArray<keyof ShotsListFields>

/** A subset of `ShotsListFields` — the unit every mirror writes (see the
 *  per-key patch invariant on the mirrors below). `ShotsListFields` is
 *  readonly, so the builders below accumulate into the mutable twin. */
export type ShotsFieldsPatch = Readonly<Partial<ShotsListFields>>
type MutableFieldsPatch = { -readonly [K in keyof ShotsListFields]?: ShotsListFields[K] }

/** The COLUMN domain's own default visibility, keyed by field. Deliberately
 *  NOT `DEFAULT_FIELDS` — the two disagree (notes/links/updated are visible by
 *  column default and hidden by card default), and a *column* reset must
 *  restore what `useTableColumns.resetToDefaults` restores: SHOT_TABLE_COLUMNS.
 *  Card-only keys (`description`, `readiness`, `shotNumber`) are absent here,
 *  which is what keeps a column reset from touching them. */
function buildColumnDomainDefaults(): ShotsFieldsPatch {
  const out: MutableFieldsPatch = {}
  for (const col of SHOT_TABLE_COLUMNS) {
    const fieldKey = columnKeyToFieldKey(col.key)
    if (fieldKey) out[fieldKey] = col.visible
  }
  return out
}

const COLUMN_DOMAIN_DEFAULT_FIELDS = buildColumnDomainDefaults()

/**
 * The keys whose values differ between `prev` and `next`, as a patch.
 *
 * This is what makes card writes co-exist with table writes in ONE v2 blob:
 * the card surface's state is derived from Store 1 alone and knows nothing
 * about a column the user hid from the table popover, so mirroring the card's
 * WHOLE fields object would resurrect that column every time any card field
 * was toggled. Mirroring only the delta gives last-write-wins per key.
 */
export function fieldsDelta(prev: ShotsListFields, next: ShotsListFields): ShotsFieldsPatch {
  const patch: MutableFieldsPatch = {}
  for (const key of FIELD_KEYS) {
    if (prev[key] !== next[key]) patch[key] = next[key]
  }
  return patch
}

// ---------------------------------------------------------------------------
// Legacy blob parsing (tolerant — a malformed blob is treated as absent)
// ---------------------------------------------------------------------------

function parseTableV3(raw: string | null): readonly TableColumnConfig[] | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as readonly TableColumnConfig[]) : null
  } catch {
    return null
  }
}

function parseFieldsV1(raw: string | null): Partial<ShotsListFields> | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Partial<ShotsListFields>)
      : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Case-matrix builders (build plan §1.2A) — each returns a fresh object;
// never mutates its inputs.
// ---------------------------------------------------------------------------

function columnsSidecarFromTableV3(
  cols: readonly TableColumnConfig[],
): Readonly<Record<string, ColumnGeometry>> {
  return Object.fromEntries(cols.map((col) => [col.key, { width: col.width, order: col.order }]))
}

/** Field visibility projected from Store 3's column list. A field with no
 *  corresponding column entry (shouldn't normally happen — `normalizeColumns`
 *  auto-appends new default columns) falls back to DEFAULT_FIELDS. */
function fieldsFromTableV3(cols: readonly TableColumnConfig[]): ShotsListFields {
  const byKey = new Map(cols.map((c) => [c.key, c]))
  const entries = FIELD_KEYS.map((key) => {
    const columnKey = FIELD_TO_COLUMN.get(key)
    const col = columnKey ? byKey.get(columnKey) : undefined
    return [key, col ? col.visible : DEFAULT_FIELDS[key]] as const
  })
  return Object.fromEntries(entries) as unknown as ShotsListFields
}

/** BOTH-stores case: card-only fields (description, readiness) come from
 *  Store 1 alone; every field with a column counterpart is OR-unioned
 *  (visible if visible in EITHER store) — no double-count, just boolean OR. */
function unionFields(
  store1: Partial<ShotsListFields>,
  tableProjected: ShotsListFields,
): ShotsListFields {
  const entries = FIELD_KEYS.map((key) => {
    const fromStore1 = store1[key]
    if (!FIELD_TO_COLUMN.has(key)) {
      return [key, fromStore1 ?? DEFAULT_FIELDS[key]] as const
    }
    return [key, Boolean(fromStore1) || Boolean(tableProjected[key])] as const
  })
  return Object.fromEntries(entries) as unknown as ShotsListFields
}

// ---------------------------------------------------------------------------
// (A) One-time backfill — marker-gated, absent-safe, idempotent.
// ---------------------------------------------------------------------------

/**
 * Backfill `sb:shots:prefs:v2:{clientId}:{projectId}` from whatever legacy
 * stores exist, exactly once per project. Gated on the `_mig.v2` marker
 * INSIDE the v2 blob itself — never on any legacy field's value — so it
 * fires correctly even for blobs that predate every field (absent-safe).
 *
 * Never deletes or mutates Store 1/2/3. Safe to call redundantly (e.g. from
 * a StrictMode double-invoked effect): the second call sees `_mig.v2: true`
 * and returns immediately, so a user edit made between two calls is never
 * clobbered by a stale re-derivation.
 */
export function backfillShotsPrefsV2(clientId: string, projectId: string): void {
  try {
    const existing = readPrefsV2(clientId, projectId)
    // Idempotent — marker already stamped. A CORRUPT blob (`null`) reads as
    // unstamped on purpose: rebuilding it from the still-authoritative legacy
    // stores is the recovery path the mirrors deliberately defer to.
    if (existing?._mig.v2) return

    const fieldsRaw = safeGetItem(fieldsV1Key(clientId, projectId))
    const tableRaw = safeGetItem(tableV3Key(clientId, projectId))
    const viewRaw = safeGetItem(viewV1Key(clientId, projectId))

    const store1Fields = parseFieldsV1(fieldsRaw)
    const store3Cols = parseTableV3(tableRaw)
    const view = resolveViewV2FromRaw(viewRaw)

    const rawSnapshot: ShotsPrefsV2RawSnapshot = {
      fieldsV1: fieldsRaw,
      tableV3: tableRaw,
      viewV1: viewRaw,
    }

    let fields: ShotsListFields
    let columns: Readonly<Record<string, ColumnGeometry>>

    if (store1Fields && store3Cols) {
      // BOTH present — geometry from Store 3, OR-unioned visibility.
      const tableProjected = fieldsFromTableV3(store3Cols)
      fields = unionFields(store1Fields, tableProjected)
      columns = columnsSidecarFromTableV3(store3Cols)
    } else if (store1Fields) {
      // card Store 1 only — Store 1 preserved as-is; columns = defaults (empty sidecar).
      fields = { ...DEFAULT_FIELDS, ...store1Fields }
      columns = {}
    } else if (store3Cols) {
      // table Store 3 only — project visibility into fields; carry geometry.
      fields = fieldsFromTableV3(store3Cols)
      columns = columnsSidecarFromTableV3(store3Cols)
    } else {
      // NEITHER — fresh-install path.
      fields = DEFAULT_FIELDS
      columns = {}
    }

    writePrefsV2(clientId, projectId, {
      fields,
      columns,
      view,
      rawSnapshot,
      _mig: { v2: true },
    })
  } catch {
    // A migration failure must never break the shots surface — legacy
    // stores remain the read path this phase regardless.
  }
}

// ---------------------------------------------------------------------------
// (B) Dual-write mirrors — extend the existing legacy persist paths so v2
// never goes stale before the Phase 2 read-flip.
//
// TWO invariants hold across every mirror below:
//
//   1. PER-KEY PATCH. A mirror writes only the keys the user's action actually
//      changed, so the card surface and the table surface — which have
//      independent legacy stores and therefore independent, disagreeing ideas
//      of "the current fields" — can share one v2 blob under last-write-wins
//      per key. Never replace a whole sub-object.
//   2. WRITES ONLY. A mirror fires from a write path, never from a mount
//      effect. A mount-time mirror is an ECHO of one surface's load-time
//      state and silently overwrites whatever the backfill computed from the
//      OTHER stores (see useShotListState's `setFields` for the seam).
//
// Each is a read-modify-write against whatever v2 blob currently exists
// (defaulting to the empty shape when ABSENT, skipped entirely when CORRUPT —
// see `readPrefsV2`), and never touches `_mig` except the backfill above.
// ---------------------------------------------------------------------------

/** Mirrors a CARD field write, as a per-key patch of just the changed keys
 *  (build a patch with `fieldsDelta`, not the whole `ShotsListFields`). */
export function mirrorFieldsPatchToV2(
  clientId: string,
  projectId: string,
  patch: ShotsFieldsPatch,
): void {
  if (Object.keys(patch).length === 0) return
  const current = readPrefsV2(clientId, projectId)
  if (!current) return
  writePrefsV2(clientId, projectId, { ...current, fields: { ...current.fields, ...patch } })
}

export function mirrorViewToV2(clientId: string, projectId: string, view: ViewMode): void {
  const current = readPrefsV2(clientId, projectId)
  if (!current) return
  writePrefsV2(clientId, projectId, { ...current, view })
}

/** Mirrors a column width write (ShotsTable's `handleColumnResizeEnd`). */
export function mirrorColumnWidthToV2(
  clientId: string,
  projectId: string,
  columnKey: string,
  width: number,
): void {
  const current = readPrefsV2(clientId, projectId)
  if (!current) return
  const prevGeom = current.columns[columnKey]
  const order = prevGeom?.order ?? SHOT_TABLE_COLUMNS.find((c) => c.key === columnKey)?.order ?? 0
  writePrefsV2(clientId, projectId, {
    ...current,
    columns: { ...current.columns, [columnKey]: { width, order } },
  })
}

/** Mirrors a full column-order write (ShotsTable's `reorderColumns`/`onReorder`). */
export function mirrorColumnOrderToV2(
  clientId: string,
  projectId: string,
  orderedKeys: readonly string[],
): void {
  const current = readPrefsV2(clientId, projectId)
  if (!current) return
  const updates = orderedKeys.map((key, idx) => {
    const prevGeom = current.columns[key]
    const width = prevGeom?.width ?? SHOT_TABLE_COLUMNS.find((c) => c.key === key)?.width ?? 0
    return [key, { width, order: idx }] as const
  })
  writePrefsV2(clientId, projectId, {
    ...current,
    columns: { ...current.columns, ...Object.fromEntries(updates) },
  })
}

/** Mirrors a column visibility toggle into `fields` (not `columns` — visibility
 *  lives in the field model). No-op for pinned columns (`shot`/`shotNumber`),
 *  which have no field counterpart and are always visible. */
export function mirrorColumnVisibilityToV2(
  clientId: string,
  projectId: string,
  columnKey: string,
  visible: boolean,
): void {
  const fieldKey = columnKeyToFieldKey(columnKey)
  if (!fieldKey) return
  const current = readPrefsV2(clientId, projectId)
  if (!current) return
  writePrefsV2(clientId, projectId, {
    ...current,
    fields: { ...current.fields, [fieldKey]: visible },
  })
}

/**
 * Mirrors a column RESET (ShotsTable's `handleResetColumns`, wrapping
 * `useTableColumns.resetToDefaults`, which removes the Store 3 key outright).
 *
 * Clears the geometry sidecar and returns the COLUMN-DOMAIN field keys to the
 * column defaults. Card-only keys (`description`, `readiness`, `shotNumber`)
 * are deliberately untouched: they have no column counterpart, they are not
 * shown in the column popover, and a table reset has never meant "throw away
 * the card's display prefs". Without this seam a reset would clear Store 3
 * while leaving v2 carrying the pre-reset widths/order/visibility forever —
 * the divergence would only surface at the Phase 2 read-flip.
 */
export function resetColumnPrefsInV2(clientId: string, projectId: string): void {
  const current = readPrefsV2(clientId, projectId)
  if (!current) return
  writePrefsV2(clientId, projectId, {
    ...current,
    columns: {},
    fields: { ...current.fields, ...COLUMN_DOMAIN_DEFAULT_FIELDS },
  })
}
