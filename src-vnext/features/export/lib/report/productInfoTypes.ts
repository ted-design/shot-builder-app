// Resolved, presentation-free model for the Product Info report (R4 PR1).
// A NEW report TYPE (product-centric), applying the shipped shot-report pattern.
// One card/section per ProductFamily; the DOM (ProductInfoReportView) and the
// @react-pdf renderer (reportPdfProductInfo) both consume this one pure model,
// so screen and PDF can't drift. Image fields are *candidates* (a Storage path
// or URL) resolved to data URLs once via reportImages — the model stays pure.

import type { GenderKey, ReportShotStatus } from "./reportTypes"
import type { SortDir } from "./reportSort"

/** How families are grouped on the report. "status" (O2) buckets each family by its
 *  most-outstanding appearance status (one bucket per family). */
export type ProductInfoGroupBy = "gender" | "product-type" | "status" | "none"

// Product-info order-by (R5) field vocabulary. Product families carry no
// shot-number/status/talent at entry level (those live per-appearance in
// appears[]), so only entry-level keys are offered this ship. Exhaustive typed
// literal → the option list derives from it.
export type ProductInfoSortField = "style" | "gender"
export const PRODUCT_INFO_SORT_FIELD_LABEL: Record<ProductInfoSortField, string> = {
  style: "Style",
  gender: "Gender",
}
export const PRODUCT_INFO_SORT_FIELD_OPTIONS: ReadonlyArray<{ readonly value: ProductInfoSortField; readonly label: string }> =
  (Object.keys(PRODUCT_INFO_SORT_FIELD_LABEL) as ProductInfoSortField[]).map((value) => ({
    value,
    label: PRODUCT_INFO_SORT_FIELD_LABEL[value],
  }))

/** Which families surface: those styled into shots, or the whole library. */
export type ProductInfoScope = "in-use" | "library"

/** Image / column density. S/M/L is a display knob only (no letterbox). */
export type ProductInfoImageSize = "s" | "m" | "l"

/**
 * Density variant (R4/Phase C). Mirrors the shot report's REPORT_LAYOUT_* pattern.
 * - "gallery": image-forward editorial card grid — the shipped R4 output (default,
 *   so flag-off + pre-Phase-C blobs resolve here and stay BYTE-IDENTICAL).
 * - "index": compact spec/pull sheet — small thumb + tight tabular rows, more
 *   families per landscape sheet. The density that actually reaches print/PDF
 *   (imageSize never did — it is screen-only).
 * Presentation-only: deriveProductInfoModel folds it onto the model but never
 * reads it for grouping/sorting, so both renderers read one pre-neutralized value.
 */
export type ProductInfoLayout = "gallery" | "index"

// Layout display labels — the single source for the picker + the in-report switch.
// An exhaustive typed literal (TS flags a missing variant); the option list derives
// from it so the strings aren't duplicated (mirror REPORT_LAYOUT_LABEL/OPTIONS).
export const PRODUCT_INFO_LAYOUT_LABEL: Record<ProductInfoLayout, string> = {
  gallery: "Gallery",
  index: "Index",
}
export const PRODUCT_INFO_LAYOUT_OPTIONS: ReadonlyArray<{ readonly value: ProductInfoLayout; readonly label: string }> =
  (Object.keys(PRODUCT_INFO_LAYOUT_LABEL) as ProductInfoLayout[]).map((value) => ({
    value,
    label: PRODUCT_INFO_LAYOUT_LABEL[value],
  }))

/**
 * Per-layout print/PDF packing — the SINGLE source of truth both renderers read
 * so the on-screen paged preview and the @react-pdf export can't drift. `printCols`
 * drives the grid column count; `cardsPerSheet` drives pagination. EYEBALL-GATE
 * these against a real render (see reportPdfProductInfo IMAGE_MAX_HEIGHT note).
 */
export interface ProductInfoLayoutGeometry {
  readonly printCols: number
  readonly cardsPerSheet: number
}
export const PRODUCT_INFO_LAYOUT_GEOMETRY: Record<ProductInfoLayout, ProductInfoLayoutGeometry> = {
  // gallery = the shipped pre-Phase-C packing (4×3). NOTE: a real render shows only ~8 fit a
  // landscape sheet, so gallery strands a partial page — a PRE-EXISTING defect kept byte-identical
  // here; recalibration is a separate follow-up (see Phase C notes).
  gallery: { printCols: 4, cardsPerSheet: 12 },
  // index = new Phase-C variant. Calibrated against a real render (Q2-26 data): exactly 10 rows × 2
  // fit one landscape sheet (22 stranded 2; 20 packs clean). Page-wrap is the safety net.
  index: { printCols: 2, cardsPerSheet: 20 },
}

/** Persisted config — serializable; optional fields default-merge from older blobs. */
export interface ProductInfoConfig {
  readonly groupBy: ProductInfoGroupBy
  readonly productScope: ProductInfoScope
  readonly imageSize: ProductInfoImageSize
  /** Families excluded by the user — struck on screen, omitted from the PDF. */
  readonly excludedFamilyIds: readonly string[]
  /** Shot statuses to HIDE (R3): a family is dropped only when ALL its appearances are hidden-status. Defaults to []. */
  readonly hiddenStatuses?: readonly ReportShotStatus[]
  /** R5 order-by: primary sort key within each group. Absent → legacy styleName order (flag-off byte-identical). */
  readonly sortBy?: ProductInfoSortField
  /** R5 order-by direction. Absent → "asc". Flips the PRIMARY key only; tie-break stays ascending. */
  readonly sortDir?: SortDir
  /** R4 density variant. Absent → "gallery" (the shipped output; flag-off byte-identical). */
  readonly layout?: ProductInfoLayout
}

export const DEFAULT_PRODUCT_INFO_CONFIG: ProductInfoConfig = {
  groupBy: "gender",
  productScope: "in-use",
  imageSize: "m",
  excludedFamilyIds: [],
  hiddenStatuses: [],
  sortBy: "style",
  sortDir: "asc",
  layout: "gallery",
}

/**
 * Flag-off rollback safety — see reportTypes.neutralizeReportConfigForFlag.
 * Strips the gated-off sort/hidden fields AND clamps the O2-widened `groupBy`
 * back to its pre-O2 legal set, so a persisted "status" can't leak status-grouping
 * flag-off (byte-identity).
 */
export function neutralizeProductInfoConfigForFlag(config: ProductInfoConfig, flagOn: boolean): ProductInfoConfig {
  if (flagOn) return config
  return {
    ...config,
    hiddenStatuses: [],
    sortBy: undefined,
    sortDir: undefined,
    // R4: the density picker is gated, so flag-off must clamp back to the shipped
    // "gallery" output (a persisted "index" would otherwise leak the dense layout).
    layout: "gallery",
    groupBy:
      config.groupBy === "gender" || config.groupBy === "product-type" || config.groupBy === "none"
        ? config.groupBy
        : "gender",
  }
}

/** One shot a family is styled into: its number, the look labels it appears in there, and that shot's status. */
export interface ProductInfoAppearance {
  readonly number: string
  readonly looks: readonly string[]
  readonly status: import("./reportTypes").ReportShotStatus
}

export interface ProductInfoEntry {
  /** Family id. */
  readonly id: string
  readonly styleName: string
  readonly styleNumber: string | null
  /** Raw-normalized gender used for group-by. */
  readonly gender: GenderKey
  /** Display label for the family's gender, or null when unresolved. */
  readonly genderLabel: string | null
  readonly productType: string | null
  /** Image candidate (path/URL) or null. */
  readonly image: string | null
  readonly colours: readonly string[]
  readonly sizes: readonly string[]
  readonly sizePending: boolean
  readonly isHero: boolean
  readonly excluded: boolean
  readonly appears: readonly ProductInfoAppearance[]
}

export interface ProductInfoGroup {
  readonly key: string
  readonly label: string
  readonly count: number
  readonly items: readonly ProductInfoEntry[]
}

export interface ProductInfoModel {
  readonly project: {
    readonly name: string
    readonly client: string
    /** Shoot-date window (e.g. "Jun 2–6, 2026"), or null when no dates. */
    readonly dateRange: string | null
    readonly familyCount: number
  }
  readonly groups: readonly ProductInfoGroup[]
  /** R4 density variant, resolved from the (neutralized) config at derive time.
   *  Both the DOM view and the PDF read THIS pre-clamped value so they can't drift. */
  readonly layout: ProductInfoLayout
}
