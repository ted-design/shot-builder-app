import { useFirestoreCollection } from "@/shared/hooks/useFirestoreCollection"
import { crewPath } from "@/shared/lib/paths"
import { mapCrewRecord } from "@/features/schedules/lib/mapSchedule"
import type { CrewRecord } from "@/shared/types"

/**
 * Read-only subscription to the org crew library.
 * No CRUD — crew management is deferred to a future Library slice.
 */
export function useCrew(clientId: string | null) {
  return useFirestoreCollection<CrewRecord>(
    clientId ? crewPath(clientId) : null,
    [],
    mapCrewRecord,
  )
}
