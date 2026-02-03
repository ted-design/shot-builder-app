import { useFirestoreDoc } from "@/shared/hooks/useFirestoreDoc"
import { schedulePath } from "@/shared/lib/paths"
import { mapSchedule } from "@/features/schedules/lib/mapSchedule"
import type { Schedule } from "@/shared/types"

export function useSchedule(
  clientId: string | null,
  projectId: string,
  scheduleId: string | null,
) {
  return useFirestoreDoc<Schedule>(
    clientId && scheduleId
      ? schedulePath(projectId, scheduleId, clientId)
      : null,
    mapSchedule,
  )
}
