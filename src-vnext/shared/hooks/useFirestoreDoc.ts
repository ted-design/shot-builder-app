import { useEffect, useState } from "react"
import { doc, onSnapshot } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"

interface FirestoreDocResult<T> {
  readonly data: T | null
  readonly loading: boolean
  readonly error: string | null
}

export function useFirestoreDoc<T>(
  pathSegments: string[] | null,
  mapDoc?: (id: string, data: Record<string, unknown>) => T,
): FirestoreDocResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const pathKey = pathSegments?.join("/") ?? ""

  useEffect(() => {
    if (!pathSegments || pathSegments.length === 0) {
      setData(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const docRef = doc(db, pathSegments[0]!, ...pathSegments.slice(1))

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setData(null)
          setLoading(false)
          return
        }
        const raw = snapshot.data() as Record<string, unknown>
        const mapped = mapDoc ? mapDoc(snapshot.id, raw) : ({ ...raw, id: snapshot.id } as T)
        setData(mapped)
        setLoading(false)
      },
      (err) => {
        console.error("[useFirestoreDoc]", err)
        setError(err.message)
        setLoading(false)
      },
    )

    return unsubscribe
  }, [pathKey])

  return { data, loading, error }
}
