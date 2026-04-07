import { orderBy } from "firebase/firestore"
import { useFirestoreCollection } from "@/shared/hooks/useFirestoreCollection"
import { castingBoardPath } from "@/shared/lib/paths"
import type { CastingBoardEntry, CastingBoardStatus } from "@/shared/types"

function mapCastingEntry(
  id: string,
  data: Record<string, unknown>,
): CastingBoardEntry {
  return {
    id,
    talentId: (data["talentId"] as string) ?? id,
    talentName: (data["talentName"] as string) ?? "Unknown",
    talentAgency: (data["talentAgency"] as string) ?? null,
    status: (data["status"] as CastingBoardStatus) ?? "shortlist",
    notes: (data["notes"] as string) ?? null,
    roleLabel: (data["roleLabel"] as string) ?? null,
    sortOrder: typeof data["sortOrder"] === "number" ? data["sortOrder"] : 0,
    addedBy: (data["addedBy"] as string) ?? "",
    addedAt: data["addedAt"],
    updatedAt: data["updatedAt"],
  }
}

export function useCastingBoard(
  projectId: string | null,
  clientId: string | null,
): {
  readonly entries: readonly CastingBoardEntry[]
  readonly loading: boolean
  readonly error: Error | null
} {
  const path =
    projectId && clientId ? castingBoardPath(projectId, clientId) : null

  const { data, loading, error } = useFirestoreCollection<CastingBoardEntry>(
    path,
    [orderBy("sortOrder", "asc")],
    mapCastingEntry,
  )

  return {
    entries: data,
    loading,
    error: error ? new Error(error.message) : null,
  }
}
