import { useAuth } from "@/app/providers/AuthProvider"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { useFirestoreDoc } from "@/shared/hooks/useFirestoreDoc"
import { pullPath } from "@/shared/lib/paths"
import type { Pull } from "@/shared/types"

function mapPull(id: string, data: Record<string, unknown>): Pull {
  return {
    id,
    projectId: (data["projectId"] as string) ?? "",
    clientId: (data["clientId"] as string) ?? "",
    name: data["name"] as string | undefined,
    shotIds: (data["shotIds"] as string[]) ?? [],
    items: (data["items"] as Pull["items"]) ?? [],
    status: (data["status"] as Pull["status"]) ?? "draft",
    shareToken: data["shareToken"] as string | undefined,
    shareEnabled: (data["shareEnabled"] as boolean) ?? false,
    exportSettings: data["exportSettings"] as Record<string, unknown> | undefined,
    createdAt: data["createdAt"] as Pull["createdAt"],
    updatedAt: data["updatedAt"] as Pull["updatedAt"],
  }
}

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
