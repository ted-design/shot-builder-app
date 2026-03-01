/**
 * Pure filtering functions for the talent library.
 *
 * All functions are immutable — they never mutate inputs and always
 * return new arrays/objects.
 */

import type { TalentRecord } from "@/shared/types"
import { normalizeGender } from "@/features/library/lib/measurementOptions"
import { parseMeasurementValue } from "@/features/library/lib/measurementParsing"

export interface MeasurementRange {
  readonly min: number | null
  readonly max: number | null
}

export interface TalentSearchFilters {
  readonly query: string
  readonly gender: string | null
  readonly agency: string | null
  readonly measurementRanges: Readonly<Record<string, MeasurementRange>>
  readonly hasCastingHistory: boolean | null
}

export const EMPTY_TALENT_FILTERS: TalentSearchFilters = {
  query: "",
  gender: null,
  agency: null,
  measurementRanges: {},
  hasCastingHistory: null,
}

function matchesQuery(talent: TalentRecord, query: string): boolean {
  if (!query) return true
  const lower = query.toLowerCase()
  const name = (talent.name ?? "").toLowerCase()
  const agency = (talent.agency ?? "").toLowerCase()
  const email = (talent.email ?? "").toLowerCase()
  return name.includes(lower) || agency.includes(lower) || email.includes(lower)
}

function matchesGender(talent: TalentRecord, gender: string | null): boolean {
  if (!gender) return true
  return normalizeGender(talent.gender) === normalizeGender(gender)
}

function matchesAgency(talent: TalentRecord, agency: string | null): boolean {
  if (!agency) return true
  return (talent.agency ?? "") === agency
}

function matchesMeasurementRanges(
  talent: TalentRecord,
  ranges: Readonly<Record<string, MeasurementRange>>,
): boolean {
  const keys = Object.keys(ranges)
  if (keys.length === 0) return true

  const measurements = talent.measurements ?? {}
  for (const key of keys) {
    const range = ranges[key]!
    if (range.min === null && range.max === null) continue

    const raw = measurements[key]
    const parsed = parseMeasurementValue(raw as string | number | null | undefined)
    if (parsed === null) return false

    if (range.min !== null && parsed < range.min) return false
    if (range.max !== null && parsed > range.max) return false
  }
  return true
}

function matchesCastingHistory(
  talent: TalentRecord,
  hasCastingHistory: boolean | null,
): boolean {
  if (hasCastingHistory === null) return true
  const sessions = talent.castingSessions ?? []
  return hasCastingHistory ? sessions.length > 0 : sessions.length === 0
}

export function filterTalent(
  talent: readonly TalentRecord[],
  filters: TalentSearchFilters,
): readonly TalentRecord[] {
  return talent.filter(
    (t) =>
      matchesQuery(t, filters.query) &&
      matchesGender(t, filters.gender) &&
      matchesAgency(t, filters.agency) &&
      matchesMeasurementRanges(t, filters.measurementRanges) &&
      matchesCastingHistory(t, filters.hasCastingHistory),
  )
}

export function extractUniqueAgencies(
  talent: readonly TalentRecord[],
): readonly string[] {
  const agencies = new Set<string>()
  for (const t of talent) {
    if (t.agency) agencies.add(t.agency)
  }
  return Array.from(agencies).sort()
}
