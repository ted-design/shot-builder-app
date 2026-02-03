import { doc, updateDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { shotPath } from "@/shared/lib/paths"

/** Fields that must never be written back to Firestore from vNext. */
const BLOCKED_FIELDS: ReadonlySet<string> = new Set(["notes"])

/**
 * Build a safe write payload by stripping blocked and undefined fields.
 * Exported for testing — not intended for direct use outside this module.
 */
export function buildShotWritePayload(
  fields: Record<string, unknown>,
): Record<string, unknown> {
  const safe: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(fields)) {
    if (BLOCKED_FIELDS.has(key)) continue
    if (value === undefined) continue
    safe[key] = value
  }
  return safe
}

/**
 * Update arbitrary fields on a shot document.
 * SAFETY: The `notes` field is stripped at runtime — legacy HTML is never overwritten.
 */
export async function updateShotField(
  shotId: string,
  clientId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const payload = buildShotWritePayload(fields)
  const path = shotPath(shotId, clientId)
  const ref = doc(db, path[0]!, ...path.slice(1))
  await updateDoc(ref, {
    ...payload,
    updatedAt: serverTimestamp(),
  })
}
