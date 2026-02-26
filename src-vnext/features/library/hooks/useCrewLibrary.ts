import { orderBy } from "firebase/firestore"
import { useAuth } from "@/app/providers/AuthProvider"
import { useFirestoreCollection } from "@/shared/hooks/useFirestoreCollection"
import { crewPath } from "@/shared/lib/paths"
import { mapCrewRecord } from "@/features/schedules/lib/mapSchedule"
import type { CrewRecord } from "@/shared/types"

/**
 * Real-time subscription to the org crew library with full field mapping.
 * Sorted by name (ascending) for consistent list ordering.
 */
export function useCrewLibrary() {
  const { clientId } = useAuth()
  return useFirestoreCollection<CrewRecord>(
    clientId ? crewPath(clientId) : null,
    [orderBy("name", "asc")],
    mapCrewRecord,
  )
}
