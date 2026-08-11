// Resolved, presentation-free model for the Comprehensive Shot Report.
// One pure model both renderers consume (DOM ReportView + @react-pdf reportPdf),
// so screen and PDF can't drift. Image fields are *candidates* (a Storage path
// or URL) resolved to data URLs once via reportImages, keyed in a sidecar map —
// the model stays pure (no async, no image bytes).

import type { SortDir } from "./reportSort"
import { getShotStatusLabel } from "@/shared/lib/statusMappings"

export type ReportGroupBy = "gender" | "none" | "status" | "scene"

/** Which looks each shot shows: every look, or only the primary (alts hidden). */
export type ReportLooksMode = "all" | "primary-only"

/**
 * Which layout recipe renders the (one) resolved model.
 * - image-led: client-review deck (the shipped R1 layout, default).
 * - production-sheet: dense on-set/warehouse spec sheet (comp-b).
 * - balanced-rows: scannable one-band-per-shot all-rounder (comp-c).
 * The recipes share the engine; only layout + which fields surface differ.
 */
export type ReportLayout = "image-led" | "production-sheet" | "balanced-rows"

// Recipe display labels — the single source for the picker + in-report switch +
// list chip. An exhaustive typed literal (TS flags a missing variant); the option
// list derives from it so the strings aren't duplicated.
export const REPORT_LAYOUT_LABEL: Record<ReportLayout, string> = {
  "image-led": "Image-led",
  "production-sheet": "On-set sheet",
  "balanced-rows": "All-rounder",
}
export const REPORT_LAYOUT_OPTIONS: ReadonlyArray<{ readonly value: ReportLayout; readonly label: string }> =
  (Object.keys(REPORT_LAYOUT_LABEL) as ReportLayout[]).map((value) => ({
    value,
    label: REPORT_LAYOUT_LABEL[value],
  }))

// Status-filter (R3) display labels — the single source for the "Hide statuses"
// multi-select shared by all three report views. Each value calls the
// canonical getShotStatusLabel (statusMappings.ts) rather than spelling out
// a local literal, so the wording can't drift from the list/editor
// vocabulary — but the object stays an exhaustive typed LITERAL (not
// Object.fromEntries + `as Record<...>`), so TS still flags a missing
// variant if ReportShotStatus ever grows a member. Key order intentionally
// matches the pre-existing "Hide statuses" chip order (complete first).
// ReportShotStatus is declared below (type aliases hoist within a module).
export const REPORT_STATUS_LABEL: Record<ReportShotStatus, string> = {
  complete: getShotStatusLabel("complete"),
  in_progress: getShotStatusLabel("in_progress"),
  on_hold: getShotStatusLabel("on_hold"),
  todo: getShotStatusLabel("todo"),
}
export const REPORT_STATUS_OPTIONS: ReadonlyArray<{ readonly value: ReportShotStatus; readonly label: string }> =
  (Object.keys(REPORT_STATUS_LABEL) as ReportShotStatus[]).map((value) => ({
    value,
    label: REPORT_STATUS_LABEL[value],
  }))

// Shot-report order-by (R2) field vocabulary. Exhaustive typed literal → the
// option list derives from it (same pattern as REPORT_LAYOUT_*). Sort is applied
// WITHIN each group at derive time via the shared sortItemsStable engine.
// "custom" respects the shot's own drag order (Shot.sortOrder) instead of a
// computed comparator — see shotPrimaryFor in reportModel.ts.
export type ReportSortField = "shot-number" | "talent" | "status" | "gender" | "custom"
export const REPORT_SORT_FIELD_LABEL: Record<ReportSortField, string> = {
  "shot-number": "Shot #",
  talent: "Talent",
  status: "Status",
  gender: "Gender",
  custom: "Custom order",
}
export const REPORT_SORT_FIELD_OPTIONS: ReadonlyArray<{ readonly value: ReportSortField; readonly label: string }> =
  (Object.keys(REPORT_SORT_FIELD_LABEL) as ReportSortField[]).map((value) => ({
    value,
    label: REPORT_SORT_FIELD_LABEL[value],
  }))

/** The order actually applied to the resolved model (set at derive time from the
 *  applied config, so it can never drift from the shots' real order). Recipe
 *  captions render this instead of a hardcoded "sorted by shot no." claim.
 *  `groupBy` and `filterSummary` are OPTIONAL — they extend the caption to also
 *  name Set grouping and active filters honestly, but stay optional so the many
 *  pre-existing fixtures that build a bare `{sortBy, sortDir}` ReportOrder (PDF
 *  pagination tests, recipe smoke tests) keep compiling unchanged; a real
 *  deriveShotReportModel run always populates both. */
export interface ReportOrder {
  readonly sortBy: ReportSortField
  readonly sortDir: SortDir
  /** The applied groupBy at derive time. Only "scene" changes the caption
   *  (it names the Set grouping) — every other value is left unmentioned,
   *  matching the pre-existing caption's silence on gender/status grouping. */
  readonly groupBy?: ReportGroupBy
  /** Pre-formatted "filtered: status (2), tags (3)" clause (formatFilterSummary),
   *  or null/absent when no filter is active. Carried on the order (not
   *  recomputed in the caption) so formatOrderNote stays a pure string-join. */
  readonly filterSummary?: string | null
}

/** The sort-only clause of the caption ("Sorted by X[, descending]", or the
 *  distinct "Custom order[, descending]" phrasing for sortBy:"custom" — a
 *  drag order isn't "sorted BY" anything, so it gets its own wording rather
 *  than forcing REPORT_SORT_FIELD_LABEL's noun through the generic template). */
function orderClause(order: Pick<ReportOrder, "sortBy" | "sortDir">): string {
  if (order.sortBy === "custom") {
    return order.sortDir === "desc" ? "Custom order, descending" : "Custom order"
  }
  // Defensive lookup: exportReports persists schemaless (no rules validation),
  // so a hand-edited/legacy blob can carry an out-of-union sortBy. shotPrimaryFor
  // sorts such shots by shot-number, so falling back to that label keeps the
  // caption HONEST (and never crashes on an undefined label — see reportModel.ts).
  const label = REPORT_SORT_FIELD_LABEL[order.sortBy] ?? REPORT_SORT_FIELD_LABEL["shot-number"]
  const field = label.toLowerCase()
  return order.sortDir === "desc" ? `Sorted by ${field}, descending` : `Sorted by ${field}`
}

/** Honest, config-driven order caption for the recipe group heads. Reads the
 *  applied order off the model — NOT a persisted config field — so it always
 *  describes the shots as actually sorted, grouped, and filtered. Appends a
 *  "grouped by Set" clause when the applied groupBy is "scene", and a
 *  pre-formatted filter clause when one or more filters are active — so the
 *  caption never lies by omission about either. */
export function formatOrderNote(order: ReportOrder): string {
  const parts = [orderClause(order)]
  if (order.groupBy === "scene") parts.push("grouped by Set")
  if (order.filterSummary) parts.push(order.filterSummary)
  return parts.join(" · ")
}

// Unified report filter vocabulary (status + tag, v1). Deliberately the SAME
// shape as features/shots/lib/filterConditions.ts's FilterCondition (a
// structural subtype: narrower `field`/`operator` unions, `value` always a
// string array) so a ReportFilterCondition can be handed straight to the shot
// list's own evaluateCondition/applyFilterConditions (filterEngine.ts) with no
// adapter — one engine, one semantics, for both surfaces. Reuse, don't reinvent.
export type ReportFilterField = "status" | "tag"
export type ReportFilterOperator = "in" | "notIn"
export interface ReportFilterCondition {
  readonly id: string
  readonly field: ReportFilterField
  readonly operator: ReportFilterOperator
  readonly value: readonly string[]
}

/** Persisted report config — serializable (strings + string[] only); optional fields enable default-merge from older blobs. */
export interface ReportConfig {
  readonly groupBy: ReportGroupBy
  /** Shots the user has excluded — kept visible+struck on screen, omitted from the PDF. */
  readonly excludedShotIds: readonly string[]
  /** "primary-only" shows just each shot's primary look. Defaults to "all". */
  readonly looksMode?: ReportLooksMode
  /**
   * Layout recipe. Absent on a legacy (pre-R3) blob — `hydrateReportConfig`
   * floors that case to `LEGACY_REPORT_LAYOUT` ("image-led"), NOT
   * `DEFAULT_REPORT_CONFIG.layout`, so an old saved report keeps rendering
   * exactly what it always has. A BRAND-NEW report gets
   * `DEFAULT_REPORT_CONFIG.layout` (production-sheet as of the 2026-08-09
   * default-recipe decision — see resolveReportLayout for the
   * featureShotReportRecipes flag-off clamp).
   */
  readonly layout?: ReportLayout
  /**
   * LEGACY status-hide list, superseded by `filters` below (2026-08-11 — the
   * unified filters control replaced the standalone "Hide statuses" toggle
   * set). Tolerated on READ ONLY: `hydrateReportConfig` migrates a non-empty
   * value into an equivalent `filters` entry exactly once, and no code path
   * writes this field anymore. See `resolveReportFilters` for the precedence
   * rule when a blob somehow carries both.
   */
  readonly hiddenStatuses?: readonly ReportShotStatus[]
  /**
   * Unified filters (status + tag, multi-value, AND-across-fields /
   * OR-within-field — see filterEngine.ts's applyFilterConditions, which this
   * reuses verbatim at derive time). Absent → `resolveReportFilters` falls
   * back to migrating `hiddenStatuses`; present (even []) is authoritative and
   * `hiddenStatuses` is ignored outright, so the two can never double-apply.
   */
  readonly filters?: readonly ReportFilterCondition[]
  /** R2 order-by: primary sort key applied within each group. Absent → legacy shot-number order (flag-off byte-identical). */
  readonly sortBy?: ReportSortField
  /** R2 order-by direction. Absent → "asc". Flips the PRIMARY key only; tie-break stays ascending. */
  readonly sortDir?: SortDir
}

/** Stable id for the single synthetic filter `resolveReportFilters` folds a
 *  legacy `hiddenStatuses` list into — never minted by the Filters control
 *  itself (which keys its own entries by field name), so it can't collide. */
export const LEGACY_HIDDEN_STATUSES_FILTER_ID = "legacy-hidden-statuses"

/**
 * The filters actually in force for a config, resolving the hiddenStatuses ->
 * filters migration's precedence. `filters` (even an explicit []) is always
 * authoritative once present — `hiddenStatuses` is never merged into it, so a
 * blob that somehow carries both never double-applies. Only when `filters` is
 * entirely ABSENT does a non-empty `hiddenStatuses` get folded into a single
 * synthetic status/notIn filter, reproducing the exact pre-migration "hide
 * these statuses" behavior. Called at BOTH hydrate time (hydrateReportConfig
 * migrates a legacy blob once, so its ongoing edits/persistence carry
 * `filters` and stop writing `hiddenStatuses`) and derive time
 * (deriveShotReportModel — so a raw/hand-built config that skips hydrate,
 * e.g. every existing hiddenStatuses-only test fixture, still filters
 * correctly without updating).
 */
export function resolveReportFilters(config: {
  readonly filters?: readonly ReportFilterCondition[]
  readonly hiddenStatuses?: readonly ReportShotStatus[]
}): readonly ReportFilterCondition[] {
  if (config.filters !== undefined) return config.filters
  const hidden = config.hiddenStatuses ?? []
  if (hidden.length === 0) return []
  return [{ id: LEGACY_HIDDEN_STATUSES_FILTER_ID, field: "status", operator: "notIn", value: hidden }]
}

const FILTER_FIELD_SUMMARY_LABEL: Record<ReportFilterField, string> = {
  status: "status",
  tag: "tags",
}

/**
 * Honest "N active filters" clause appended to the recipe caption by
 * formatOrderNote, e.g. "filtered: status (2), tags (3)". A field with zero
 * selected values is skipped (an operator chosen before any value is picked
 * isn't "active" yet). Field order is always status-then-tag regardless of
 * array order, so the caption reads identically no matter which the user
 * touched first. Returns null when nothing is active (formatOrderNote then
 * omits the clause entirely rather than printing "filtered: ").
 */
export function formatFilterSummary(filters: readonly ReportFilterCondition[]): string | null {
  const byField = new Map(filters.map((f) => [f.field, f]))
  const parts: string[] = []
  for (const field of ["status", "tag"] as const) {
    const condition = byField.get(field)
    if (condition && condition.value.length > 0) {
      parts.push(`${FILTER_FIELD_SUMMARY_LABEL[field]} (${condition.value.length})`)
    }
  }
  return parts.length === 0 ? null : `filtered: ${parts.join(", ")}`
}

/**
 * Default config for a BRAND-NEW shot report (no persisted doc yet, and no
 * ?reportId= in the URL). `layout: "production-sheet"` is Ted's 2026-08-09
 * decision (production-sheet becomes the default shot-report recipe, landing
 * alongside PR #513 flipping `featureShotReportRecipes` ON in prod) — see
 * `resolveReportLayout` for how the flag-off case still clamps to
 * "image-led" regardless of this default, and `hydrateReportConfig` /
 * `LEGACY_REPORT_LAYOUT` for why an EXISTING pre-R3 saved report does NOT
 * inherit this value just because it's read after this change ships.
 */
export const DEFAULT_REPORT_CONFIG: ReportConfig = {
  groupBy: "gender",
  excludedShotIds: [],
  looksMode: "all",
  layout: "production-sheet",
  hiddenStatuses: [],
  sortBy: "shot-number",
  sortDir: "asc",
}

/**
 * Forward-compat floor for a persisted config with NO `layout` field at all
 * (a genuinely pre-R3 doc, written before recipes existed). Frozen — this
 * must stay "image-led" even after `DEFAULT_REPORT_CONFIG.layout` changes
 * for NEW reports, or opening an old report silently "migrates" its layout
 * the day the default flips. See reportTypes.test.ts "keeps a pre-R3 blob on
 * image-led even after the shipped default changes".
 */
export const LEGACY_REPORT_LAYOUT: ReportLayout = "image-led"

/**
 * Hydrate a persisted (possibly legacy) ReportConfig for editing: fill every
 * absent field from `DEFAULT_REPORT_CONFIG` EXCEPT `layout`, whose
 * forward-compat floor is `LEGACY_REPORT_LAYOUT` — so a blob that has never
 * carried a `layout` field keeps rendering the pre-recipes report it always
 * has, independent of what NEW reports now default to. A blob that DOES
 * carry a persisted `layout` (any value, including a past "image-led"
 * choice) always wins over both floors — existing saved reports keep their
 * persisted layout, full stop. This is what ShotReportPage's hydrate effect
 * calls; kept here (not inlined) so the persistence-round-trip tests exercise
 * the real function, not a copy of its logic.
 *
 * Also migrates a legacy `hiddenStatuses` list into the unified `filters`
 * vocabulary EXACTLY ONCE, by delegating the precedence decision to
 * `resolveReportFilters` (the single source of truth for it — see that
 * function's docstring): a `merged` that already carries `filters` (from
 * `stored`, spread last) round-trips through unchanged, since
 * `resolveReportFilters` returns an already-present `filters` verbatim; only
 * a genuinely pre-filters blob with a non-empty `hiddenStatuses` gets the
 * synthetic filter written on. A brand-new config (`merged` from
 * `DEFAULT_REPORT_CONFIG` alone, no `stored` at all) has an empty
 * `hiddenStatuses` too, so it resolves to `[]` and stays untouched — no
 * gratuitous `filters: []` gets written onto a config that never had one.
 */
export function hydrateReportConfig(stored: Partial<ReportConfig>): ReportConfig {
  const merged = { ...DEFAULT_REPORT_CONFIG, layout: LEGACY_REPORT_LAYOUT, ...stored }
  const filters = resolveReportFilters(merged)
  return filters.length === 0 ? merged : { ...merged, filters }
}

/**
 * Recipes-flag rollback safety (independent of `neutralizeReportConfigForFlag`
 * below, which gates the separate `featureReportConfig` flag). When
 * `featureShotReportRecipes` is OFF, the resolved layout is ALWAYS
 * "image-led" — regardless of `config.layout` or `DEFAULT_REPORT_CONFIG.layout`
 * — so dev/preview (no env var) and any flag rollback render, export, AND
 * persist exactly like the pre-recipes report. Single source for the 3 call
 * sites (ReportView's screen render, ShotReportPage's PDF export, and
 * ShotReportListPage's create-report persist path) so they can't drift from
 * each other or silently pick up a future default-layout change while the
 * flag is off.
 */
export function resolveReportLayout(config: ReportConfig, recipesEnabled: boolean): ReportLayout {
  if (!recipesEnabled) return "image-led"
  return config.layout ?? "image-led"
}

/**
 * Flag-off rollback safety. When `featureReportConfig` is OFF, strip every
 * Phase-A/B/filters config field whose control is gated off (so a user can no
 * longer clear it) and clamp the widened `groupBy` back to its pre-Phase-B
 * values — so the derive runs its verbatim legacy path and output stays
 * byte-identical. Exported (not inlined in the page) so the flag-off
 * byte-identity test exercises the REAL code the page runs, not a copy — see
 * reportModel flag-off test.
 */
export function neutralizeReportConfigForFlag(config: ReportConfig, flagOn: boolean): ReportConfig {
  if (flagOn) return config
  return {
    ...config,
    hiddenStatuses: [],
    filters: undefined,
    sortBy: undefined,
    sortDir: undefined,
    // A persisted "status" or "scene" would otherwise render past flag-off
    // (not byte-identical). The two legacy values were always user-settable.
    groupBy: config.groupBy === "gender" || config.groupBy === "none" ? config.groupBy : "gender",
  }
}

/** Normalized gender bucket. "?" = unresolved (never silently dropped). */
export type GenderKey = "W" | "M" | "Mixed" | "?"

export interface ReportProduct {
  readonly family: string
  readonly style: string | null
  readonly colour: string | null
  readonly size: string | null
  readonly sizeScope: import("@/shared/types").SizeScope | null
  readonly qty: number | null
  readonly gender: GenderKey
  readonly isHero: boolean
  /** Image candidate (path/URL) or null. */
  readonly img: string | null
}

export interface ReportLook {
  readonly id: string
  readonly label: string
  readonly isAlt: boolean
  /** Look display image candidate (path/URL) or null. May be a product-image
   *  fallback when there's no uploaded reference — use `hasReference` for the
   *  "references ready" counter, NOT this. */
  readonly image: string | null
  /** True only when the look has an uploaded REFERENCE photo (not a product fallback). */
  readonly hasReference: boolean
  readonly products: readonly ReportProduct[]
}

export interface ReportTalent {
  readonly id: string
  readonly name: string
  /** Headshot candidate (path/URL) or null. */
  readonly img: string | null
}

export type ReportShotStatus = "complete" | "todo" | "in_progress" | "on_hold"

export interface ReportShot {
  readonly id: string
  readonly number: string
  readonly title: string
  readonly colorway: string | null
  readonly status: ReportShotStatus
  readonly gender: GenderKey
  readonly notes: string | null
  readonly talent: readonly ReportTalent[]
  readonly looks: readonly ReportLook[]
  /** True when the user excluded this shot (struck on screen, omitted from PDF). */
  readonly excluded: boolean
  readonly hasImage: boolean
  /**
   * Raw Shot.sortOrder, threaded through for sortBy:"custom". OPTIONAL so the
   * pre-existing hand-built ReportShot fixtures (PDF pagination + style-token
   * regression suites, which never touch sort/group config) keep compiling
   * without updating — every reader treats an absent value as 0 ("no custom
   * order set"), matching mapShot's own `?? 0` default for a Firestore doc
   * that has never carried the field. See shotPrimaryFor in reportModel.ts.
   */
  readonly sortOrder?: number
  /**
   * Shot.laneId (Set membership), threaded through for groupBy:"scene" ("Set").
   * OPTIONAL for the same reason as sortOrder above. Absent/null groups under
   * "No set", same as an id that no longer resolves to a live Lane doc.
   */
  readonly laneId?: string | null
}

export interface ReportGroup {
  /**
   * A gender/status/"all" literal for the pre-existing groupings, OR an
   * arbitrary Lane doc id (or the "No set" sentinel) for groupBy:"scene" —
   * lane ids can't be a closed literal union, so this widens to `string`.
   * Only ever consumed as a React list key / equality check, never switched
   * on exhaustively, so the widening is safe.
   */
  readonly key: GenderKey | "all" | ReportShotStatus | string
  readonly label: string
  readonly count: number
  readonly shots: readonly ReportShot[]
}

export interface ReportModel {
  readonly project: {
    readonly name: string
    readonly client: string
    readonly shotCount: number
    /** Shoot-date window (e.g. "Jun 2–6, 2026"), or null when no dates. Surfaced by production-sheet/balanced-rows mastheads. */
    readonly dateRange: string | null
  }
  readonly groups: readonly ReportGroup[]
  /** The order actually applied to the shots (from the applied config at derive
   *  time). Recipe group heads render formatOrderNote(order) — never a static claim. */
  readonly order: ReportOrder
}
