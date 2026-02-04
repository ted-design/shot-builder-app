import {
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { shotsPath } from "@/shared/lib/paths"

const MAX_UPDATES_PER_BATCH = 450

export async function backfillMissingShotDates(args: {
  readonly clientId: string
  readonly projectId: string
  readonly updatedBy?: string | null
}): Promise<{ readonly scanned: number; readonly updated: number }> {
  const { clientId, projectId, updatedBy } = args
  if (!clientId) throw new Error("Missing clientId.")
  if (!projectId) throw new Error("Missing projectId.")

  const path = shotsPath(clientId)
  const shotsRef = collection(db, path[0]!, ...path.slice(1))

  // Do NOT orderBy("date") here — we're explicitly hunting for docs that are missing `date`.
  const snap = await getDocs(query(shotsRef, where("projectId", "==", projectId)))
  const scanned = snap.size

  const missing = snap.docs.filter((d) => {
    const data = d.data() as Record<string, unknown>
    const deleted = data["deleted"]
    if (deleted === true) return false
    const missingDate = data["date"] === undefined
    const missingDeleted = data["deleted"] === undefined
    return missingDate || missingDeleted
  })

  if (missing.length === 0) return { scanned, updated: 0 }

  let updated = 0
  for (let i = 0; i < missing.length; i += MAX_UPDATES_PER_BATCH) {
    const slice = missing.slice(i, i + MAX_UPDATES_PER_BATCH)
    const batch = writeBatch(db)
    for (const docSnap of slice) {
      const data = docSnap.data() as Record<string, unknown>
      const patch: Record<string, unknown> = {
        updatedAt: serverTimestamp(),
        ...(updatedBy ? { updatedBy } : {}),
      }
      if (data["date"] === undefined) patch["date"] = null
      if (data["deleted"] === undefined) patch["deleted"] = false

      batch.update(docSnap.ref, patch)
      updated += 1
    }
    await batch.commit()
  }

  return { scanned, updated }
}
