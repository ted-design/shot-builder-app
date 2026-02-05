import { useFirestoreCollection } from "@/shared/hooks/useFirestoreCollection"
import { scheduleDayDetailsPath } from "@/shared/lib/paths"
import { mapDayDetails } from "@/features/schedules/lib/mapSchedule"
import type { DayDetails } from "@/shared/types"

/**
 * Subscribe to day details for a schedule.
 * Convention: one dayDetails doc per schedule (first doc wins).
 */
export function useScheduleDayDetails(
  clientId: string | null,
  projectId: string,
  scheduleId: string | null,
) {
  const { data, loading, error } = useFirestoreCollection<DayDetails>(
    clientId && scheduleId
      ? scheduleDayDetailsPath(projectId, scheduleId, clientId)
      : null,
    [],
    mapDayDetails,
  )

  return {
    data: data[0] ?? null,
    loading,
    error,
  }
}
