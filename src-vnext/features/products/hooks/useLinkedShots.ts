/**
 * Hook to subscribe to shots that reference a given product family.
 *
 * Subscribes to ALL shots for the client (no deleted filter in query,
 * per CLAUDE.md: never use `where("deleted","==",false)` — it excludes
 * docs missing the `deleted` field). Filters client-side:
 *   1. Exclude deleted === true
 *   2. Match shots whose products array contains the target familyId
 *
 * Groups results by projectId for display.
 */

import { useMemo } from "react"
import { useFirestoreCollection } from "@/shared/hooks/useFirestoreCollection"
import { shotsPath } from "@/shared/lib/paths"
import type { ShotFirestoreStatus } from "@/shared/types"

export interface LinkedShotEntry {
  readonly shotId: string
  readonly projectId: string
  readonly projectName: string
  readonly title: string
  readonly shotNumber: string | null
  readonly status: ShotFirestoreStatus
  readonly heroImageUrl: string | null
}

export interface LinkedShotGroup {
  readonly projectId: string
  readonly projectName: string
  readonly shots: readonly LinkedShotEntry[]
}

/**
 * Pure function: group linked shot entries by projectId.
 * Exported for testability.
 */
export function groupLinkedShotsByProject(
  entries: readonly LinkedShotEntry[],
): readonly LinkedShotGroup[] {
  const map = new Map<
    string,
    { readonly projectName: string; readonly shots: LinkedShotEntry[] }
  >()

  for (const entry of entries) {
    const key = entry.projectId || "unknown"
    const existing = map.get(key)
    if (existing) {
      map.set(key, { ...existing, shots: [...existing.shots, entry] })
    } else {
      map.set(key, {
        projectName: entry.projectName || entry.projectId || "Unknown Project",
        shots: [entry],
      })
    }
  }

  return Array.from(map.entries()).map(([projectId, group]) => ({
    projectId,
    projectName: group.projectName,
    shots: group.shots,
  }))
}

/** Internal entry that carries familyIds + deleted for filtering before projection. */
interface RawLinkedShotEntry extends LinkedShotEntry {
  readonly familyIds: readonly string[]
  readonly deleted: boolean
}

function mapRawLinkedShotEntry(
  id: string,
  data: Record<string, unknown>,
): RawLinkedShotEntry {
  const heroImage = data["heroImage"] as
    | { downloadURL?: string }
    | null
    | undefined

  // Collect all familyIds from root products + look products
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
    shotId: id,
    projectId: (data["projectId"] as string) ?? "",
    projectName: (data["projectName"] as string) ?? "",
    title: ((data["title"] as string) ?? (data["name"] as string) ?? "").trim(),
    shotNumber: (data["shotNumber"] as string) ?? null,
    status: (data["status"] as ShotFirestoreStatus) ?? "todo",
    heroImageUrl: heroImage?.downloadURL ?? null,
    deleted: data["deleted"] === true,
    familyIds: [...familyIdSet],
  }
}

export interface UseLinkedShotsResult {
  readonly groups: readonly LinkedShotGroup[]
  readonly loading: boolean
  readonly error: string | null
  readonly totalCount: number
}

export function useLinkedShots(
  familyId: string | null,
  clientId: string | null,
): UseLinkedShotsResult {
  const pathSegments =
    familyId && clientId ? shotsPath(clientId) : null

  const { data: rawShots, loading, error } =
    useFirestoreCollection<RawLinkedShotEntry>(
      pathSegments,
      [],
      mapRawLinkedShotEntry,
    )

  const filtered: readonly LinkedShotEntry[] = useMemo(() => {
    if (!familyId) return []
    return rawShots
      .filter(
        (entry) =>
          !entry.deleted && entry.familyIds.includes(familyId),
      )
      .map((entry) => ({
        shotId: entry.shotId,
        projectId: entry.projectId,
        projectName: entry.projectName,
        title: entry.title,
        shotNumber: entry.shotNumber,
        status: entry.status,
        heroImageUrl: entry.heroImageUrl,
      }))
  }, [rawShots, familyId])

  const groups = useMemo(
    () => groupLinkedShotsByProject(filtered),
    [filtered],
  )

  return {
    groups,
    loading,
    error: error?.message ?? null,
    totalCount: filtered.length,
  }
}
