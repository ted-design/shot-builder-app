import { formatHHMMTo12h } from "@/features/schedules/lib/time"
import type { TalentCallSheet, TalentRecord, DayDetails } from "@/shared/types"

interface CallSheetCastTableProps {
  readonly talentCalls: readonly TalentCallSheet[]
  readonly talentLookup: readonly TalentRecord[]
  readonly dayDetails: DayDetails | null
}

function formatTime(value: string | null | undefined): string {
  if (!value) return "\u2014"
  return formatHHMMTo12h(value) || value
}

/**
 * Cast / Talent table with editorial section label style.
 * Renders existing data only. The 5-column time layout (Pickup, Report,
 * HMU, Set Call, Wrap) is laid out with placeholders for future data.
 * Per user decision: progressive schema — no new Firestore fields.
 */
export function CallSheetCastTable({
  talentCalls,
  talentLookup,
  dayDetails,
}: CallSheetCastTableProps) {
  const talentMap = new Map<string, TalentRecord>()
  for (const t of talentLookup) talentMap.set(t.id, t)

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
            <th style={{ width: "26px" }} className="text-center">#</th>
            <th style={{ width: "22%" }}>Talent</th>
            <th style={{ width: "20%" }}>Role</th>
            <th style={{ width: "10%" }} className="text-right">Set Call</th>
            <th style={{ width: "10%" }} className="text-right">Wrap</th>
            <th style={{ width: "10%" }} className="text-right">Notes</th>
          </tr>
        </thead>
        <tbody>
          {talentCalls.map((tc, idx) => {
            const talent = talentMap.get(tc.talentId)
            const displayName = talent?.name ?? tc.talentId
            const callTime = tc.callTime ?? tc.callText ?? shootingCall
            const wrapTime = tc.wrapTime ?? null
            const isEven = idx % 2 === 1

            return (
              <tr key={tc.id} className={isEven ? "callsheet-row-even" : "callsheet-row-odd"}>
                <td className="text-center" style={{ fontWeight: 600, fontSize: "10px" }}>
                  {idx + 1}
                </td>
                <td style={{ fontWeight: 600 }}>{displayName}</td>
                <td>{tc.role ?? "\u2014"}</td>
                <td className="text-right" style={{ fontWeight: 600 }}>
                  {formatTime(callTime)}
                </td>
                <td className="text-right">{formatTime(wrapTime)}</td>
                <td className="text-right">
                  {tc.notes ? (
                    <span className="text-[var(--color-text-muted)]">{tc.notes}</span>
                  ) : (
                    "\u2014"
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
