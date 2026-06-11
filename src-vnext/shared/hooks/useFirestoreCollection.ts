import { useEffect, useRef, useState } from "react"
import {
  collection,
  onSnapshot,
  query,
  type QueryConstraint,
} from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import {
  markSubscriptionMount,
  markSubscriptionUnmount,
} from "@/shared/lib/devSubscriptionCounter"

export interface FirestoreCollectionError {
  readonly message: string
  readonly isMissingIndex: boolean
  readonly indexUrl?: string
  /**
   * The raw Firestore error code (e.g. "permission-denied",
   * "failed-precondition"). Carried through so callers can discriminate a
   * rules-denied read (which some surfaces choose to degrade gracefully)
   * from a genuine error that must stay visible. Backward-compatible /
   * additive — existing consumers that read only message/isMissingIndex are
   * unaffected.
   */
  readonly code?: string
}

interface FirestoreCollectionResult<T> {
  readonly data: T[]
  readonly loading: boolean
  readonly error: FirestoreCollectionError | null
}

interface FirestoreCollectionOptions {
  /**
   * Error codes EXPECTED at this call site (e.g. a non-member reading a
   * project-scoped collection is rules-denied — useCastingBoard). Suppresses
   * the console.error for those codes ONLY; the error still surfaces through
   * the result so callers can degrade gracefully. Mirrors useFirestoreDoc's
   * quietErrorCodes.
   */
  readonly quietErrorCodes?: ReadonlyArray<string>
}

export function useFirestoreCollection<T>(
  pathSegments: string[] | null,
  constraints: QueryConstraint[] = [],
  mapDoc?: (id: string, data: Record<string, unknown>) => T,
  options?: FirestoreCollectionOptions,
): FirestoreCollectionResult<T> {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<FirestoreCollectionError | null>(null)

  // Ref so the snapshot error callback reads the latest options without
  // retriggering the subscription effect (deps stay [pathKey, constraintKeys]).
  const optionsRef = useRef(options)
  optionsRef.current = options

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
    const counterKey = constraintKeys ? `${pathKey}?${constraintKeys}` : pathKey
    markSubscriptionMount(counterKey)

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
        const fireErr = err as { code?: string; message?: string }
        if (
          !fireErr.code ||
          !optionsRef.current?.quietErrorCodes?.includes(fireErr.code)
        ) {
          console.error("[useFirestoreCollection]", err)
        }
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
          code: fireErr.code,
        })
        setLoading(false)
      },
    )

    return () => {
      unsubscribe()
      markSubscriptionUnmount(counterKey)
    }
  }, [pathKey, constraintKeys])

  return { data, loading, error }
}
