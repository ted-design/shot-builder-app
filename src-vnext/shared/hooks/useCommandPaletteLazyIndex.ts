import { useEffect, useRef, useState } from "react"
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore"
import { toast } from "sonner"
import { db } from "@/shared/lib/firebase"
import { lanesPath, pullsPath, shotsPath } from "@/shared/lib/paths"
import { mapShot } from "@/features/shots/lib/mapShot"
import { mapPull } from "@/features/pulls/lib/mapPull"
import { mapLane } from "@/features/shots/lib/mapLane"
import {
  mapLaneToSceneEntry,
  mapPullToEntry,
  mapShotToEntry,
  type SearchEntry,
} from "@/shared/lib/commandPaletteUtils"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const MAX_LAZY_RESULTS = 200

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseCommandPaletteLazyIndexParams {
  readonly open: boolean
  readonly projectId: string | null
  readonly clientId: string | null
}

// ---------------------------------------------------------------------------
// Core fetch (exported for unit tests)
// ---------------------------------------------------------------------------

/**
 * Fetch the recent shots / pulls / lanes for a project and shape them into
 * SearchEntry instances. Uses the real feature mappers (mapShot, mapPull,
 * mapLane) so legacy-field normalization matches the primary list views.
 *
 * Pulls intentionally drop the `updatedAt >= thirtyDaysAgo` range filter —
 * Firestore range queries silently exclude documents missing the field, which
 * would hide legacy pulls from the palette. The `orderBy("updatedAt", "desc")
 * + limit(200)` gives the same "recent first" effect consistently with what
 * the pulls list page already shows.
 */
export async function fetchLazyIndexEntries(
  projectId: string,
  clientId: string,
): Promise<SearchEntry[]> {
  const thirtyDaysAgo = Timestamp.fromMillis(Date.now() - THIRTY_DAYS_MS)

  const shotsSegs = shotsPath(clientId)
  const pullsSegs = pullsPath(projectId, clientId)
  const lanesSegs = lanesPath(projectId, clientId)

  const shotsQuery = query(
    collection(db, shotsSegs[0]!, ...shotsSegs.slice(1)),
    where("projectId", "==", projectId),
    where("deleted", "==", false),
    where("updatedAt", ">=", thirtyDaysAgo),
    orderBy("updatedAt", "desc"),
    limit(MAX_LAZY_RESULTS),
  )
  const pullsQuery = query(
    collection(db, pullsSegs[0]!, ...pullsSegs.slice(1)),
    orderBy("updatedAt", "desc"),
    limit(MAX_LAZY_RESULTS),
  )
  const lanesQuery = query(
    collection(db, lanesSegs[0]!, ...lanesSegs.slice(1)),
    orderBy("sortOrder", "asc"),
    limit(MAX_LAZY_RESULTS),
  )

  const [shotsSnap, pullsSnap, lanesSnap] = await Promise.all([
    getDocs(shotsQuery),
    getDocs(pullsQuery),
    getDocs(lanesQuery),
  ])

  const shotEntries = shotsSnap.docs.map((d) =>
    mapShotToEntry(mapShot(d.id, d.data() as Record<string, unknown>)),
  )
  const pullEntries = pullsSnap.docs.map((d) =>
    mapPullToEntry(mapPull(d.id, d.data() as Record<string, unknown>)),
  )
  const sceneEntries = lanesSnap.docs.map((d) =>
    mapLaneToSceneEntry(mapLane(d.id, d.data() as Record<string, unknown>)),
  )

  return [...shotEntries, ...pullEntries, ...sceneEntries]
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Lazily fetches recent shots / pulls / scenes for the active project when the
 * Cmd+K palette opens.
 *
 * Design notes:
 * - Promise-memoization via a ref keyed by projectId short-circuits duplicate
 *   fetches under React 18 StrictMode (mount → cleanup → mount double-invoke).
 *   The first mount kicks off the promise and stores it; the second mount finds
 *   the same key and awaits the same promise — no duplicate Firestore reads
 *   and no broken first-open cache.
 * - A single effect owns both the purge (on project switch) and load paths so
 *   a render can never observe stale cross-project data in between them.
 * - `cancelled` flag guards against setState after unmount; the promise itself
 *   stays in the cache so a remount picks up the resolved value.
 * - On fetch failure, the promise is evicted so a retry happens on next open.
 */
export function useCommandPaletteLazyIndex(
  params: UseCommandPaletteLazyIndexParams,
): ReadonlyArray<SearchEntry> {
  const { open, projectId, clientId } = params

  const [lazyEntries, setLazyEntries] = useState<ReadonlyArray<SearchEntry>>([])
  const [lazyLoadedProjectId, setLazyLoadedProjectId] = useState<string | null>(null)

  // Map of projectId → in-flight (or resolved) fetch promise. Living in a ref
  // lets StrictMode mount #2 observe mount #1's work.
  const fetchPromiseRef = useRef<Map<string, Promise<SearchEntry[]>>>(new Map())

  useEffect(() => {
    if (!open || !projectId || !clientId) return
    if (lazyLoadedProjectId === projectId) return

    // Purge stale data synchronously when switching projects so no render
    // between now and the fetch can show cross-project results.
    if (lazyLoadedProjectId !== null && lazyLoadedProjectId !== projectId) {
      setLazyEntries([])
    }

    let cancelled = false

    const existing = fetchPromiseRef.current.get(projectId)
    const fetchPromise =
      existing ??
      (() => {
        const promise = fetchLazyIndexEntries(projectId, clientId).catch((err) => {
          // Evict on failure so the next open retries.
          fetchPromiseRef.current.delete(projectId)
          throw err
        })
        fetchPromiseRef.current.set(projectId, promise)
        return promise
      })()

    fetchPromise
      .then((entries) => {
        if (cancelled) return
        setLazyEntries(entries)
        setLazyLoadedProjectId(projectId)
      })
      .catch((err) => {
        if (cancelled) return
        console.error("[useCommandPaletteLazyIndex] fetch failed", err)
        toast.error("Failed to index project content.")
      })

    return () => {
      cancelled = true
    }
  }, [open, projectId, clientId, lazyLoadedProjectId])

  return lazyEntries
}
