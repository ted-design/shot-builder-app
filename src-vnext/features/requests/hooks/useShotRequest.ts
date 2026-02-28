import { useEffect, useState } from "react"
import { doc, onSnapshot } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { shotRequestDocPath } from "@/shared/lib/paths"
import type { ShotRequest } from "@/shared/types"

interface UseShotRequestResult {
  readonly data: ShotRequest | null
  readonly loading: boolean
  readonly error: string | null
}

export function useShotRequest(
  requestId: string | null,
  clientId: string | null,
): UseShotRequestResult {
  const [data, setData] = useState<ShotRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!requestId || !clientId) {
      setData(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const ref = doc(db, ...shotRequestDocPath(requestId, clientId))
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setData({
            ...(snap.data() as Omit<ShotRequest, "id">),
            id: snap.id,
          } as ShotRequest)
        } else {
          setData(null)
        }
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )
    return unsubscribe
  }, [requestId, clientId])

  return { data, loading, error }
}
