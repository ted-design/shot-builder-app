import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore"
import { auth, db } from "./firebase"

const TIMEOUT_MS = 30_000

interface CallFunctionError extends Error {
  readonly code: string
}

function createFunctionError(message: string, code: string): CallFunctionError {
  const error = new Error(message) as Error & { code: string }
  error.code = `functions/${code}`
  return error
}

export async function callFunction<TResult = unknown>(
  name: string,
  data: Record<string, unknown>,
  options?: { readonly skipAuth?: boolean },
): Promise<TResult> {
  const isAnonymous = options?.skipAuth === true

  let createdBy: string
  if (isAnonymous) {
    createdBy = "anonymous"
  } else {
    const user = auth.currentUser
    if (!user) {
      throw createFunctionError("Not authenticated", "unauthenticated")
    }
    createdBy = user.uid
  }

  const queueRef = doc(collection(db, "_functionQueue"))

  await setDoc(queueRef, {
    action: name,
    data,
    status: "pending",
    createdBy,
    createdAt: serverTimestamp(),
    expiresAt: new Date(Date.now() + 3_600_000),
  })

  return new Promise<TResult>((resolve, reject) => {
    let settled = false

    const unsubscribe = onSnapshot(
      queueRef,
      (snap) => {
        if (settled) return
        const docData = snap.data()
        if (!docData) return

        if (docData.status === "complete") {
          settled = true
          unsubscribe()
          clearTimeout(timer)
          resolve(docData.result as TResult)
        } else if (docData.status === "error") {
          settled = true
          unsubscribe()
          clearTimeout(timer)
          reject(
            createFunctionError(
              docData.error ?? "Function call failed",
              docData.code ?? "internal",
            ),
          )
        }
      },
      (error) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        reject(createFunctionError(error.message, "internal"))
      },
    )

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      unsubscribe()
      reject(createFunctionError("Function call timed out", "deadline-exceeded"))
    }, TIMEOUT_MS)
  })
}
