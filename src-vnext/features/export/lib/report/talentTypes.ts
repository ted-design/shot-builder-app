// Resolved, presentation-free model for the Talent report (R4 PR2).
// A NEW report TYPE (talent-centric, call-sheet-adjacent), applying the shipped
// product-info pattern. One card/section per TalentRecord in the project; the DOM
// (TalentReportView) and the @react-pdf renderer (reportPdfTalent) both consume
// this one pure model, so screen and PDF can't drift. The headshot field is a
// *candidate* (a Storage path or URL) resolved to a data URL once via reportImages —
// the model stays pure.

import type { ReportShotStatus } from "./reportTypes"
import type { SortDir } from "./reportSort"

/** How talent are grouped on the report. */
export type TalentGroupBy = "none" | "gender" | "agency"

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
}

export const DEFAULT_TALENT_CONFIG: TalentConfig = {
  groupBy: "none",
  talentScope: "in-shots",
  excludedTalentIds: [],
  hiddenStatuses: [],
  sortBy: "name",
  sortDir: "asc",
}

/**
 * Flag-off rollback safety — see reportTypes.neutralizeReportConfigForFlag.
 * Talent's `groupBy` was not widened in Phase B, so no groupBy clamp is needed;
 * only the gated-off sort/hidden fields are stripped.
 */
export function neutralizeTalentConfigForFlag(config: TalentConfig, flagOn: boolean): TalentConfig {
  if (flagOn) return config
  return { ...config, hiddenStatuses: [], sortBy: undefined, sortDir: undefined }
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
}
