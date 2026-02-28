import { useFirestoreCollection } from "@/shared/hooks/useFirestoreCollection"
import { projectMembersPath } from "@/shared/lib/paths"

export interface ProjectMember {
  readonly id: string // userId
  readonly role: string
  readonly addedAt?: unknown
  readonly addedBy?: string
}

export function useProjectMembers(
  projectId: string | null,
  clientId: string | null,
) {
  return useFirestoreCollection<ProjectMember>(
    projectId && clientId ? projectMembersPath(projectId, clientId) : null,
  )
}
