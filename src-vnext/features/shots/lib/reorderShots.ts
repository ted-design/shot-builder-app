import { doc, writeBatch, serverTimestamp } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { shotPath } from "@/shared/lib/paths"
import type { Shot } from "@/shared/types"

const BATCH_CHUNK_SIZE = 250

/**
 * Persist a new shot ordering to Firestore.
 *
 * For small moves (affected range provided and <= BATCH_CHUNK_SIZE), only the
 * affected slice is written in a single batch. For large reorders or when no
 * range is given, all shots are written in chunked batches.
 *
 * @param reorderedShots - The full shot array in its new order.
 * @param clientId - The client scope for path resolution.
 * @param affectedRange - Optional index range of moved items (from/to).
 * @throws If the batch write fails (caller must handle revert).
 */
export async function persistShotOrder(
  reorderedShots: ReadonlyArray<Shot>,
  clientId: string,
  affectedRange?: { from: number; to: number },
): Promise<void> {
  // If an affected range is specified, only write that slice
  if (affectedRange) {
    const start = Math.min(affectedRange.from, affectedRange.to)
    const end = Math.max(affectedRange.from, affectedRange.to)
    const affected = reorderedShots.slice(start, end + 1)

    const batch = writeBatch(db)
    affected.forEach((shot, i) => {
      const path = shotPath(shot.id, clientId)
      const ref = doc(db, path[0]!, ...path.slice(1))
      batch.update(ref, {
        sortOrder: start + i,
        updatedAt: serverTimestamp(),
      })
    })
    await batch.commit()
    return
  }

  // Full reindex with chunking
  for (let start = 0; start < reorderedShots.length; start += BATCH_CHUNK_SIZE) {
    const chunk = reorderedShots.slice(start, start + BATCH_CHUNK_SIZE)
    const batch = writeBatch(db)
    chunk.forEach((shot, i) => {
      const path = shotPath(shot.id, clientId)
      const ref = doc(db, path[0]!, ...path.slice(1))
      batch.update(ref, {
        sortOrder: start + i,
        updatedAt: serverTimestamp(),
      })
    })
    await batch.commit()
  }
}
