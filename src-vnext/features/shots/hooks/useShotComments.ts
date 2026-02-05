import { orderBy } from "firebase/firestore"
import { useAuth } from "@/app/providers/AuthProvider"
import { useFirestoreCollection } from "@/shared/hooks/useFirestoreCollection"
import { shotCommentsPath } from "@/shared/lib/paths"
import { mapShotComment } from "@/features/shots/lib/mapShotComment"
import type { ShotComment } from "@/shared/types"

export function useShotComments(shotId: string | null) {
  const { clientId } = useAuth()
  return useFirestoreCollection<ShotComment>(
    clientId && shotId ? shotCommentsPath(shotId, clientId) : null,
    [orderBy("createdAt", "desc")],
    mapShotComment,
  )
}

