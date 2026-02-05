import { orderBy } from "firebase/firestore"
import { useFirestoreCollection } from "@/shared/hooks/useFirestoreCollection"
import { scheduleEntriesPath } from "@/shared/lib/paths"
import { mapScheduleEntry } from "@/features/schedules/lib/mapSchedule"
import type { ScheduleEntry } from "@/shared/types"

export function useScheduleEntries(
  clientId: string | null,
  projectId: string,
  scheduleId: string | null,
) {
  return useFirestoreCollection<ScheduleEntry>(
    clientId && scheduleId
      ? scheduleEntriesPath(projectId, scheduleId, clientId)
      : null,
    [orderBy("order", "asc")],
    mapScheduleEntry,
  )
}
