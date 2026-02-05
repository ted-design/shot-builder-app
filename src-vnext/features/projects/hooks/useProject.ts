import { useAuth } from "@/app/providers/AuthProvider"
import { useFirestoreDoc } from "@/shared/hooks/useFirestoreDoc"
import { projectPath } from "@/shared/lib/paths"
import { normalizeShootDates } from "@/features/projects/lib/shootDates"
import type { Project } from "@/shared/types"

function mapProject(id: string, data: Record<string, unknown>): Project {
  return {
    id,
    name: (data["name"] as string) ?? "",
    clientId: (data["clientId"] as string) ?? "",
    status: (data["status"] as Project["status"]) ?? "active",
    shootDates: normalizeShootDates(data["shootDates"]),
    notes: data["notes"] as string | undefined,
    briefUrl: data["briefUrl"] as string | undefined,
    deletedAt: data["deletedAt"],
    createdAt: data["createdAt"] as Project["createdAt"],
    updatedAt: data["updatedAt"] as Project["updatedAt"],
  }
}

export function useProject(projectId: string | null) {
  const { clientId } = useAuth()

  return useFirestoreDoc<Project>(
    clientId && projectId ? projectPath(projectId, clientId) : null,
    mapProject,
  )
}
