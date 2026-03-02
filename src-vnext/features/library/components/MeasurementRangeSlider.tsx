import { useCallback, useMemo } from "react"
import { Slider } from "@/ui/slider"
import type { MeasurementRange } from "@/features/library/lib/talentFilters"

interface MeasurementRangeSliderProps {
  readonly label: string
  readonly fieldKey: string
  readonly boundsMin: number
  readonly boundsMax: number
  readonly step: number
  readonly value: MeasurementRange
  readonly onChange: (range: MeasurementRange) => void
  readonly disabled?: boolean
}

function formatValue(v: number | null, fallback: string): string {
  if (v === null) return fallback
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

export function MeasurementRangeSlider({
  label,
  fieldKey,
  boundsMin,
  boundsMax,
  step,
  value,
  onChange,
  disabled,
}: MeasurementRangeSliderProps) {
  const currentMin = value.min ?? boundsMin
  const currentMax = value.max ?? boundsMax

  const sliderValue = useMemo(
    () => [currentMin, currentMax],
    [currentMin, currentMax],
  )

  const handleChange = useCallback(
    (next: number[]) => {
      const lo = next[0] ?? boundsMin
      const hi = next[1] ?? boundsMax
      const newMin = lo <= boundsMin ? null : lo
      const newMax = hi >= boundsMax ? null : hi
      onChange({ min: newMin, max: newMax })
    },
    [boundsMin, boundsMax, onChange],
  )

  const isActive = value.min !== null || value.max !== null
  const displayMin = formatValue(value.min, "any")
  const displayMax = formatValue(value.max, "any")

  return (
    <div data-field={fieldKey}>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--color-text-secondary)]">
          {label}
        </span>
        {isActive ? (
          <span className="text-2xs font-medium text-[var(--color-text)]">
            {displayMin} – {displayMax}
          </span>
        ) : (
          <span className="text-2xs text-[var(--color-text-subtle)]">any</span>
        )}
      </div>
      <Slider
        min={boundsMin}
        max={boundsMax}
        step={step}
        value={sliderValue}
        onValueChange={handleChange}
        disabled={disabled}
        className="py-1"
      />
      <div className="flex justify-between">
        <span className="text-3xs text-[var(--color-text-subtle)]">
          {formatValue(boundsMin, "")}
        </span>
        <span className="text-3xs text-[var(--color-text-subtle)]">
          {formatValue(boundsMax, "")}
        </span>
      </div>
    </div>
  )
}
