import { useFirestoreCollection } from "@/shared/hooks/useFirestoreCollection"
import { scheduleCrewCallsPath } from "@/shared/lib/paths"
import { mapCrewCall } from "@/features/schedules/lib/mapSchedule"
import type { CrewCallSheet } from "@/shared/types"

export function useScheduleCrewCalls(
  clientId: string | null,
  projectId: string,
  scheduleId: string | null,
) {
  return useFirestoreCollection<CrewCallSheet>(
    clientId && scheduleId
      ? scheduleCrewCallsPath(projectId, scheduleId, clientId)
      : null,
    [],
    mapCrewCall,
  )
}
