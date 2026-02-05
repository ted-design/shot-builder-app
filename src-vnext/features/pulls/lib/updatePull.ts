import { doc, updateDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { pullPath } from "@/shared/lib/paths"

export async function updatePullField(
  pullId: string,
  projectId: string,
  clientId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const path = pullPath(pullId, projectId, clientId)
  const ref = doc(db, path[0]!, ...path.slice(1))
  await updateDoc(ref, {
    ...fields,
    updatedAt: serverTimestamp(),
  })
}
