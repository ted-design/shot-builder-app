// Resolved, presentation-free model for the Product Info report (R4 PR1).
// A NEW report TYPE (product-centric), applying the shipped shot-report pattern.
// One card/section per ProductFamily; the DOM (ProductInfoReportView) and the
// @react-pdf renderer (reportPdfProductInfo) both consume this one pure model,
// so screen and PDF can't drift. Image fields are *candidates* (a Storage path
// or URL) resolved to data URLs once via reportImages — the model stays pure.

import type { GenderKey } from "./reportTypes"

/** How families are grouped on the report. */
export type ProductInfoGroupBy = "gender" | "product-type" | "none"

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
}

export const DEFAULT_PRODUCT_INFO_CONFIG: ProductInfoConfig = {
  groupBy: "gender",
  productScope: "in-use",
  imageSize: "m",
  excludedFamilyIds: [],
}

/** One appearance of a family: a shot + look it's styled into, with that shot's status. */
export interface ProductInfoAppearance {
  readonly number: string
  readonly look: string
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
