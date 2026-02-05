import { doc, serverTimestamp, updateDoc } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { shotPath } from "@/shared/lib/paths"
import type { AuthUser, Shot } from "@/shared/types"
import { buildShotWritePayload } from "@/features/shots/lib/updateShot"
import { createShotVersionSnapshot } from "@/features/shots/lib/shotVersioning"

/**
 * Update a shot document and (best-effort) write a version snapshot.
 *
 * Core write must succeed even if versioning fails.
 */
export async function updateShotWithVersion(args: {
  readonly clientId: string
  readonly shotId: string
  readonly patch: Record<string, unknown>
  readonly shot: Shot
  readonly user: AuthUser | null
  readonly source?: string
}): Promise<void> {
  const { clientId, shotId, patch, shot, user, source = "unknown" } = args
  if (!clientId) throw new Error("Missing clientId.")
  if (!shotId) throw new Error("Missing shotId.")

  const payload = buildShotWritePayload(patch)
  const path = shotPath(shotId, clientId)
  const ref = doc(db, path[0]!, ...path.slice(1))

  await updateDoc(ref, {
    ...payload,
    updatedAt: serverTimestamp(),
    ...(user?.uid ? { updatedBy: user.uid } : {}),
  })

  if (!user?.uid) return

  void createShotVersionSnapshot({
    clientId,
    shotId,
    previousShot: shot,
    patch: payload,
    user,
    changeType: "update",
  }).catch((err) => {
    console.error(`[updateShotWithVersion] Version snapshot failed (source=${source})`, err)
  })
}
