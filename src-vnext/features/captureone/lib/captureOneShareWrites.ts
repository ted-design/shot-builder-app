// Capture One share links live at root level: captureOneShares/{shareToken}.
// Resolved hero filenames are denormalized into the doc at creation time so the
// public digi-tech page reads only the one share doc (clean setDoc, no Cloud Function).

import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { captureOneShareDocPath, captureOneSharesPath } from "@/shared/lib/paths"
import { resolveCaptureOneForShare } from "@/features/captureone/lib/resolveCaptureOneForShare"

function docRef(path: string[]) {
  return doc(db, path[0]!, ...path.slice(1))
}

function colRef(path: string[]) {
  return collection(db, path[0]!, ...path.slice(1))
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

/**
 * Re-denormalize every active Capture One share for a project so the public
 * digi-tech page reflects current hero filenames after a shot save/merge.
 * Best-effort: callers fire-and-forget with `.catch`; per-share failures are
 * isolated (one bad share never blocks the rest). Writes ONLY captureOneShares
 * (never shots), so it cannot re-trigger the save hooks that call it.
 *
 * Queries by (clientId, projectId) to reuse the proven shotShares/castingShares
 * index; `enabled` is filtered client-side (kept out of the index, like the
 * sibling share collections).
 *
 * COVERAGE: re-resolves a share's FULL current shot set, so it self-heals — any
 * project shot save (updateShotWithVersion) or merge (executeShotMerge) refreshes
 * ALL the project's shares to current state. Rarer writers (bulk create, shot
 * duplicate/copy/move/soft-delete, product-family merges) don't fire it directly;
 * their staleness clears on the next normal save. Broadening to those is a deferred
 * follow-up (CO-3″) if eventual consistency proves too loose.
 */
export async function refreshCaptureOneSharesForProject(args: {
  readonly clientId: string
  readonly projectId: string
}): Promise<void> {
  const { clientId, projectId } = args
  if (!clientId || !projectId) return

  const snaps = await getDocs(
    query(
      colRef(captureOneSharesPath()),
      where("clientId", "==", clientId),
      where("projectId", "==", projectId),
    ),
  )

  const active = snaps.docs.filter((d) => d.data().enabled === true)
  const results = await Promise.allSettled(
    active.map(async (d) => {
      const raw = d.data().shotIds
      const shotIds = Array.isArray(raw) ? (raw as string[]) : null
      const resolved = await resolveCaptureOneForShare(clientId, projectId, shotIds)
      await updateDoc(docRef(captureOneShareDocPath(d.id)), {
        projectName: resolved.projectName,
        shots: resolved.shots.map((s) => ({
          ...s,
          filenames: s.filenames.map((f) => ({ ...f })),
        })),
      })
    }),
  )

  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`[refreshCaptureOneSharesForProject] share ${active[i]!.id} refresh failed`, r.reason)
    }
  })
}
