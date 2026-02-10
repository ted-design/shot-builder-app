import { orderBy } from "firebase/firestore"
import { useFirestoreCollection } from "@/shared/hooks/useFirestoreCollection"
import { locationsPath } from "@/shared/lib/paths"
import { mapLocationRecord } from "@/features/schedules/lib/mapSchedule"
import type { LocationRecord } from "@/shared/types"

/**
 * Read-only subscription to org locations for callsheet scheduling surfaces.
 */
export function useLocations(clientId: string | null) {
  return useFirestoreCollection<LocationRecord>(
    clientId ? locationsPath(clientId) : null,
    [orderBy("name", "asc")],
    mapLocationRecord,
  )
}
