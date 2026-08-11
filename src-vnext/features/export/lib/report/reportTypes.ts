// Resolved, presentation-free model for the Comprehensive Shot Report.
// One pure model both renderers consume (DOM ReportView + @react-pdf reportPdf),
// so screen and PDF can't drift. Image fields are *candidates* (a Storage path
// or URL) resolved to data URLs once via reportImages, keyed in a sidecar map —
// the model stays pure (no async, no image bytes).

import type { SortDir } from "./reportSort"
import { SHOT_STATUS_CYCLE, getShotStatusLabel } from "@/shared/lib/statusMappings"

export type ReportGroupBy = "gender" | "none" | "status"

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
// multi-select shared by all three report views. Derived from the canonical
// SHOT_STATUS_CYCLE/getShotStatusLabel (statusMappings.ts) rather than a local
// literal, so the report can't drift from the list/editor vocabulary.
// ReportShotStatus is declared below (type aliases hoist within a module).
export const REPORT_STATUS_LABEL: Record<ReportShotStatus, string> = Object.fromEntries(
  SHOT_STATUS_CYCLE.map((s) => [s, getShotStatusLabel(s)]),
) as Record<ReportShotStatus, string>
export const REPORT_STATUS_OPTIONS: ReadonlyArray<{ readonly value: ReportShotStatus; readonly label: string }> =
  (Object.keys(REPORT_STATUS_LABEL) as ReportShotStatus[]).map((value) => ({
    value,
    label: REPORT_STATUS_LABEL[value],
  }))

// Shot-report order-by (R2) field vocabulary. Exhaustive typed literal → the
// option list derives from it (same pattern as REPORT_LAYOUT_*). Sort is applied
// WITHIN each group at derive time via the shared sortItemsStable engine.
export type ReportSortField = "shot-number" | "talent" | "status" | "gender"
export const REPORT_SORT_FIELD_LABEL: Record<ReportSortField, string> = {
  "shot-number": "Shot #",
  talent: "Talent",
  status: "Status",
  gender: "Gender",
}
export const REPORT_SORT_FIELD_OPTIONS: ReadonlyArray<{ readonly value: ReportSortField; readonly label: string }> =
  (Object.keys(REPORT_SORT_FIELD_LABEL) as ReportSortField[]).map((value) => ({
    value,
    label: REPORT_SORT_FIELD_LABEL[value],
  }))

/** The order actually applied to the resolved model (set at derive time from the
 *  applied config, so it can never drift from the shots' real order). Recipe
 *  captions render this instead of a hardcoded "sorted by shot no." claim. */
export interface ReportOrder {
  readonly sortBy: ReportSortField
  readonly sortDir: SortDir
}

/** Honest, config-driven order caption for the recipe group heads. Reads the
 *  applied order off the model — NOT a persisted config field — so it always
 *  describes the shots as actually sorted. */
export function formatOrderNote(order: ReportOrder): string {
  // Defensive lookup: exportReports persists schemaless (no rules validation),
  // so a hand-edited/legacy blob can carry an out-of-union sortBy. shotPrimaryFor
  // sorts such shots by shot-number, so falling back to that label keeps the
  // caption HONEST (and never crashes on an undefined label — see reportModel.ts).
  const label = REPORT_SORT_FIELD_LABEL[order.sortBy] ?? REPORT_SORT_FIELD_LABEL["shot-number"]
  const field = label.toLowerCase()
  return order.sortDir === "desc" ? `Sorted by ${field}, descending` : `Sorted by ${field}`
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
  /** Shot statuses to HIDE entirely (screen + PDF). Defaults to [] (nothing hidden); an absent field default-merges to []. */
  readonly hiddenStatuses?: readonly ReportShotStatus[]
  /** R2 order-by: primary sort key applied within each group. Absent → legacy shot-number order (flag-off byte-identical). */
  readonly sortBy?: ReportSortField
  /** R2 order-by direction. Absent → "asc". Flips the PRIMARY key only; tie-break stays ascending. */
  readonly sortDir?: SortDir
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
 */
export function hydrateReportConfig(stored: Partial<ReportConfig>): ReportConfig {
  return { ...DEFAULT_REPORT_CONFIG, layout: LEGACY_REPORT_LAYOUT, ...stored }
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
 * Phase-A/B config field whose control is gated off (so a user can no longer
 * clear it) and clamp the widened `groupBy` back to its pre-Phase-B values —
 * so the derive runs its verbatim legacy path and output stays byte-identical.
 * Exported (not inlined in the page) so the flag-off byte-identity test exercises
 * the REAL code the page runs, not a copy — see reportModel flag-off test.
 */
export function neutralizeReportConfigForFlag(config: ReportConfig, flagOn: boolean): ReportConfig {
  if (flagOn) return config
  return {
    ...config,
    hiddenStatuses: [],
    sortBy: undefined,
    sortDir: undefined,
    // A persisted "status" would otherwise render as gender flag-off (not
    // byte-identical). The two legacy values were always user-settable.
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
}

export interface ReportGroup {
  readonly key: GenderKey | "all" | ReportShotStatus
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
