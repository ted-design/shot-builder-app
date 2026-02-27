import { orderBy } from "firebase/firestore"
import { useAuth } from "@/app/providers/AuthProvider"
import { useFirestoreCollection } from "@/shared/hooks/useFirestoreCollection"
import { usersPath } from "@/shared/lib/paths"
import type { UserProfile } from "@/shared/types"

/**
 * Real-time subscription to the org user roster.
 * Sorted by email (ascending) for consistent list ordering.
 */
export function useUsers() {
  const { clientId } = useAuth()
  return useFirestoreCollection<UserProfile>(
    clientId ? usersPath(clientId) : null,
    [orderBy("email", "asc")],
  )
}
