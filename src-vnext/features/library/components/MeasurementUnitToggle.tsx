import { Button } from "@/ui/button"
import { useMeasurementUnits } from "@/shared/hooks/useMeasurementUnits"
import type { UnitSystem } from "@/features/library/lib/measurementUnits"

const OPTIONS: readonly { readonly key: UnitSystem; readonly label: string }[] = [
  { key: "imperial", label: "Imperial" },
  { key: "metric", label: "Metric" },
]

// Segmented control for the global imperial↔metric display preference (display-only).
export function MeasurementUnitToggle() {
  const { system, setSystem } = useMeasurementUnits()

  return (
    <div
      className="inline-flex items-center gap-1"
      data-testid="measurement-unit-toggle"
    >
      {OPTIONS.map(({ key, label }) => (
        <Button
          type="button"
          key={key}
          variant={system === key ? "default" : "outline"}
          size="sm"
          className="h-7"
          aria-pressed={system === key}
          onClick={() => setSystem(key)}
        >
          {label}
        </Button>
      ))}
    </div>
  )
}
