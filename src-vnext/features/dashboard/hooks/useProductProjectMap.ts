/**
 * Hook to build a map of familyId -> Set<projectId> from all shots.
 *
 * Subscribes to ALL shots for the client via `useFirestoreCollection`.
 * Acceptable for <200 shots per client — revisit if shot volume grows.
 *
 * Client-side filter: excludes deleted === true.
 */

import { useMemo } from "react"
import { useFirestoreCollection } from "@/shared/hooks/useFirestoreCollection"
import { shotsPath } from "@/shared/lib/paths"

// ---------------------------------------------------------------------------
// Raw shot shape (minimal fields for mapping)
// ---------------------------------------------------------------------------

interface RawProjectShot {
  readonly projectId: string
  readonly projectName: string
  readonly familyIds: readonly string[]
  readonly deleted: boolean
}

function mapRawProjectShot(
  _id: string,
  data: Record<string, unknown>,
): RawProjectShot {
  const products = Array.isArray(data["products"])
    ? (data["products"] as Record<string, unknown>[])
    : []
  const looks = Array.isArray(data["looks"])
    ? (data["looks"] as Record<string, unknown>[])
    : []

  const familyIdSet = new Set<string>()
  for (const p of products) {
    const fid = (p["familyId"] ?? p["productId"]) as string | undefined
    if (fid) familyIdSet.add(fid)
  }
  for (const look of looks) {
    const lookProducts = Array.isArray(look["products"])
      ? (look["products"] as Record<string, unknown>[])
      : []
    for (const p of lookProducts) {
      const fid = (p["familyId"] ?? p["productId"]) as string | undefined
      if (fid) familyIdSet.add(fid)
    }
  }

  return {
    projectId: (data["projectId"] as string) ?? "",
    projectName: (data["projectName"] as string) ?? "",
    familyIds: [...familyIdSet],
    deleted: data["deleted"] === true,
  }
}

// ---------------------------------------------------------------------------
// Pure function (exported for testability)
// ---------------------------------------------------------------------------

export interface FamilyProjectMapResult {
  readonly familyProjectMap: ReadonlyMap<string, ReadonlySet<string>>
  readonly projectNames: ReadonlyMap<string, string>
}

/**
 * Build two maps from raw shot data:
 *  - familyProjectMap: familyId -> Set<projectId>
 *  - projectNames: projectId -> projectName
 *
 * Excludes deleted shots.
 */
export function buildFamilyProjectMap(
  shots: readonly RawProjectShot[],
): FamilyProjectMapResult {
  const familyMap = new Map<string, Set<string>>()
  const nameMap = new Map<string, string>()

  for (const shot of shots) {
    if (shot.deleted) continue

    const projectId = shot.projectId
    if (!projectId) continue

    // Track project name (last-write wins, which is fine — names are consistent per project)
    if (shot.projectName) {
      nameMap.set(projectId, shot.projectName)
    }

    for (const familyId of shot.familyIds) {
      const existing = familyMap.get(familyId)
      if (existing) {
        existing.add(projectId)
      } else {
        familyMap.set(familyId, new Set([projectId]))
      }
    }
  }

  // Convert mutable Sets to ReadonlySets for the return value
  const immutableFamilyMap = new Map<string, ReadonlySet<string>>()
  for (const [key, value] of familyMap) {
    immutableFamilyMap.set(key, value)
  }

  return {
    familyProjectMap: immutableFamilyMap,
    projectNames: nameMap,
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export interface UseProductProjectMapResult {
  readonly familyProjectMap: ReadonlyMap<string, ReadonlySet<string>>
  readonly projectNames: ReadonlyMap<string, string>
  readonly loading: boolean
}

export function useProductProjectMap(
  clientId: string | null,
): UseProductProjectMapResult {
  const pathSegments = clientId ? shotsPath(clientId) : null

  const { data: rawShots, loading } =
    useFirestoreCollection<RawProjectShot>(
      pathSegments,
      [],
      mapRawProjectShot,
    )

  const result = useMemo(
    () => buildFamilyProjectMap(rawShots),
    [rawShots],
  )

  return {
    familyProjectMap: result.familyProjectMap,
    projectNames: result.projectNames,
    loading,
  }
}
