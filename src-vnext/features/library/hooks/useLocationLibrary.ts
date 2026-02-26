import { orderBy } from "firebase/firestore"
import { useAuth } from "@/app/providers/AuthProvider"
import { useFirestoreCollection } from "@/shared/hooks/useFirestoreCollection"
import { locationsPath } from "@/shared/lib/paths"
import { mapLocationRecord } from "@/features/schedules/lib/mapSchedule"
import type { LocationRecord } from "@/shared/types"

/**
 * Real-time subscription to the org locations library with full field mapping.
 * Includes all address sub-fields, phone, and photo data.
 * Sorted by name (ascending) for consistent list ordering.
 */
export function useLocationLibrary() {
  const { clientId } = useAuth()
  return useFirestoreCollection<LocationRecord>(
    clientId ? locationsPath(clientId) : null,
    [orderBy("name", "asc")],
    mapLocationRecord,
  )
}
