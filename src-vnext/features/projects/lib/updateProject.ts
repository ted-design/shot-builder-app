import { doc, updateDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { projectPath } from "@/shared/lib/paths"

export async function updateProjectField(
  projectId: string,
  clientId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const path = projectPath(projectId, clientId)
  const ref = doc(db, path[0]!, ...path.slice(1))
  await updateDoc(ref, {
    ...fields,
    updatedAt: serverTimestamp(),
  })
}

export async function softDeleteProject(
  projectId: string,
  clientId: string,
): Promise<void> {
  await updateProjectField(projectId, clientId, {
    deletedAt: serverTimestamp(),
  })
}

