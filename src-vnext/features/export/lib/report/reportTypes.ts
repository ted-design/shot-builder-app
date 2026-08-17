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
   * set). Tolerated on READ from a raw/un-hydrated persisted blob only:
   * `resolveReportFilters` reads it (when `filters` is absent) to synthesize
   * an equivalent migrated filter. `hydrateReportConfig` clears it to `[]`
   * on the object it RETURNS the moment migration has run (or was never
   * needed) — so page state, and therefore every SAVE from then on (every
   * non-filter setter spreads the current config wholesale), never carries a
   * non-empty value forward. See `resolveReportFilters` for the precedence
   * rule when a raw blob somehow carries both, and reportTypes.test.ts
   * "hydrateReportConfig clears hiddenStatuses once resolved" for the
   * write-back guarantee this depends on.
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
  /**
   * Additional-images row (WS-C, 2026-08-11). OFF/absent renders exactly
   * today's cover-only shot block — byte-identical output (see
   * reportModel.test.ts / reportLayouts.test.tsx "showAdditionalImages
   * absent/false renders nothing extra"). ON renders a row of small thumbs
   * for each of the shot's OTHER look-reference images — see
   * `ReportShot.additionalImages` for the exact derive + dedupe rule.
   * production-sheet + balanced-rows only: image-led is EXCLUDED v1 (its
   * height estimator, reportPdfHeights.ts, has no synced term for a second
   * image row yet) — `reportLayoutSupportsAdditionalImages` /
   * `resolveShowAdditionalImages` below are the single source that keeps the
   * control inert and the row un-rendered on that recipe. Same rollback-safety
   * class as `filters`/`sortBy` above: `neutralizeReportConfigForFlag` clears
   * it when `featureReportConfig` is off.
   */
  readonly showAdditionalImages?: boolean
  /**
   * Tag chips on every shot row (2026-08-17, Ted's request: "I want to see the
   * tags on the shot report export"). Mirrors `showAdditionalImages` above in
   * every mechanical respect — persisted, default-merged by
   * `hydrateReportConfig`, cleared by `neutralizeReportConfigForFlag` when
   * `featureReportConfig` is off — with TWO deliberate differences:
   *
   * 1. The shipped DEFAULT is **ON** (`DEFAULT_REPORT_CONFIG.showTags: true`),
   *    because showing the tags IS the feature. Flag-off byte-identity is
   *    preserved by `neutralizeReportConfigForFlag` + `resolveShowTags`'s
   *    `reportConfigEnabled` term, not by the default — see those two.
   * 2. There is NO per-recipe exclusion (no `reportLayoutSupportsTags`). All
   *    three recipes carry a synced height/weight term for the row —
   *    image-led via `estimatePlateHeight`'s TAG_ROW_* terms
   *    (reportPdfHeights.ts, which drives BOTH the PDF packing and the DOM
   *    print-preview), production-sheet via `shotWeight`'s `tagRowWeight`, and
   *    balanced-rows via `buildStream`'s — so, unlike the additional-images
   *    row, the row is safe on every layout and `resolveShowTags` takes no
   *    `layout` argument at all.
   *
   * ABSENT resolves to ON (`showTags !== false`), matching the shipped default
   * for a raw/un-hydrated config that never carried the field. Only an explicit
   * `false` — the control's Off button, or the flag-off neutralizer — hides it.
   */
  readonly showTags?: boolean
}

/** Stable id for the single synthetic filter `resolveReportFilters` folds a
 *  legacy `hiddenStatuses` list into — never minted by the Filters control
 *  itself (which keys its own entries by field name), so it can't collide. */
export const LEGACY_HIDDEN_STATUSES_FILTER_ID = "legacy-hidden-statuses"

/**
 * De-dupe a filter list to AT MOST ONE condition per field, last occurrence
 * wins. The Filters control itself can never produce two conditions on the
 * same field (setFieldFilter always replaces, never appends — ReportView.tsx),
 * so this only ever matters for a hand-edited/legacy blob — the exact class
 * of input reportTypes.ts already defends against elsewhere (an out-of-union
 * sortBy, reportModel.ts's shotPrimaryFor default). Without this, the THREE
 * readers of `filters` disagreed on what a duplicate-field blob even means:
 * ReportView's `.find()` read the FIRST condition, formatFilterSummary's Map
 * read the LAST, and filterEngine's applyFilterConditions ANDed BOTH. Calling
 * this from the single canonical resolveReportFilters below makes it
 * impossible for those three to diverge — there is only ever one condition
 * per field for any of them to read.
 */
function dedupeFiltersByField(
  filters: readonly ReportFilterCondition[],
): readonly ReportFilterCondition[] {
  const byField = new Map<ReportFilterField, ReportFilterCondition>()
  for (const f of filters) byField.set(f.field, f)
  return [...byField.values()]
}

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
 * correctly without updating). Always returns at most one condition per
 * field — see dedupeFiltersByField.
 */
export function resolveReportFilters(config: {
  readonly filters?: readonly ReportFilterCondition[]
  readonly hiddenStatuses?: readonly ReportShotStatus[]
}): readonly ReportFilterCondition[] {
  if (config.filters !== undefined) return dedupeFiltersByField(config.filters)
  const hidden = config.hiddenStatuses ?? []
  if (hidden.length === 0) return []
  return [{ id: LEGACY_HIDDEN_STATUSES_FILTER_ID, field: "status", operator: "notIn", value: hidden }]
}

const FILTER_FIELD_SUMMARY_LABEL: Record<ReportFilterField, string> = {
  status: "status",
  tag: "tags",
}

// Mirrors FILTER_OPERATOR_OPTIONS' own Include/Exclude vocabulary (ReportView.tsx)
// so the caption never describes an "in" filter and its exact opposite "notIn"
// filter over the same field/value-count with identical text.
const FILTER_OPERATOR_SUMMARY_WORD: Record<ReportFilterOperator, string> = {
  in: "included",
  notIn: "excluded",
}

/**
 * Honest "N active filters" clause appended to the recipe caption by
 * formatOrderNote, e.g. "filtered: status excluded (2), tags included (3)".
 * Names the operator (included/excluded), NOT just a value count — "show
 * only these two statuses" and "hide these two statuses" are opposite
 * arrangements of the shots and must read differently. A field with zero
 * selected values is skipped (an operator chosen before any value is picked
 * isn't "active" yet). Field order is always status-then-tag regardless of
 * array order, so the caption reads identically no matter which the user
 * touched first. Returns null when nothing is active (formatOrderNote then
 * omits the clause entirely rather than printing "filtered: ").
 *
 * De-dupes by field first (resolveReportFilters below is the only producer
 * of `filters` this ever sees on a normal path and already guarantees at
 * most one condition per field, but a hand-edited/legacy blob could still
 * carry two — see reportTypes.test.ts "a hand-edited blob with two
 * conditions on the same field"). Last-write-wins, matching the field's own
 * de-dupe order.
 */
export function formatFilterSummary(filters: readonly ReportFilterCondition[]): string | null {
  const byField = new Map(filters.map((f) => [f.field, f]))
  const parts: string[] = []
  for (const field of ["status", "tag"] as const) {
    const condition = byField.get(field)
    if (condition && condition.value.length > 0) {
      const word = FILTER_OPERATOR_SUMMARY_WORD[condition.operator]
      parts.push(`${FILTER_FIELD_SUMMARY_LABEL[field]} ${word} (${condition.value.length})`)
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
  showAdditionalImages: false,
  // ON by design (2026-08-17) — see ReportConfig.showTags. Flag-off rollback
  // safety is carried by neutralizeReportConfigForFlag + resolveShowTags's
  // reportConfigEnabled term, NOT by this default.
  showTags: true,
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
 *
 * The RETURNED object always has `hiddenStatuses: []`, regardless of what
 * `stored.hiddenStatuses` carried: its only job was feeding
 * `resolveReportFilters` above, and once that's run (migrated or not needed)
 * the legacy field is spent. This is what makes `ReportConfig.hiddenStatuses`'s
 * "no code path writes this field anymore" docstring actually true — the
 * hydrated object becomes live page state, and every subsequent setConfig
 * spreads the CURRENT config (ReportView.tsx's setGroupBy/setSortBy/etc.), so
 * anything still sitting in `hiddenStatuses` here would otherwise get
 * re-persisted to Firestore on the next unrelated edit, forever.
 */
export function hydrateReportConfig(stored: Partial<ReportConfig>): ReportConfig {
  const merged = { ...DEFAULT_REPORT_CONFIG, layout: LEGACY_REPORT_LAYOUT, ...stored }
  const filters = resolveReportFilters(merged)
  const withoutLegacyHiddenStatuses = { ...merged, hiddenStatuses: [] as readonly ReportShotStatus[] }
  return filters.length === 0 ? withoutLegacyHiddenStatuses : { ...withoutLegacyHiddenStatuses, filters }
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
    // Same rollback-safety reasoning as the fields above: a config saved while
    // featureReportConfig was ON could carry showAdditionalImages:true, and
    // with the control hidden the user has no way to clear it themselves.
    showAdditionalImages: false,
    // Same class again, but load-bearing in a way the line above is not:
    // showTags DEFAULTS TO TRUE (and an ABSENT showTags resolves to ON), so
    // without this explicit `false` a featureReportConfig rollback would render
    // tag chips on every shot row of every recipe — i.e. flag-off would NOT be
    // byte-identical to the pre-tag-chips report. This is the write that makes
    // a default-ON feature safe to roll back. See resolveShowTags below for the
    // second, independent gate.
    showTags: false,
  }
}

/**
 * Recipes that can render the additional-images row: production-sheet's small
 * thumb row and balanced-rows' proportional one. image-led is EXCLUDED v1 —
 * its height estimator (reportPdfHeights.ts, shared by the real PDF pagination
 * AND the DOM print-preview's WYSIWYG packShotSheets) has no synced term for a
 * second image row, so rendering it there would silently desync the two.
 */
export function reportLayoutSupportsAdditionalImages(layout: ReportLayout): boolean {
  return layout === "production-sheet" || layout === "balanced-rows"
}

/**
 * The additional-images row actually renders only when BOTH the user has
 * turned it on (the raw persisted `config.showAdditionalImages`) AND both
 * gates hold: the Phase-A/B config flag (`featureReportConfig` — same
 * rollback-safety class `neutralizeReportConfigForFlag` enforces for
 * `filters`/`sortBy` above) and the active recipe supporting the row (see
 * `reportLayoutSupportsAdditionalImages`). Single source for ReportView's
 * screen render, ShotReportPage's PDF export, and the ControlBar's own
 * enabled/inert state, so the three can't drift from each other — mirrors
 * `resolveReportLayout`'s role for `layout`.
 */
export function resolveShowAdditionalImages(
  config: ReportConfig,
  layout: ReportLayout,
  reportConfigEnabled: boolean,
): boolean {
  return (
    reportConfigEnabled &&
    config.showAdditionalImages === true &&
    reportLayoutSupportsAdditionalImages(layout)
  )
}

/**
 * The tag chips actually rendered on a shot row. Single source for ReportView's
 * screen render (all three recipes) and ShotReportPage's PDF export, so the two
 * can't drift — mirrors `resolveShowAdditionalImages`'s role for the extras row
 * and `resolveReportLayout`'s for `layout`.
 *
 * Deliberately takes NO `layout` argument: every recipe carries a synced
 * height/weight term for the tag row (see ReportConfig.showTags), so unlike the
 * additional-images row there is no per-recipe exclusion to enforce. Adding a
 * dead parameter would imply a constraint that does not exist.
 *
 * ABSENT (`undefined`) resolves to ON — the shipped default is `true`, and a
 * raw/un-hydrated config that never carried the field should render what a
 * brand-new report renders. Only an explicit `false` hides the row. The
 * `reportConfigEnabled` term is the flag-off gate: it makes a
 * `featureReportConfig` rollback byte-identical to the pre-tag-chips report
 * even for a config object that was never run through
 * `neutralizeReportConfigForFlag`.
 */
export function resolveShowTags(config: ReportConfig, reportConfigEnabled: boolean): boolean {
  return reportConfigEnabled && config.showTags !== false
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

/**
 * One resolved tag chip on a shot row. Presentation-free: `label` is what the
 * chip prints, `category` is what ordered it (and what excluded the gender
 * tags upstream). `ShotTag.color` is deliberately NOT carried — it is a
 * Tailwind class key with no hex behind it, and the report keeps a reserved
 * palette (see the TagChip primitive's docstring).
 *
 * `category` is typed as a plain `string` rather than `ShotTagCategory` so the
 * report model layer stays free of the shot-domain union — every reader treats
 * it as an opaque ordering/filtering key.
 */
export interface ReportShotTag {
  readonly id: string
  readonly label: string
  readonly category?: string
}

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
  /**
   * Additional-images row (WS-C, 2026-08-11): every reference image on the
   * shot's REPORTED looks (respects looksMode — the same visible-looks slice
   * the shot's own `looks` array above already reflects), MINUS whichever
   * image resolved as the shot's cover (`looks[0].image`) — deduped by
   * RESOLVED IMAGE IDENTITY (downloadURL, falling back to path — the same
   * candidate string the image sidecar keys on), never by reference id: a
   * hero pointing at the same stored object as a reference is excluded no
   * matter its id, and two references sharing a stored object collapse to
   * one thumb. ALWAYS computed by deriveShotReportModel (cheap, pure)
   * regardless of `ReportConfig.showAdditionalImages` — that flag only gates
   * whether a recipe RENDERS this row, so the model never has a
   * flag-shaped hole in it. OPTIONAL so the many pre-existing hand-built
   * ReportShot fixtures (PDF pagination + style-token regression suites, the
   * overflow gate) keep compiling unchanged — every reader treats an absent
   * value as `[]` ("nothing extra to show"), matching a shot with no
   * references.
   */
  readonly additionalImages?: readonly string[]
  /**
   * Tag chips for this shot's row (2026-08-17). The DISPLAY-READY list, not the
   * raw `Shot.tags` — exactly the same "the model owns the derive rule, the
   * config only gates whether a recipe RENDERS it" split `additionalImages`
   * above uses. `resolveReportTagChips` (reportModel.ts) is the single source:
   * it canonicalizes + de-dupes through the shared `tagDedup` helpers, DROPS
   * every `category: "gender"` tag (gender already prints as its own
   * badge/chip and, under `groupBy: "gender"`, as the group head — a chip would
   * be a third statement of the same fact), and sorts media -> priority ->
   * other, alphabetical within.
   *
   * ALWAYS computed by deriveShotReportModel (cheap, pure) regardless of
   * `ReportConfig.showTags`, so the model never has a flag-shaped hole in it.
   * OPTIONAL so every pre-existing hand-built ReportShot fixture (the PDF
   * pagination, style-token and overflow-gate suites) keeps compiling
   * unchanged — every reader treats an absent value as `[]` ("no tags"),
   * matching a shot that carries none.
   */
  readonly tags?: readonly ReportShotTag[]
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
