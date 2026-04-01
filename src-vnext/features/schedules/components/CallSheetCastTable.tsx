import { useMemo } from "react"
import { formatHHMMTo12h } from "@/features/schedules/lib/time"
import {
  DEFAULT_CAST_SECTION,
  FIELD_WIDTH_MAP,
  getVisibleFields,
  type CallSheetSectionFieldConfig,
} from "@/features/schedules/lib/fieldConfig"
import type { TalentCallSheet, TalentRecord, DayDetails } from "@/shared/types"

interface CallSheetCastTableProps {
  readonly talentCalls: readonly TalentCallSheet[]
  readonly talentLookup: readonly TalentRecord[]
  readonly dayDetails: DayDetails | null
  readonly fieldConfig?: CallSheetSectionFieldConfig
}

function formatTime(value: string | null | undefined): string {
  if (!value) return "\u2014"
  return formatHHMMTo12h(value) || value
}

/**
 * Cast / Talent table with editorial section label style.
 * Renders existing data only. Supports per-field customization:
 * rename columns, reorder, resize, and toggle visibility.
 */
export function CallSheetCastTable({
  talentCalls,
  talentLookup,
  dayDetails,
  fieldConfig,
}: CallSheetCastTableProps) {
  const talentMap = new Map<string, TalentRecord>()
  for (const t of talentLookup) talentMap.set(t.id, t)

  const config = fieldConfig ?? DEFAULT_CAST_SECTION
  const visibleFields = useMemo(() => getVisibleFields(config.fields), [config.fields])

  if (talentCalls.length === 0) {
    return (
      <p className="py-2 text-xs text-[var(--color-text-subtle)]">
        No talent call times set.
      </p>
    )
  }

  const shootingCall = dayDetails?.shootingCallTime ?? null

  return (
    <div className="callsheet-table-wrap">
      <table className="callsheet-cs-table">
        <thead>
          <tr>
            {visibleFields.map((field) => {
              const isNumeric = field.key === "id" || field.key === "setCall" || field.key === "wrap" || field.key === "notes"
              return (
                <th
                  key={field.key}
                  style={{ width: FIELD_WIDTH_MAP[field.width] }}
                  className={isNumeric ? "text-right" : undefined}
                >
                  {field.label}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {talentCalls.map((tc, idx) => {
            const talent = talentMap.get(tc.talentId)
            const displayName = talent?.name ?? tc.talentId
            const callTime = tc.callTime ?? tc.callText ?? shootingCall
            const wrapTime = tc.wrapTime ?? null
            const isEven = idx % 2 === 1

            const cellValues: Record<string, React.ReactNode> = {
              id: (
                <td key="id" className="text-center" style={{ fontWeight: 600, fontSize: "10px" }}>
                  {idx + 1}
                </td>
              ),
              talent: (
                <td key="talent" style={{ fontWeight: 600 }}>{displayName}</td>
              ),
              role: (
                <td key="role">{tc.role ?? "\u2014"}</td>
              ),
              setCall: (
                <td key="setCall" className="text-right" style={{ fontWeight: 600 }}>
                  {formatTime(callTime)}
                </td>
              ),
              wrap: (
                <td key="wrap" className="text-right">{formatTime(wrapTime)}</td>
              ),
              notes: (
                <td key="notes" className="text-right">
                  {tc.notes ? (
                    <span className="text-[var(--color-text-muted)]">{tc.notes}</span>
                  ) : (
                    "\u2014"
                  )}
                </td>
              ),
            }

            return (
              <tr key={tc.id} className={isEven ? "callsheet-row-even" : "callsheet-row-odd"}>
                {visibleFields.map((field) => cellValues[field.key] ?? <td key={field.key}>{"\u2014"}</td>)}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
