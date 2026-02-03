import { useFirestoreCollection } from "@/shared/hooks/useFirestoreCollection"
import { scheduleTalentCallsPath } from "@/shared/lib/paths"
import { mapTalentCall } from "@/features/schedules/lib/mapSchedule"
import type { TalentCallSheet } from "@/shared/types"

export function useScheduleTalentCalls(
  clientId: string | null,
  projectId: string,
  scheduleId: string | null,
) {
  return useFirestoreCollection<TalentCallSheet>(
    clientId && scheduleId
      ? scheduleTalentCallsPath(projectId, scheduleId, clientId)
      : null,
    [],
    mapTalentCall,
  )
}
