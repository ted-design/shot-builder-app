import { useAuth } from "@/app/providers/AuthProvider"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { useFirestoreCollection } from "@/shared/hooks/useFirestoreCollection"
import { pullsPath } from "@/shared/lib/paths"
import type { Pull } from "@/shared/types"
import { mapPull } from "@/features/pulls/lib/mapPull"

export function usePulls() {
  const { clientId } = useAuth()
  const { projectId } = useProjectScope()

  return useFirestoreCollection<Pull>(
    clientId && projectId ? pullsPath(projectId, clientId) : null,
    [],
    mapPull,
  )
}
