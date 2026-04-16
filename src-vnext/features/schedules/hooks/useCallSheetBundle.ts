import { useSchedule } from "@/features/schedules/hooks/useSchedule"
import { useScheduleDayDetails } from "@/features/schedules/hooks/useScheduleDayDetails"
import { useScheduleEntries } from "@/features/schedules/hooks/useScheduleEntries"
import { useScheduleTalentCalls } from "@/features/schedules/hooks/useScheduleTalentCalls"
import { useScheduleCrewCalls } from "@/features/schedules/hooks/useScheduleCrewCalls"
import { useCallSheetConfig } from "@/features/schedules/hooks/useCallSheetConfig"
import type {
  Schedule,
  DayDetails,
  ScheduleEntry,
  TalentCallSheet,
  CrewCallSheet,
} from "@/shared/types"

// Phase 0.2 compound-query bundle.
//
// Owns a single mount point for every Firestore subscription that belongs
// to the call-sheet builder's "schedule-scoped" data. Composing the
// existing per-slice hooks (instead of re-implementing them) keeps a
// single source of truth for paths + mappers while giving the builder
// one tidy object to destructure.
//
// Loading is the logical OR of every slice. Error surfaces the first
// non-null error, normalised to a string so callers don't need to know
// which underlying hook produced it.

type ErrorLike = string | { message?: string } | null | undefined

function normaliseError(err: ErrorLike): string | null {
  if (err == null) return null
  if (typeof err === "string") return err
  return err.message ?? "Unknown error"
}

function firstError(...errors: ErrorLike[]): string | null {
  for (const err of errors) {
    const normalised = normaliseError(err)
    if (normalised) return normalised
  }
  return null
}

export interface CallSheetBundleLoadingFlags {
  readonly schedule: boolean
  readonly dayDetails: boolean
  readonly entries: boolean
  readonly talentCalls: boolean
  readonly crewCalls: boolean
  readonly config: boolean
}

export interface CallSheetBundle {
  readonly schedule: Schedule | null
  readonly dayDetails: DayDetails | null
  readonly entries: ScheduleEntry[]
  readonly talentCalls: TalentCallSheet[]
  readonly crewCalls: CrewCallSheet[]
  readonly callSheet: ReturnType<typeof useCallSheetConfig>
  readonly loading: boolean
  readonly loadingFlags: CallSheetBundleLoadingFlags
  readonly error: string | null
}

export function useCallSheetBundle(
  clientId: string | null,
  projectId: string,
  scheduleId: string | null,
): CallSheetBundle {
  const schedule = useSchedule(clientId, projectId, scheduleId)
  const dayDetails = useScheduleDayDetails(clientId, projectId, scheduleId)
  const entries = useScheduleEntries(clientId, projectId, scheduleId)
  const talentCalls = useScheduleTalentCalls(clientId, projectId, scheduleId)
  const crewCalls = useScheduleCrewCalls(clientId, projectId, scheduleId)
  const callSheet = useCallSheetConfig(clientId, projectId, scheduleId)

  const loading =
    schedule.loading ||
    dayDetails.loading ||
    entries.loading ||
    talentCalls.loading ||
    crewCalls.loading ||
    callSheet.loading

  const error = firstError(
    schedule.error,
    dayDetails.error,
    entries.error,
    talentCalls.error,
    crewCalls.error,
    callSheet.error,
  )

  return {
    schedule: schedule.data,
    dayDetails: dayDetails.data,
    entries: entries.data,
    talentCalls: talentCalls.data,
    crewCalls: crewCalls.data,
    callSheet,
    loading,
    loadingFlags: {
      schedule: schedule.loading,
      dayDetails: dayDetails.loading,
      entries: entries.loading,
      talentCalls: talentCalls.loading,
      crewCalls: crewCalls.loading,
      config: callSheet.loading,
    },
    error,
  }
}
