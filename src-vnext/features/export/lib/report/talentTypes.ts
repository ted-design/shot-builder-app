// Resolved, presentation-free model for the Talent report (R4 PR2).
// A NEW report TYPE (talent-centric, call-sheet-adjacent), applying the shipped
// product-info pattern. One card/section per TalentRecord in the project; the DOM
// (TalentReportView) and the @react-pdf renderer (reportPdfTalent) both consume
// this one pure model, so screen and PDF can't drift. The headshot field is a
// *candidate* (a Storage path or URL) resolved to a data URL once via reportImages —
// the model stays pure.

import type { ReportShotStatus } from "./reportTypes"
import type { SortDir } from "./reportSort"

/** How talent are grouped on the report. "status" (O2) buckets each talent by their
 *  most-outstanding appearance status (one bucket per talent). */
export type TalentGroupBy = "none" | "gender" | "agency" | "status"

// Talent order-by (R5) field vocabulary. Exhaustive typed literal → the option
// list derives from it.
export type TalentSortField = "name" | "gender" | "agency"
export const TALENT_SORT_FIELD_LABEL: Record<TalentSortField, string> = {
  name: "Name",
  gender: "Gender",
  agency: "Agency",
}
export const TALENT_SORT_FIELD_OPTIONS: ReadonlyArray<{ readonly value: TalentSortField; readonly label: string }> =
  (Object.keys(TALENT_SORT_FIELD_LABEL) as TalentSortField[]).map((value) => ({
    value,
    label: TALENT_SORT_FIELD_LABEL[value],
  }))

// R4 density variant. Exhaustive typed literal → the option list + label map
// derive from it (mirror REPORT_LAYOUT_* / TALENT_SORT_FIELD_*). "detail" is the
// shipped 2-up call-sheet card (DEFAULT — flag-off byte-identical); "contact-sheet"
// is the compact casting board (denser grid; hides contact/measurements/per-shot list).
export type TalentLayout = "detail" | "contact-sheet"
export const TALENT_LAYOUT_LABEL: Record<TalentLayout, string> = {
  detail: "Detail",
  "contact-sheet": "Contact sheet",
}
export const TALENT_LAYOUT_OPTIONS: ReadonlyArray<{ readonly value: TalentLayout; readonly label: string }> =
  (Object.keys(TALENT_LAYOUT_LABEL) as TalentLayout[]).map((value) => ({
    value,
    label: TALENT_LAYOUT_LABEL[value],
  }))

// R4 part 2 — adjustable headshot crop (contact-sheet only). Ted's requirement:
// "adjust size/placement". A per-talent focal point + zoom into the fixed 4:5
// contact-sheet frame. x,y ∈ 0–1 normalized focal point (0.5,0.5 = centered);
// scale ≥ 1 zoom (1 = no zoom). Serializable; keyed by talentId on TalentConfig.
export interface HeadshotCrop {
  /** Zoom factor ≥ 1 (1 = fit the cover-cropped frame, no extra zoom). */
  readonly scale: number
  /** Horizontal focal point, 0 (left) – 1 (right). Default 0.5. */
  readonly x: number
  /** Vertical focal point, 0 (top) – 1 (bottom). Default 0.5. */
  readonly y: number
}

export const DEFAULT_HEADSHOT_CROP: HeadshotCrop = { scale: 1, x: 0.5, y: 0.5 }

// Format a 0–1 fraction as a CSS/@react-pdf percent, trimming float noise
// (0.1 → "10%", not "10.000000000000002%"). Both renderers derive object-position
// from this ONE helper so the DOM <img> and the @react-pdf <Image> can't drift.
function toPercent(v: number): string {
  return `${String(+(v * 100).toFixed(2))}%`
}

/** Focal point as percent strings — DOM `object-position` + @react-pdf `objectPositionX/Y`. */
export function cropFocalPercents(crop: HeadshotCrop): { readonly x: string; readonly y: string } {
  return { x: toPercent(crop.x), y: toPercent(crop.y) }
}

/** Zoom transform string, or undefined when scale is 1 (no transform on either surface). */
export function cropZoomTransform(crop: HeadshotCrop): string | undefined {
  return crop.scale === 1 ? undefined : `scale(${String(crop.scale)})`
}

/** Which talent surface: those slotted into shots, or every project-attached talent. */
export type TalentScope = "in-shots" | "project-attached"

/** Persisted config — serializable; optional fields default-merge from older blobs. NO imageSize (headshots are small). */
export interface TalentConfig {
  readonly groupBy: TalentGroupBy
  readonly talentScope: TalentScope
  /** Talent excluded by the user — struck on screen, omitted from the PDF. */
  readonly excludedTalentIds: readonly string[]
  /** Shot statuses to HIDE (R3): a talent is dropped only when ALL their appearances are hidden-status. Defaults to []. */
  readonly hiddenStatuses?: readonly ReportShotStatus[]
  /** R5 order-by: primary sort key within each group. Absent → legacy name order (flag-off byte-identical). */
  readonly sortBy?: TalentSortField
  /** R5 order-by direction. Absent → "asc". Flips the PRIMARY key only; tie-break stays ascending. */
  readonly sortDir?: SortDir
  /** R4 density variant. Absent → "detail" (the shipped call-sheet card, flag-off byte-identical). */
  readonly layout?: TalentLayout
  /** R4 part 2 — per-talent headshot crop (contact-sheet only), keyed by talentId.
   *  Absent/empty → every headshot uses the centered default crop. */
  readonly headshotCrops?: Record<string, HeadshotCrop>
}

export const DEFAULT_TALENT_CONFIG: TalentConfig = {
  groupBy: "none",
  talentScope: "in-shots",
  excludedTalentIds: [],
  hiddenStatuses: [],
  sortBy: "name",
  sortDir: "asc",
  layout: "detail",
  headshotCrops: {},
}

/**
 * Flag-off rollback safety — see reportTypes.neutralizeReportConfigForFlag.
 * Strips the gated-off sort/hidden fields AND clamps the O2-widened `groupBy`
 * back to its pre-O2 legal set, so a persisted "status" can't leak status-grouping
 * flag-off (byte-identity).
 *
 * ⚠ Divergence from the SHOT-report neutralizer: it leaves `layout` alone because
 * shot `layout` shipped BEFORE the flag. Talent `layout` is NEW *behind* the flag
 * (R4), so it MUST be stripped here — deriveTalentModel then folds it to the
 * "detail" default, keeping flag-off byte-identical. Same reasoning for the
 * headshot crop (R4 part 2): clamp it to {} so every headshot renders the default
 * centered crop flag-off (and layout is forced to "detail" anyway, where crop is unused).
 */
export function neutralizeTalentConfigForFlag(config: TalentConfig, flagOn: boolean): TalentConfig {
  if (flagOn) return config
  return {
    ...config,
    hiddenStatuses: [],
    sortBy: undefined,
    sortDir: undefined,
    layout: undefined,
    headshotCrops: {},
    groupBy:
      config.groupBy === "none" || config.groupBy === "gender" || config.groupBy === "agency"
        ? config.groupBy
        : "none",
  }
}

/** One shot a talent appears in: its number/title, the look labels there, and that shot's status. */
export interface TalentAppearance {
  readonly number: string
  readonly title: string
  readonly looks: readonly string[]
  readonly status: ReportShotStatus
}

/** A single talent's labeled fit measurement (e.g. { label: "Height", value: "5'10\"" }). */
export interface TalentMeasurement {
  readonly label: string
  readonly value: string
}

export interface TalentEntry {
  readonly id: string
  /** Display name (buildDisplayName). */
  readonly name: string
  /** Raw stored gender, or null. */
  readonly gender: string | null
  /** Canonical talent gender label (genderDisplayLabel), or null when blank. */
  readonly genderLabel: string | null
  readonly agency: string | null
  readonly email: string | null
  readonly phone: string | null
  readonly web: string | null
  /** Headshot image candidate (path/URL) or null. */
  readonly headshot: string | null
  readonly measurements: readonly TalentMeasurement[]
  readonly excluded: boolean
  readonly appears: readonly TalentAppearance[]
  /** R4 part 2 — resolved headshot crop folded from the (neutralized) config; both
   *  renderers read this so screen + PDF can't drift. Contact-sheet layout only. */
  readonly crop: HeadshotCrop
}

export interface TalentGroup {
  readonly key: string
  readonly label: string
  readonly count: number
  readonly items: readonly TalentEntry[]
}

export interface TalentModel {
  readonly project: {
    readonly name: string
    readonly client: string
    /** Shoot-date window (e.g. "Jun 2–6, 2026"), or null when no dates. */
    readonly dateRange: string | null
    readonly talentCount: number
  }
  readonly groups: readonly TalentGroup[]
  /** R4 density variant folded from the (neutralized) config — both renderers read this. */
  readonly layout: TalentLayout
}
