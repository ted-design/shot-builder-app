import { doc, updateDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { shotPath } from "@/shared/lib/paths"

export async function updateShotField(
  shotId: string,
  clientId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const path = shotPath(shotId, clientId)
  const ref = doc(db, path[0]!, ...path.slice(1))
  await updateDoc(ref, {
    ...fields,
    updatedAt: serverTimestamp(),
  })
}
