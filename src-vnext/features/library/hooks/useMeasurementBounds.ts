import { useMemo } from "react"
import type { TalentRecord } from "@/shared/types"
import type { GenderKey } from "@/features/library/lib/measurementOptions"
import {
  normalizeGender,
  getMeasurementOptionsForGender,
} from "@/features/library/lib/measurementOptions"
import { parseMeasurementValue } from "@/features/library/lib/measurementParsing"

export interface MeasurementBounds {
  readonly min: number
  readonly max: number
  readonly step: number
}

const FIELD_STEPS: Readonly<Record<string, number>> = {
  height: 1,
  waist: 0.5,
  chest: 0.5,
  hips: 0.5,
  bust: 0.5,
  inseam: 0.5,
  collar: 0.5,
  sleeve: 0.5,
  shoes: 0.5,
  suit: 1,
  dress: 1,
}

const DEFAULT_BOUNDS: Readonly<Record<string, Record<GenderKey, MeasurementBounds>>> = {
  height: {
    women: { min: 60, max: 78, step: 1 },
    men: { min: 64, max: 80, step: 1 },
    other: { min: 58, max: 82, step: 1 },
  },
  waist: {
    women: { min: 22, max: 40, step: 0.5 },
    men: { min: 28, max: 44, step: 0.5 },
    other: { min: 22, max: 44, step: 0.5 },
  },
  hips: {
    women: { min: 30, max: 48, step: 0.5 },
    men: { min: 30, max: 48, step: 0.5 },
    other: { min: 30, max: 48, step: 0.5 },
  },
  bust: {
    women: { min: 28, max: 44, step: 0.5 },
    men: { min: 28, max: 44, step: 0.5 },
    other: { min: 28, max: 44, step: 0.5 },
  },
  chest: {
    women: { min: 30, max: 44, step: 0.5 },
    men: { min: 34, max: 52, step: 0.5 },
    other: { min: 30, max: 52, step: 0.5 },
  },
  shoes: {
    women: { min: 5, max: 12, step: 0.5 },
    men: { min: 7, max: 15, step: 0.5 },
    other: { min: 5, max: 15, step: 0.5 },
  },
  inseam: {
    women: { min: 26, max: 36, step: 0.5 },
    men: { min: 28, max: 38, step: 0.5 },
    other: { min: 26, max: 38, step: 0.5 },
  },
  collar: {
    women: { min: 12, max: 18, step: 0.5 },
    men: { min: 14, max: 20, step: 0.5 },
    other: { min: 12, max: 20, step: 0.5 },
  },
  sleeve: {
    women: { min: 28, max: 38, step: 0.5 },
    men: { min: 30, max: 40, step: 0.5 },
    other: { min: 28, max: 40, step: 0.5 },
  },
  suit: {
    women: { min: 0, max: 16, step: 1 },
    men: { min: 34, max: 52, step: 1 },
    other: { min: 0, max: 52, step: 1 },
  },
  dress: {
    women: { min: 0, max: 16, step: 1 },
    men: { min: 0, max: 16, step: 1 },
    other: { min: 0, max: 16, step: 1 },
  },
}

function getDefaultBounds(fieldKey: string, gender: GenderKey): MeasurementBounds {
  const step = FIELD_STEPS[fieldKey] ?? 0.5
  const defaults = DEFAULT_BOUNDS[fieldKey]
  if (defaults) return defaults[gender]
  return { min: 0, max: 100, step }
}

export function useMeasurementBounds(
  talent: readonly TalentRecord[],
  gender: GenderKey,
): Readonly<Record<string, MeasurementBounds>> {
  return useMemo(() => {
    const genderTalent = talent.filter(
      (t) => normalizeGender(t.gender) === gender,
    )
    const fields = getMeasurementOptionsForGender(gender)
    const bounds: Record<string, MeasurementBounds> = {}

    for (const field of fields) {
      const step = FIELD_STEPS[field.key] ?? 0.5
      const values: number[] = []

      for (const t of genderTalent) {
        const raw = (t.measurements ?? {})[field.key] as
          | string
          | number
          | null
          | undefined
        const parsed = parseMeasurementValue(raw)
        if (parsed !== null) values.push(parsed)
      }

      if (values.length < 2) {
        bounds[field.key] = getDefaultBounds(field.key, gender)
        continue
      }

      const dataMin = values.reduce((a, b) => (b < a ? b : a), values[0]!)
      const dataMax = values.reduce((a, b) => (b > a ? b : a), values[0]!)
      const padding = Math.max(step * 2, (dataMax - dataMin) * 0.1)
      const flooredMin = Math.floor((dataMin - padding) / step) * step
      const ceiledMax = Math.ceil((dataMax + padding) / step) * step

      bounds[field.key] = {
        min: flooredMin,
        max: ceiledMax,
        step,
      }
    }

    return bounds
  }, [talent, gender])
}
