import { useEffect, useState } from "react"
import { collection, onSnapshot, query, where } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { shotRequestsPath } from "@/shared/lib/paths"

interface SubmittedRequestCountResult {
  readonly count: number
  readonly loading: boolean
}

export function useSubmittedRequestCount(
  clientId: string | null | undefined,
): SubmittedRequestCountResult {
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clientId) {
      setCount(0)
      setLoading(false)
      return
    }

    setLoading(true)

    const pathSegments = shotRequestsPath(clientId)
    const collRef = collection(db, pathSegments[0]!, ...pathSegments.slice(1))
    const q = query(collRef, where("status", "==", "submitted"))

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setCount(snapshot.size)
        setLoading(false)
      },
      () => {
        setCount(0)
        setLoading(false)
      },
    )

    return unsubscribe
  }, [clientId])

  return { count, loading }
}
