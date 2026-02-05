import { useMemo } from "react"
import { orderBy, where } from "firebase/firestore"
import { useAuth } from "@/app/providers/AuthProvider"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { useFirestoreCollection } from "@/shared/hooks/useFirestoreCollection"
import { shotsPath } from "@/shared/lib/paths"
import { mapShot } from "@/features/shots/lib/mapShot"
import type { Shot } from "@/shared/types"

/**
 * Subscribe to shots for the current project.
 *
 * Server query uses projectId + deleted + date (matching the legacy composite index).
 * Client-side sort: prefer sortOrder (vNext), fall back to date then createdAt.
 * This ensures legacy shots (which lack sortOrder) are visible.
 */
export function useShots() {
  const { clientId } = useAuth()
  const { projectId } = useProjectScope()

  const { data, loading, error } = useFirestoreCollection<Shot>(
    clientId ? shotsPath(clientId) : null,
    [
      where("projectId", "==", projectId),
      where("deleted", "==", false),
      orderBy("date", "asc"),
    ],
    mapShot,
  )

  const sorted = useMemo(() => {
    if (data.length === 0) return data
    const hasSortOrder = data.some((s) => s.sortOrder !== 0 && s.sortOrder != null)
    if (!hasSortOrder) return data
    return [...data].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  }, [data])

  return { data: sorted, loading, error }
}
