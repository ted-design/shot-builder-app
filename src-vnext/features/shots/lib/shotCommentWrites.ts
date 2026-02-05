import { addDoc, collection, doc, updateDoc } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { shotCommentsPath } from "@/shared/lib/paths"

const MAX_COMMENT_CHARS = 2000

export async function createShotComment(args: {
  readonly clientId: string
  readonly shotId: string
  readonly body: string
  readonly userId: string
  readonly userName?: string | null
  readonly userAvatar?: string | null
}): Promise<string> {
  const { clientId, shotId, body, userId, userName, userAvatar } = args
  const trimmed = body.trim()
  if (!trimmed) throw new Error("Comment is empty.")
  if (trimmed.length > MAX_COMMENT_CHARS) {
    throw new Error(`Comment is too long (max ${MAX_COMMENT_CHARS} characters).`)
  }

  const path = shotCommentsPath(shotId, clientId)
  const ref = await addDoc(collection(db, path[0]!, ...path.slice(1)), {
    body: trimmed,
    createdAt: new Date(),
    createdBy: userId,
    createdByName: userName ?? null,
    createdByAvatar: userAvatar ?? null,
    deleted: false,
  })
  return ref.id
}

export async function setShotCommentDeleted(args: {
  readonly clientId: string
  readonly shotId: string
  readonly commentId: string
  readonly deleted: boolean
}): Promise<void> {
  const { clientId, shotId, commentId, deleted } = args
  const base = shotCommentsPath(shotId, clientId)
  await updateDoc(doc(db, base[0]!, ...base.slice(1), commentId), { deleted })
}

