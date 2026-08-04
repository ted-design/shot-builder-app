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
}

export const DEFAULT_PRODUCT_INFO_CONFIG: ProductInfoConfig = {
  groupBy: "gender",
  productScope: "in-use",
  imageSize: "m",
  excludedFamilyIds: [],
  hiddenStatuses: [],
  sortBy: "style",
  sortDir: "asc",
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
}
