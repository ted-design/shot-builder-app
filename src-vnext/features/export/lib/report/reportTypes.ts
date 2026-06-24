// Resolved, presentation-free model for the Comprehensive Shot Report.
// One pure model both renderers consume (DOM ReportView + @react-pdf reportPdf),
// so screen and PDF can't drift. Image fields are *candidates* (a Storage path
// or URL) resolved to data URLs once via reportImages, keyed in a sidecar map —
// the model stays pure (no async, no image bytes).

export type ReportGroupBy = "gender" | "none"

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

/** Persisted report config — serializable (strings + string[] only); optional fields enable default-merge from older blobs. */
export interface ReportConfig {
  readonly groupBy: ReportGroupBy
  /** Shots the user has excluded — kept visible+struck on screen, omitted from the PDF. */
  readonly excludedShotIds: readonly string[]
  /** "primary-only" shows just each shot's primary look. Defaults to "all". */
  readonly looksMode?: ReportLooksMode
  /** Layout recipe. Defaults to "image-led" so pre-R3 blobs render unchanged. */
  readonly layout?: ReportLayout
}

export const DEFAULT_REPORT_CONFIG: ReportConfig = {
  groupBy: "gender",
  excludedShotIds: [],
  looksMode: "all",
  layout: "image-led",
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
  readonly key: GenderKey | "all"
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
}
