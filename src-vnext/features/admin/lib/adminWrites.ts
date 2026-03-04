import { deleteDoc, doc, setDoc, serverTimestamp } from "firebase/firestore"
import { callFunction } from "@/shared/lib/callFunction"
import { db } from "@/shared/lib/firebase"
import { projectMemberDocPath, userDocPath } from "@/shared/lib/paths"
import type { Role } from "@/shared/types"

interface InviteOrUpdateUserParams {
  readonly targetEmail: string
  readonly displayName: string | null
  readonly role: Role
  readonly clientId: string
}

interface SetUserClaimsResponse {
  readonly ok: boolean
  readonly uid?: string
  readonly claims?: Record<string, unknown>
  readonly pending?: boolean
  readonly email?: string
}

export async function inviteOrUpdateUser({
  targetEmail,
  displayName,
  role,
  clientId,
}: InviteOrUpdateUserParams): Promise<{ uid: string } | { pending: true; email: string }> {
  const response = await callFunction<SetUserClaimsResponse>(
    "setUserClaims",
    { targetEmail, role, clientId },
  )

  if (response.pending) {
    return { pending: true, email: response.email ?? targetEmail }
  }

  const uid = response.uid
  if (!uid) {
    throw new Error("Cloud Function did not return a user id.")
  }

  const ref = doc(db, ...userDocPath(uid, clientId))
  await setDoc(
    ref,
    {
      email: targetEmail,
      displayName: displayName || null,
      role,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { mergeFields: ["email", "displayName", "role", "updatedAt"] },
  )

  return { uid }
}

interface UpdateUserRoleParams {
  readonly userId: string
  readonly userEmail: string
  readonly newRole: Role
  readonly clientId: string
}

/**
 * Update an existing user's role in both Auth custom claims and Firestore.
 * Calls the CF first (authoritative), then writes Firestore to keep roster in sync.
 */
export async function updateUserRole({
  userId,
  userEmail,
  newRole,
  clientId,
}: UpdateUserRoleParams): Promise<void> {
  await callFunction("setUserClaims", {
    targetEmail: userEmail,
    role: newRole,
    clientId,
  })

  const ref = doc(db, ...userDocPath(userId, clientId))
  await setDoc(
    ref,
    {
      role: newRole,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

// --- Project membership ---

interface AddProjectMemberParams {
  readonly projectId: string
  readonly userId: string
  readonly role: Role
  readonly addedBy: string
  readonly clientId: string
}

export async function addProjectMember({
  projectId,
  userId,
  role,
  addedBy,
  clientId,
}: AddProjectMemberParams): Promise<void> {
  const ref = doc(db, ...projectMemberDocPath(userId, projectId, clientId))
  await setDoc(ref, {
    role,
    addedAt: serverTimestamp(),
    addedBy,
  }, { merge: true })
}

interface RemoveProjectMemberParams {
  readonly projectId: string
  readonly userId: string
  readonly clientId: string
}

export async function removeProjectMember({
  projectId,
  userId,
  clientId,
}: RemoveProjectMemberParams): Promise<void> {
  const ref = doc(db, ...projectMemberDocPath(userId, projectId, clientId))
  await deleteDoc(ref)
}
