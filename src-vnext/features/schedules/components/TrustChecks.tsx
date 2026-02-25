import { useMemo } from "react"
import { Info } from "lucide-react"
import { computeTrustWarnings } from "@/features/schedules/lib/trustChecks"
import type {
  Schedule,
  ScheduleEntry,
  DayDetails,
  TalentCallSheet,
  CrewCallSheet,
  CrewRecord,
} from "@/shared/types"

interface TrustChecksProps {
  readonly schedule: Schedule | null
  readonly participatingTalentIds?: readonly string[]
  readonly entries: readonly ScheduleEntry[]
  readonly dayDetails: DayDetails | null
  readonly talentCalls: readonly TalentCallSheet[]
  readonly crewCalls: readonly CrewCallSheet[]
  readonly crewLibrary: readonly CrewRecord[]
}

export function TrustChecks({
  schedule,
  participatingTalentIds,
  entries,
  dayDetails,
  talentCalls,
  crewCalls,
  crewLibrary,
}: TrustChecksProps) {
  const warnings = useMemo(
    () =>
      computeTrustWarnings({
        schedule,
        participatingTalentIds,
        entries,
        dayDetails,
        talentCalls,
        crewCalls,
        crewLibrary,
      }),
    [schedule, participatingTalentIds, entries, dayDetails, talentCalls, crewCalls, crewLibrary],
  )

  if (warnings.length === 0) return null

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-[var(--color-warning-muted,var(--color-border))] bg-[var(--color-warning-subtle,var(--color-surface))] p-3">
      <div className="flex items-center gap-1.5">
        <Info className="h-3.5 w-3.5 shrink-0 text-[var(--color-warning,#b45309)]" />
        <span className="text-2xs font-semibold uppercase tracking-wide text-[var(--color-warning,#b45309)]">
          Heads up
        </span>
      </div>
      <ul className="flex flex-col gap-1">
        {warnings.map((w) => (
          <li
            key={w.id}
            className="text-xs leading-relaxed text-[var(--color-text-muted)]"
          >
            {w.message}
          </li>
        ))}
      </ul>
    </div>
  )
}
