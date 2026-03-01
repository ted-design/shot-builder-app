/**
 * Casting brief matching engine.
 *
 * Scores talent against a casting brief based on gender match and
 * per-field measurement proximity. All functions are pure and immutable.
 */

import type { TalentRecord } from "@/shared/types"
import type { GenderKey } from "@/features/library/lib/measurementOptions"
import {
  normalizeGender,
  MEASUREMENT_LABEL_MAP,
} from "@/features/library/lib/measurementOptions"
import { parseMeasurementValue } from "@/features/library/lib/measurementParsing"
import type { MeasurementRange } from "@/features/library/lib/talentFilters"

export interface CastingBrief {
  readonly gender: GenderKey
  readonly requirements: Readonly<Record<string, MeasurementRange>>
}

export interface FieldMatchDetail {
  readonly key: string
  readonly label: string
  readonly rawValue: string | number | null | undefined
  readonly parsedValue: number | null
  readonly required: boolean
  readonly score: number | null
}

export interface TalentMatchResult {
  readonly talent: TalentRecord
  readonly overallScore: number
  readonly fieldDetails: readonly FieldMatchDetail[]
  readonly genderMatch: boolean
  readonly measuredFieldCount: number
  readonly requiredFieldCount: number
}

export const EMPTY_CASTING_BRIEF: CastingBrief = {
  gender: "women",
  requirements: {},
}

/**
 * Score a single measurement field against a range.
 *
 * - If the value is inside [min, max] → 1.0
 * - If outside, score decays linearly. For every 1 unit outside the range,
 *   score decreases by 0.1 (clamped to 0).
 */
function scoreField(value: number, range: MeasurementRange): number {
  const { min, max } = range
  if (min !== null && max !== null) {
    if (value >= min && value <= max) return 1.0
    const span = max - min || 1
    if (value < min) return Math.max(0, 1 - (min - value) / span)
    return Math.max(0, 1 - (value - max) / span)
  }
  if (min !== null) {
    if (value >= min) return 1.0
    return Math.max(0, 1 - (min - value) / (min || 1))
  }
  if (max !== null) {
    if (value <= max) return 1.0
    return Math.max(0, 1 - (value - max) / (max || 1))
  }
  return 1.0
}

export function computeMatchScore(
  talent: TalentRecord,
  brief: CastingBrief,
): TalentMatchResult {
  const genderMatch = normalizeGender(talent.gender) === brief.gender
  const measurements = talent.measurements ?? {}
  const requirementKeys = Object.keys(brief.requirements)

  const fieldDetails: FieldMatchDetail[] = requirementKeys.map((key) => {
    const range = brief.requirements[key]!
    const rawValue = measurements[key] as string | number | null | undefined
    const parsedValue = parseMeasurementValue(rawValue)
    const isRequired = range.min !== null || range.max !== null

    let score: number | null = null
    if (isRequired && parsedValue !== null) {
      score = scoreField(parsedValue, range)
    }

    return {
      key,
      label: MEASUREMENT_LABEL_MAP[key] ?? key,
      rawValue,
      parsedValue,
      required: isRequired,
      score,
    }
  })

  const scoredFields = fieldDetails.filter((f) => f.score !== null)
  const requiredFieldCount = fieldDetails.filter((f) => f.required).length
  const measuredFieldCount = scoredFields.length

  let overallScore: number
  if (!genderMatch) {
    overallScore = 0
  } else if (scoredFields.length === 0) {
    // No data to score — gender matched but no measurement data
    overallScore = requiredFieldCount > 0 ? 0 : 1
  } else {
    const sum = scoredFields.reduce((acc, f) => acc + f.score!, 0)
    overallScore = Math.round((sum / scoredFields.length) * 100) / 100
  }

  return {
    talent,
    overallScore,
    fieldDetails,
    genderMatch,
    measuredFieldCount,
    requiredFieldCount,
  }
}

export function rankTalentForBrief(
  talent: readonly TalentRecord[],
  brief: CastingBrief,
): readonly TalentMatchResult[] {
  const results = talent.map((t) => computeMatchScore(t, brief))

  return [...results].sort((a, b) => {
    // 1. Overall score descending
    if (b.overallScore !== a.overallScore) return b.overallScore - a.overallScore
    // 2. More measured fields first
    if (b.measuredFieldCount !== a.measuredFieldCount)
      return b.measuredFieldCount - a.measuredFieldCount
    // 3. Name ascending
    return a.talent.name.localeCompare(b.talent.name)
  })
}
