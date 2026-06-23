// Resolved, presentation-free model for the Talent report (R4 PR2).
// A NEW report TYPE (talent-centric, call-sheet-adjacent), applying the shipped
// product-info pattern. One card/section per TalentRecord in the project; the DOM
// (TalentReportView) and the @react-pdf renderer (reportPdfTalent) both consume
// this one pure model, so screen and PDF can't drift. The headshot field is a
// *candidate* (a Storage path or URL) resolved to a data URL once via reportImages —
// the model stays pure.

import type { ReportShotStatus } from "./reportTypes"

/** How talent are grouped on the report. */
export type TalentGroupBy = "none" | "gender" | "agency"

/** Which talent surface: those slotted into shots, or every project-attached talent. */
export type TalentScope = "in-shots" | "project-attached"

/** Persisted config — serializable; optional fields default-merge from older blobs. NO imageSize (headshots are small). */
export interface TalentConfig {
  readonly groupBy: TalentGroupBy
  readonly talentScope: TalentScope
  /** Talent excluded by the user — struck on screen, omitted from the PDF. */
  readonly excludedTalentIds: readonly string[]
}

export const DEFAULT_TALENT_CONFIG: TalentConfig = {
  groupBy: "none",
  talentScope: "in-shots",
  excludedTalentIds: [],
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
  /** True when any appearance is on_hold — the ONE red on this surface. */
  readonly onHold: boolean
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
