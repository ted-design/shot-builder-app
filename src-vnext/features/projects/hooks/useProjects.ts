import { orderBy } from "firebase/firestore"
import { useAuth } from "@/app/providers/AuthProvider"
import { useFirestoreCollection } from "@/shared/hooks/useFirestoreCollection"
import { projectsPath } from "@/shared/lib/paths"
import type { Project } from "@/shared/types"

function mapProject(id: string, data: Record<string, unknown>): Project {
  return {
    id,
    name: (data["name"] as string) ?? "",
    clientId: (data["clientId"] as string) ?? "",
    status: (data["status"] as Project["status"]) ?? "active",
    shootDates: (data["shootDates"] as Project["shootDates"]) ?? [],
    notes: data["notes"] as string | undefined,
    briefUrl: data["briefUrl"] as string | undefined,
    createdAt: data["createdAt"] as Project["createdAt"],
    updatedAt: data["updatedAt"] as Project["updatedAt"],
  }
}

export function useProjects() {
  const { clientId } = useAuth()

  return useFirestoreCollection<Project>(
    clientId ? projectsPath(clientId) : null,
    [orderBy("updatedAt", "desc")],
    mapProject,
  )
}
