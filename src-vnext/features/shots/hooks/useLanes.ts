import { useMemo } from "react"
import { orderBy } from "firebase/firestore"
import { useAuth } from "@/app/providers/AuthProvider"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { useFirestoreCollection } from "@/shared/hooks/useFirestoreCollection"
import { lanesPath } from "@/shared/lib/paths"
import type { Lane } from "@/shared/types"
import type { Timestamp } from "firebase/firestore"

function mapLane(id: string, data: Record<string, unknown>): Lane {
  return {
    id,
    name: (data["name"] as string) ?? "",
    projectId: (data["projectId"] as string) ?? "",
    clientId: (data["clientId"] as string) ?? "",
    sortOrder: (data["sortOrder"] as number) ?? 0,
    color: (data["color"] as string | null) ?? undefined,
    createdAt: data["createdAt"] as Timestamp,
    updatedAt: data["updatedAt"] as Timestamp,
    createdBy: (data["createdBy"] as string) ?? "",
  }
}

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

  return { data, loading, error, laneNameById }
}
