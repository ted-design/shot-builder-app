import { useMemo } from "react"
import { orderBy } from "firebase/firestore"
import { useAuth } from "@/app/providers/AuthProvider"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { useFirestoreCollection } from "@/shared/hooks/useFirestoreCollection"
import { lanesPath } from "@/shared/lib/paths"
import type { Lane } from "@/shared/types"
import type { Timestamp } from "firebase/firestore"

function mapLane(id: string, data: Record<string, unknown>): Lane {
  const sortOrder = (data["sortOrder"] as number) ?? 0
  const storedSceneNumber = data["sceneNumber"] as number | null | undefined
  // Legacy lanes (pre-S29) have no sceneNumber — fall back to sortOrder + 1 so the
  // UI never shows "undefined" and scene-aware renumbering can still address them.
  const sceneNumber = storedSceneNumber != null ? storedSceneNumber : sortOrder + 1
  return {
    id,
    name: (data["name"] as string) ?? "",
    projectId: (data["projectId"] as string) ?? "",
    clientId: (data["clientId"] as string) ?? "",
    sortOrder,
    color: (data["color"] as string | null) ?? undefined,
    sceneNumber,
    direction: (data["direction"] as string | null) ?? undefined,
    notes: (data["notes"] as string | null) ?? undefined,
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

  const laneById = useMemo(() => {
    const map = new Map<string, Lane>()
    for (const lane of data) {
      map.set(lane.id, lane)
    }
    return map
  }, [data])

  return { data, loading, error, laneNameById, laneById }
}
