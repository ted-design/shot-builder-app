// Capture One share links live at root level: captureOneShares/{shareToken}.
// Resolved hero filenames are denormalized into the doc at creation time so the
// public digi-tech page reads only the one share doc (clean setDoc, no Cloud Function).

import { doc, serverTimestamp, setDoc } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { captureOneShareDocPath } from "@/shared/lib/paths"
import { resolveCaptureOneForShare } from "@/features/captureone/lib/resolveCaptureOneForShare"

function docRef(path: string[]) {
  return doc(db, path[0]!, ...path.slice(1))
}

/** crypto.randomUUID() with a hex getRandomValues fallback. */
function generateShareToken(): string {
  try {
    const token = globalThis.crypto?.randomUUID?.()
    if (token && token.length >= 10) return token
  } catch {
    // fall through to the hex fallback
  }
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

/** Create a Capture One share link with denormalized hero filenames. Returns the token. */
export async function createCaptureOneShareLink(args: {
  readonly clientId: string
  readonly projectId: string
  readonly userId: string
  readonly title: string
  readonly shotIds: readonly string[] | null
}): Promise<string> {
  const { clientId, projectId, userId, title, shotIds } = args
  const scopedIds = shotIds ? [...shotIds] : null
  const resolved = await resolveCaptureOneForShare(clientId, projectId, scopedIds)
  const shareToken = generateShareToken()

  await setDoc(docRef(captureOneShareDocPath(shareToken)), {
    clientId,
    projectId,
    title: title.trim(),
    enabled: true,
    expiresAt: null,
    createdAt: serverTimestamp(),
    createdBy: userId,
    shotIds: scopedIds,
    projectName: resolved.projectName,
    shots: resolved.shots.map((s) => ({
      ...s,
      filenames: s.filenames.map((f) => ({ ...f })),
    })),
  })

  return shareToken
}
