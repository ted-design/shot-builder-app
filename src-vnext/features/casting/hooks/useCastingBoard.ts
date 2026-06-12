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
    hiddenImageIds: Array.isArray(data["hiddenImageIds"])
      ? (data["hiddenImageIds"] as string[])
      : [],
    hiddenSessionIds: Array.isArray(data["hiddenSessionIds"])
      ? (data["hiddenSessionIds"] as string[])
      : [],
    sortOrder: typeof data["sortOrder"] === "number" ? data["sortOrder"] : 0,
    addedBy: (data["addedBy"] as string) ?? "",
    addedAt: data["addedAt"],
    updatedAt: data["updatedAt"],
  }
}

// Stable options object — permission-denied is the EXPECTED answer for a
// signed-in user with no project membership reading this project-scoped
// collection (firestore.rules project wildcard read arm), not an error worth
// logging. The error still surfaces through the result (TalentPicker's
// flat-list degrade keys off it). Mirrors useEffectiveRole's
// MEMBER_DOC_OPTIONS precedent.
const CASTING_BOARD_OPTIONS = {
  quietErrorCodes: ["permission-denied"],
} as const

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
    CASTING_BOARD_OPTIONS,
  )

  return {
    entries: data,
    loading,
    error: error ? new Error(error.message) : null,
  }
}
