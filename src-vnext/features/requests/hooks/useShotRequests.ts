import { orderBy } from "firebase/firestore"
import { useAuth } from "@/app/providers/AuthProvider"
import { useFirestoreCollection } from "@/shared/hooks/useFirestoreCollection"
import { shotRequestsPath } from "@/shared/lib/paths"
import type { ShotRequest } from "@/shared/types"

export function useShotRequests() {
  const { clientId } = useAuth()
  return useFirestoreCollection<ShotRequest>(
    clientId ? shotRequestsPath(clientId) : null,
    [orderBy("submittedAt", "desc")],
  )
}
