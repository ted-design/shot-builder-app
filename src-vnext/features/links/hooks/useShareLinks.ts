/**
 * Hook that subscribes to all three share link sources (shots, casting, pulls)
 * and merges them into a single sorted array.
 */

import { useEffect, useMemo, useState } from "react"
import {
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { pullsPath } from "@/shared/lib/paths"
import {
  mapShotShareDoc,
  mapCastingShareDoc,
  mapPullToShareLink,
  type ShareLink,
} from "../lib/shareLinkTypes"

interface UseShareLinksResult {
  readonly links: readonly ShareLink[]
  readonly loading: boolean
  readonly error: Error | null
}

export function useShareLinks(
  projectId: string | null,
  clientId: string | null,
): UseShareLinksResult {
  const [shotLinks, setShotLinks] = useState<readonly ShareLink[]>([])
  const [castingLinks, setCastingLinks] = useState<readonly ShareLink[]>([])
  const [pullLinks, setPullLinks] = useState<readonly ShareLink[]>([])

  const [shotLoading, setShotLoading] = useState(true)
  const [castingLoading, setCastingLoading] = useState(true)
  const [pullLoading, setPullLoading] = useState(true)

  const [error, setError] = useState<Error | null>(null)

  const enabled = Boolean(projectId) && Boolean(clientId)

  // -----------------------------------------------------------------------
  // Shot shares subscription
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!enabled) {
      setShotLinks([])
      setShotLoading(false)
      return
    }

    setShotLoading(true)
    const q = query(
      collection(db, "shotShares"),
      where("clientId", "==", clientId),
      where("projectId", "==", projectId),
    )

    const unsub = onSnapshot(
      q,
      (snap) => {
        const mapped = snap.docs.map((d) =>
          mapShotShareDoc(d.id, d.data() as Record<string, unknown>),
        )
        setShotLinks(mapped)
        setShotLoading(false)
      },
      (err) => {
        console.error("[useShareLinks] shotShares error:", err)
        setError(err)
        setShotLoading(false)
      },
    )

    return unsub
  }, [enabled, clientId, projectId])

  // -----------------------------------------------------------------------
  // Casting shares subscription + vote count side-fetch
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!enabled) {
      setCastingLinks([])
      setCastingLoading(false)
      return
    }

    setCastingLoading(true)
    const q = query(
      collection(db, "castingShares"),
      where("clientId", "==", clientId),
      where("projectId", "==", projectId),
    )

    const unsub = onSnapshot(
      q,
      async (snap) => {
        // Map docs first without engagement
        const baseDocs = snap.docs.map((d) => ({
          id: d.id,
          data: d.data() as Record<string, unknown>,
        }))

        // Fetch vote counts for each casting share
        const voteCounts = new Map<string, number>()
        await Promise.all(
          baseDocs.map(async ({ id }) => {
            try {
              const votesSnap = await getDocs(
                collection(db, "castingShares", id, "votes"),
              )
              voteCounts.set(id, votesSnap.size)
            } catch {
              voteCounts.set(id, 0)
            }
          }),
        )

        const mapped = baseDocs.map(({ id, data }) =>
          mapCastingShareDoc(id, data, voteCounts.get(id)),
        )
        setCastingLinks(mapped)
        setCastingLoading(false)
      },
      (err) => {
        console.error("[useShareLinks] castingShares error:", err)
        setError(err)
        setCastingLoading(false)
      },
    )

    return unsub
  }, [enabled, clientId, projectId])

  // -----------------------------------------------------------------------
  // Pulls subscription (project-scoped, shareEnabled == true)
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!enabled || !projectId || !clientId) {
      setPullLinks([])
      setPullLoading(false)
      return
    }

    setPullLoading(true)
    const path = pullsPath(projectId, clientId)
    const colRef = collection(db, path[0]!, ...path.slice(1))
    const q = query(colRef, where("shareEnabled", "==", true))

    const unsub = onSnapshot(
      q,
      (snap) => {
        const mapped = snap.docs
          .map((d) =>
            mapPullToShareLink(d.id, d.data() as Record<string, unknown>),
          )
          .filter((link): link is ShareLink => link !== null)
        setPullLinks(mapped)
        setPullLoading(false)
      },
      (err) => {
        console.error("[useShareLinks] pulls error:", err)
        setError(err)
        setPullLoading(false)
      },
    )

    return unsub
  }, [enabled, clientId, projectId])

  // -----------------------------------------------------------------------
  // Merge + sort (newest first)
  // -----------------------------------------------------------------------
  const loading = shotLoading || castingLoading || pullLoading

  const links = useMemo(() => {
    const all = [...shotLinks, ...castingLinks, ...pullLinks]
    return all.sort((a, b) => {
      const aTime = a.createdAt?.getTime() ?? 0
      const bTime = b.createdAt?.getTime() ?? 0
      return bTime - aTime
    })
  }, [shotLinks, castingLinks, pullLinks])

  return { links, loading, error }
}
