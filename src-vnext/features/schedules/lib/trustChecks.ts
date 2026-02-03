import type {
  Schedule,
  ScheduleEntry,
  DayDetails,
  TalentCallSheet,
  CrewCallSheet,
  CrewRecord,
} from "@/shared/types"

// --- Warning model ---

export type TrustWarningId =
  | "talent-missing-calls"
  | "crew-before-crew-call"
  | "no-schedule-entries"
  | "wrap-before-last-entry"

export interface TrustWarning {
  readonly id: TrustWarningId
  readonly message: string
}

// --- Time parsing (heuristic, tolerant of varied input) ---

/**
 * Parses a time string like "6:00 AM", "14:30", "7:00 PM" into minutes since midnight.
 * Returns null if the string is empty or unparseable.
 */
function parseTimeToMinutes(time: string | null | undefined): number | null {
  if (!time) return null
  const trimmed = time.trim().toUpperCase()

  // Try 12-hour format: "6:00 AM", "12:30 PM"
  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (match12) {
    const hStr = match12[1]!
    const mStr = match12[2]!
    const period = match12[3]!
    let hours = parseInt(hStr, 10)
    const minutes = parseInt(mStr, 10)
    if (period === "AM" && hours === 12) hours = 0
    if (period === "PM" && hours !== 12) hours += 12
    return hours * 60 + minutes
  }

  // Try 24-hour format: "14:30", "06:00"
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})$/)
  if (match24) {
    return parseInt(match24[1]!, 10) * 60 + parseInt(match24[2]!, 10)
  }

  return null
}

function isTimeBefore(a: string | null | undefined, b: string | null | undefined): boolean {
  const aMin = parseTimeToMinutes(a)
  const bMin = parseTimeToMinutes(b)
  if (aMin === null || bMin === null) return false
  return aMin < bMin
}

// --- Warning computation ---

interface TrustCheckInput {
  readonly schedule: Schedule | null
  readonly entries: readonly ScheduleEntry[]
  readonly dayDetails: DayDetails | null
  readonly talentCalls: readonly TalentCallSheet[]
  readonly crewCalls: readonly CrewCallSheet[]
  readonly crewLibrary: readonly CrewRecord[]
}

export function computeTrustWarnings(input: TrustCheckInput): readonly TrustWarning[] {
  const { schedule, entries, dayDetails, talentCalls, crewCalls, crewLibrary } = input
  const warnings: TrustWarning[] = []

  // 1. Talent expected but no call overrides resolved
  const participatingIds = schedule?.participatingTalentIds ?? []
  if (participatingIds.length > 0) {
    const calledIds = new Set(talentCalls.map((tc) => tc.talentId))
    const uncalled = participatingIds.filter((id) => !calledIds.has(id))
    if (uncalled.length > 0) {
      const count = uncalled.length
      warnings.push({
        id: "talent-missing-calls",
        message:
          count === 1
            ? "1 talent member from scheduled shots has no call time entry."
            : `${count} talent members from scheduled shots have no call time entries.`,
      })
    }
  }

  // 2. Crew override earlier than crew call
  const crewCallTime = dayDetails?.crewCallTime
  if (crewCallTime) {
    const crewMap = new Map<string, CrewRecord>()
    for (const c of crewLibrary) {
      crewMap.set(c.id, c)
    }

    const earlyNames: string[] = []
    for (const cc of crewCalls) {
      if (cc.callTime && isTimeBefore(cc.callTime, crewCallTime)) {
        const crew = crewMap.get(cc.crewMemberId)
        earlyNames.push(crew?.name ?? "A crew member")
      }
    }
    if (earlyNames.length > 0) {
      const names = earlyNames.length <= 2
        ? earlyNames.join(" and ")
        : `${earlyNames[0]} and ${earlyNames.length - 1} other${earlyNames.length - 1 > 1 ? "s" : ""}`
      warnings.push({
        id: "crew-before-crew-call",
        message: `${names} called earlier than crew call (${crewCallTime}).`,
      })
    }
  }

  // 3. No schedule entries
  if (entries.length === 0) {
    warnings.push({
      id: "no-schedule-entries",
      message: "No shots or entries on this schedule yet.",
    })
  }

  // 4. Estimated wrap earlier than last scheduled entry
  const estimatedWrap = dayDetails?.estimatedWrap
  if (estimatedWrap && entries.length > 0) {
    const lastEntry = [...entries].sort((a, b) => b.order - a.order)[0]
    if (lastEntry?.time && isTimeBefore(estimatedWrap, lastEntry.time)) {
      warnings.push({
        id: "wrap-before-last-entry",
        message: `Estimated wrap (${estimatedWrap}) is earlier than the last scheduled entry (${lastEntry.time}).`,
      })
    }
  }

  return warnings
}
