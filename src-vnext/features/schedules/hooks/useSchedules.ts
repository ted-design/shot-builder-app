import { orderBy } from "firebase/firestore"
import { useFirestoreCollection } from "@/shared/hooks/useFirestoreCollection"
import { schedulesPath } from "@/shared/lib/paths"
import { mapSchedule } from "@/features/schedules/lib/mapSchedule"
import type { Schedule } from "@/shared/types"

export function useSchedules(clientId: string | null, projectId: string) {
  return useFirestoreCollection<Schedule>(
    clientId ? schedulesPath(projectId, clientId) : null,
    [orderBy("createdAt", "desc")],
    mapSchedule,
  )
}
