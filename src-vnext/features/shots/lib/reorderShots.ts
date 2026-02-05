import { doc, writeBatch, serverTimestamp } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { shotPath } from "@/shared/lib/paths"
import type { Shot } from "@/shared/types"

/**
 * Persist a new shot ordering to Firestore via atomic batch write.
 * Updates only `sortOrder` and `updatedAt` on each affected shot.
 *
 * @param reorderedShots - The full shot array in its new order.
 * @param clientId - The client scope for path resolution.
 * @throws If the batch write fails (caller must handle revert).
 */
export async function persistShotOrder(
  reorderedShots: ReadonlyArray<Shot>,
  clientId: string,
): Promise<void> {
  const batch = writeBatch(db)

  reorderedShots.forEach((shot, index) => {
    const path = shotPath(shot.id, clientId)
    const ref = doc(db, path[0]!, ...path.slice(1))
    batch.update(ref, {
      sortOrder: index,
      updatedAt: serverTimestamp(),
    })
  })

  await batch.commit()
}
