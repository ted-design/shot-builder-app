import { useEffect, useState } from "react"
import { collection, query, where, onSnapshot, type Timestamp } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { useAuth } from "@/app/providers/AuthProvider"
import type { Role } from "@/shared/types"

export interface PendingInvitation {
  readonly id: string
  readonly email: string
  readonly role: Role
  readonly invitedBy: string
  readonly createdAt: Timestamp | null
  readonly status: "pending" | "claimed"
}

export function usePendingInvitations() {
  const { clientId } = useAuth()
  const [data, setData] = useState<ReadonlyArray<PendingInvitation>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!clientId) {
      setData([])
      setLoading(false)
      return
    }

    const ref = collection(db, "clients", clientId, "pendingInvitations")
    const q = query(ref, where("status", "==", "pending"))

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const invitations = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as unknown as PendingInvitation[]
        setData(invitations)
        setLoading(false)
        setError(null)
      },
      (err) => {
        setError(err)
        setLoading(false)
      },
    )

    return unsub
  }, [clientId])

  return { data, loading, error }
}
