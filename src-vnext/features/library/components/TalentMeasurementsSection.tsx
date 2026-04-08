import {
  MEASUREMENT_CATEGORY_GROUPS,
  MEASUREMENT_LABEL_MAP,
  normalizeGender,
} from "@/features/library/lib/measurementOptions"
import { MEASUREMENT_PLACEHOLDERS } from "@/features/library/components/talentUtils"
import { InlineInput } from "@/features/library/components/TalentInlineEditors"
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

  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="heading-subsection mb-3">Measurements</div>

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
