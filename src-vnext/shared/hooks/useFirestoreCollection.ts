import { useEffect, useState } from "react"
import {
  collection,
  onSnapshot,
  query,
  type QueryConstraint,
} from "firebase/firestore"
import { db } from "@/shared/lib/firebase"

export interface FirestoreCollectionError {
  readonly message: string
  readonly isMissingIndex: boolean
  readonly indexUrl?: string
}

interface FirestoreCollectionResult<T> {
  readonly data: T[]
  readonly loading: boolean
  readonly error: FirestoreCollectionError | null
}

export function useFirestoreCollection<T>(
  pathSegments: string[] | null,
  constraints: QueryConstraint[] = [],
  mapDoc?: (id: string, data: Record<string, unknown>) => T,
): FirestoreCollectionResult<T> {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<FirestoreCollectionError | null>(null)

  const pathKey = pathSegments?.join("/") ?? ""
  const constraintKeys = constraints.map((c) => JSON.stringify(c)).join(",")

  useEffect(() => {
    if (!pathSegments || pathSegments.length === 0) {
      setData([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const collRef = collection(db, pathSegments[0]!, ...pathSegments.slice(1))
    const q = constraints.length > 0 ? query(collRef, ...constraints) : collRef

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => {
          const raw = doc.data() as Record<string, unknown>
          if (mapDoc) return mapDoc(doc.id, raw)
          return { ...raw, id: doc.id } as T
        })
        setData(docs)
        setLoading(false)
      },
      (err) => {
        console.error("[useFirestoreCollection]", err)
        const fireErr = err as { code?: string; message?: string }
        const isMissingIndex = fireErr.code === "failed-precondition"
        const urlMatch = (fireErr.message ?? "").match(
          /https:\/\/console\.firebase\.google\.com[^\s)]+/,
        )
        setError({
          message: isMissingIndex
            ? "This view requires a database index that hasn't been created yet."
            : fireErr.message ?? "Unknown error",
          isMissingIndex,
          indexUrl: urlMatch?.[0],
        })
        setLoading(false)
      },
    )

    return unsubscribe
  }, [pathKey, constraintKeys])

  return { data, loading, error }
}
