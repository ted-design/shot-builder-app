import { limit, orderBy } from "firebase/firestore"
import { useAuth } from "@/app/providers/AuthProvider"
import { useFirestoreCollection } from "@/shared/hooks/useFirestoreCollection"
import { shotVersionsPath } from "@/shared/lib/paths"
import { mapShotVersion } from "@/features/shots/lib/mapShotVersion"
import type { ShotVersion } from "@/shared/types"

export function useShotVersions(shotId: string | null, maxVersions = 25) {
  const { clientId } = useAuth()
  return useFirestoreCollection<ShotVersion>(
    clientId && shotId ? shotVersionsPath(shotId, clientId) : null,
    [orderBy("createdAt", "desc"), limit(maxVersions)],
    mapShotVersion,
  )
}

