import { useEffect, useState } from "react"
import { doc, onSnapshot } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { useAuth } from "@/app/providers/AuthProvider"
import { shotPath } from "@/shared/lib/paths"

/**
 * True while the shot doc has a locally-queued write the server has not yet
 * acknowledged (`snapshot.metadata.hasPendingWrites`) — the honest "queued /
 * syncing" signal for the Shoot shell's status bar (Decision C, 5e-II).
 *
 * Why not useShot()/useFirestoreDoc: the pending→acked transition is a
 * METADATA-ONLY snapshot event, which onSnapshot does not deliver without
 * `includeMetadataChanges: true`. Turning that on inside the shared doc hook
 * would change snapshot cadence for every flag-OFF consumer, so this is a
 * separate listener mounted ONLY by the flag-gated Shoot shell. The SDK
 * multiplexes listeners on the same doc over one watch stream, so this adds
 * no extra backend reads while the bundle's listener is open.
 *
 * Presentation-only: errors are swallowed (pending resets to false) — the
 * shot's load-bearing listener (useShotDetailBundle) owns error surfacing.
 */
export function useShotPendingWrites(shotId: string | undefined): boolean {
  const { clientId } = useAuth()
  const [pending, setPending] = useState(false)

  const pathKey = clientId && shotId ? shotPath(shotId, clientId).join("/") : ""

  useEffect(() => {
    if (!pathKey) {
      setPending(false)
      return
    }

    const segments = pathKey.split("/")
    const ref = doc(db, segments[0]!, ...segments.slice(1))
    const unsubscribe = onSnapshot(
      ref,
      { includeMetadataChanges: true },
      (snapshot) => {
        setPending(snapshot.metadata.hasPendingWrites)
      },
      () => {
        setPending(false)
      },
    )

    return () => unsubscribe()
  }, [pathKey])

  return pending
}
