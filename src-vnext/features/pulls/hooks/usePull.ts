import { useAuth } from "@/app/providers/AuthProvider"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { useFirestoreDoc } from "@/shared/hooks/useFirestoreDoc"
import { pullPath } from "@/shared/lib/paths"
import type { Pull } from "@/shared/types"
import { mapPull } from "@/features/pulls/lib/mapPull"

export function usePull(pullId: string | undefined) {
  const { clientId } = useAuth()
  const { projectId } = useProjectScope()

  return useFirestoreDoc<Pull>(
    clientId && projectId && pullId
      ? pullPath(pullId, projectId, clientId)
      : null,
    mapPull,
  )
}
