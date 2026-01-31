import { orderBy, where } from "firebase/firestore"
import { useAuth } from "@/app/providers/AuthProvider"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { useFirestoreCollection } from "@/shared/hooks/useFirestoreCollection"
import { shotsPath } from "@/shared/lib/paths"
import { mapShot } from "@/features/shots/lib/mapShot"
import type { Shot } from "@/shared/types"

export function useShots() {
  const { clientId } = useAuth()
  const { projectId } = useProjectScope()

  return useFirestoreCollection<Shot>(
    clientId ? shotsPath(clientId) : null,
    [
      where("projectId", "==", projectId),
      where("deleted", "==", false),
      orderBy("sortOrder", "asc"),
    ],
    mapShot,
  )
}
