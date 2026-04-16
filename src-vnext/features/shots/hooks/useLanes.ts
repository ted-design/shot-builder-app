import { useMemo } from "react"
import { orderBy } from "firebase/firestore"
import { useAuth } from "@/app/providers/AuthProvider"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { useFirestoreCollection } from "@/shared/hooks/useFirestoreCollection"
import { lanesPath } from "@/shared/lib/paths"
import { mapLane } from "@/features/shots/lib/mapLane"
import type { Lane } from "@/shared/types"

export function useLanes() {
  const { clientId } = useAuth()
  const { projectId } = useProjectScope()

  const { data, loading, error } = useFirestoreCollection<Lane>(
    clientId && projectId ? lanesPath(projectId, clientId) : null,
    [orderBy("sortOrder", "asc")],
    mapLane,
  )

  const laneNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const lane of data) {
      map.set(lane.id, lane.name)
    }
    return map
  }, [data])

  const laneById = useMemo(() => {
    const map = new Map<string, Lane>()
    for (const lane of data) {
      map.set(lane.id, lane)
    }
    return map
  }, [data])

  return { data, loading, error, laneNameById, laneById }
}
