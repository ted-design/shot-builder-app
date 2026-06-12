import {
  MEASUREMENT_CATEGORY_GROUPS,
  MEASUREMENT_LABEL_MAP,
  normalizeGender,
} from "@/features/library/lib/measurementOptions"
import { formatMeasurement } from "@/features/library/lib/measurementUnits"
import { MEASUREMENT_PLACEHOLDERS } from "@/features/library/components/talentUtils"
import { InlineInput } from "@/features/library/components/TalentInlineEditors"
import { MeasurementUnitToggle } from "@/features/library/components/MeasurementUnitToggle"
import { useMeasurementUnits } from "@/shared/hooks/useMeasurementUnits"
import type { TalentRecord } from "@/shared/types"

interface TalentMeasurementsSectionProps {
  readonly selected: TalentRecord
  readonly canEdit: boolean
  readonly busy: boolean
  readonly savePatch: (id: string, patch: Record<string, unknown>) => Promise<void>
}

export function TalentMeasurementsSection({
  selected,
  canEdit,
  busy,
  savePatch,
}: TalentMeasurementsSectionProps) {
  const genderKey = normalizeGender(selected.gender)
  const measurements = selected.measurements ?? {}
  const { system } = useMeasurementUnits()

  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="heading-subsection">Measurements</div>
        <MeasurementUnitToggle />
      </div>

      <div className="flex flex-col gap-5">
        {MEASUREMENT_CATEGORY_GROUPS.map((group) => {
          const fieldKeys = group.keys[genderKey] ?? []
          if (fieldKeys.length === 0) return null

          return (
            <div key={group.label}>
              <div className="label-meta mb-2">{group.label}</div>
              <div className="grid gap-3 sm:grid-cols-2">
                {fieldKeys.map((key) => {
                  const raw = (measurements as Record<string, unknown>)[key]
                  const display = typeof raw === "string" || typeof raw === "number" ? String(raw) : ""
                  const label = MEASUREMENT_LABEL_MAP[key] ?? key
                  // Read-out only — the input stays RAW; this label reflects the unit toggle.
                  const converted =
                    display.trim() !== ""
                      ? formatMeasurement(key, display, { system, gender: selected.gender })
                      : ""
                  const showConverted = converted !== "" && converted !== display.trim()

                  return (
                    <div key={key}>
                      <div className="label-meta mb-1">{label}</div>
                      <InlineInput
                        value={display}
                        placeholder={MEASUREMENT_PLACEHOLDERS[key] ?? "—"}
                        disabled={!canEdit || busy}
                        onCommit={(next) => {
                          const nextMeasurements = {
                            ...(selected.measurements ?? {}),
                            [key]: next,
                          }
                          void savePatch(selected.id, { measurements: nextMeasurements })
                        }}
                      />
                      {showConverted && (
                        <div className="mt-1 text-xxs text-[var(--color-text-subtle)]">
                          {converted}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <p className="mt-3 text-xxs text-[var(--color-text-subtle)]">
        {selected.gender
          ? `Showing fields for ${genderKey}.`
          : "Set gender to show relevant fields."}{" "}
        Keep values flexible (e.g. 5&apos;9&quot;, 34&quot;).
      </p>
    </div>
  )
}
