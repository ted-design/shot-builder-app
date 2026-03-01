/**
 * Hook to load a talent's shot history from Firestore.
 *
 * Queries all non-deleted shots where the talent appears in `talentIds`,
 * ordered by `updatedAt` descending. Maps each shot to a lightweight
 * TalentShotHistoryEntry for display.
 */

import { orderBy, where } from "firebase/firestore"
import { useAuth } from "@/app/providers/AuthProvider"
import { useFirestoreCollection } from "@/shared/hooks/useFirestoreCollection"
import { shotsPath } from "@/shared/lib/paths"
import type { TalentShotHistoryEntry } from "@/features/library/lib/talentShotHistory"

function mapShotToHistoryEntry(
  id: string,
  data: Record<string, unknown>,
): TalentShotHistoryEntry {
  const heroImage = data["heroImage"] as
    | { downloadURL?: string }
    | null
    | undefined
  const date = data["date"] as { toDate?: () => Date } | null | undefined
  const updatedAt = data["updatedAt"] as
    | { toDate?: () => Date }
    | null
    | undefined

  return {
    shotId: id,
    projectId: (data["projectId"] as string) ?? "",
    projectName: (data["projectName"] as string) ?? "",
    shotTitle: (data["title"] as string) ?? "",
    shotNumber: (data["shotNumber"] as string) ?? null,
    shotStatus: (data["status"] as string) ?? "todo",
    heroImageUrl: heroImage?.downloadURL ?? null,
    shootDate:
      date && typeof date.toDate === "function"
        ? date.toDate().toISOString().slice(0, 10)
        : null,
    updatedAt:
      updatedAt && typeof updatedAt.toDate === "function"
        ? updatedAt.toDate()
        : new Date(),
  }
}

export function useTalentShotHistory(
  talentId: string | null,
  clientId?: string | null,
) {
  const auth = useAuth()
  const resolvedClientId = clientId ?? auth.clientId

  const pathSegments =
    talentId && resolvedClientId ? shotsPath(resolvedClientId) : null

  const constraints = talentId
    ? [
        where("talentIds", "array-contains", talentId),
        where("deleted", "==", false),
        orderBy("updatedAt", "desc"),
      ]
    : []

  const { data, loading, error } =
    useFirestoreCollection<TalentShotHistoryEntry>(
      pathSegments,
      constraints,
      mapShotToHistoryEntry,
    )

  return {
    entries: data as readonly TalentShotHistoryEntry[],
    loading,
    error,
  }
}
