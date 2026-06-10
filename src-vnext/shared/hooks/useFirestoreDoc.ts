import { useEffect, useRef, useState } from "react"
import { doc, onSnapshot } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import {
  markSubscriptionMount,
  markSubscriptionUnmount,
} from "@/shared/lib/devSubscriptionCounter"

interface FirestoreDocResult<T> {
  readonly data: T | null
  readonly loading: boolean
  readonly error: string | null
  /**
   * Raw Firestore error code (e.g. "permission-denied") — additive, mirrors
   * useFirestoreCollection's FirestoreCollectionError.code so callers can
   * discriminate a rules-denied read from a genuine error. Null when no
   * error is set.
   */
  readonly errorCode: string | null
}

interface FirestoreDocOptions {
  /**
   * Error codes EXPECTED at this call site (e.g. a non-member reading its
   * own members doc is rules-denied — useEffectiveRole). Suppresses the
   * console.error for those codes ONLY; the error still surfaces through
   * the result. Lanes-carve-out precedent: useShotDetailBundle.ts swallows
   * permission-denied the same way for the lanes read.
   */
  readonly quietErrorCodes?: ReadonlyArray<string>
}

export function useFirestoreDoc<T>(
  pathSegments: string[] | null,
  mapDoc?: (id: string, data: Record<string, unknown>) => T,
  options?: FirestoreDocOptions,
): FirestoreDocResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)

  // Ref so the snapshot error callback reads the latest options without
  // retriggering the subscription effect (deps stay [pathKey]).
  const optionsRef = useRef(options)
  optionsRef.current = options

  const pathKey = pathSegments?.join("/") ?? ""

  useEffect(() => {
    if (!pathSegments || pathSegments.length === 0) {
      setData(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    setErrorCode(null)

    const docRef = doc(db, pathSegments[0]!, ...pathSegments.slice(1))
    markSubscriptionMount(pathKey)

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
        const code = (err as { code?: string }).code ?? null
        if (!code || !optionsRef.current?.quietErrorCodes?.includes(code)) {
          console.error("[useFirestoreDoc]", err)
        }
        setError(err.message)
        setErrorCode(code)
        setLoading(false)
      },
    )

    return () => {
      unsubscribe()
      markSubscriptionUnmount(pathKey)
    }
  }, [pathKey])

  return { data, loading, error, errorCode }
}
