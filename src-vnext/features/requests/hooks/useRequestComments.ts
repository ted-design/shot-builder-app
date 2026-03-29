import { useEffect, useState } from "react"
import { collection, onSnapshot, orderBy, query } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { shotRequestCommentsPath } from "@/shared/lib/paths"
import type { ShotRequestComment } from "@/shared/types"

interface UseRequestCommentsResult {
  readonly comments: readonly ShotRequestComment[]
  readonly loading: boolean
  readonly error: string | null
}

export function useRequestComments(
  clientId: string | null,
  requestId: string | null,
): UseRequestCommentsResult {
  const [comments, setComments] = useState<readonly ShotRequestComment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!clientId || !requestId) {
      setComments([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const pathSegments = shotRequestCommentsPath(clientId, requestId)
    const collRef = collection(db, pathSegments[0]!, ...pathSegments.slice(1))
    const q = query(collRef, orderBy("createdAt", "asc"))

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as Record<string, unknown>
          return {
            id: docSnap.id,
            authorId: data.authorId as string,
            authorName: data.authorName as string,
            body: data.body as string,
            createdAt: data.createdAt,
          } as ShotRequestComment
        })
        setComments(docs)
        setLoading(false)
      },
      (err) => {
        const fireErr = err as { message?: string }
        setError(fireErr.message ?? "Failed to load comments")
        setLoading(false)
      },
    )

    return unsubscribe
  }, [clientId, requestId])

  return { comments, loading, error }
}
