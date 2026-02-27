import { doc, setDoc, serverTimestamp } from "firebase/firestore"
import { httpsCallable } from "firebase/functions"
import { db, functions } from "@/shared/lib/firebase"
import { userDocPath } from "@/shared/lib/paths"
import type { Role } from "@/shared/types"

interface InviteOrUpdateUserParams {
  readonly targetEmail: string
  readonly displayName: string | null
  readonly role: Role
  readonly clientId: string
}

interface SetUserClaimsResponse {
  readonly ok: boolean
  readonly uid: string
  readonly claims: Record<string, unknown>
}

/**
 * Invite a new user or update an existing user's role.
 * Calls the `setUserClaims` Cloud Function then writes/merges the user doc.
 *
 * Throws if the target user has never signed in (`auth/user-not-found`).
 */
export async function inviteOrUpdateUser({
  targetEmail,
  displayName,
  role,
  clientId,
}: InviteOrUpdateUserParams): Promise<string> {
  const callable = httpsCallable<
    { targetEmail: string; role: Role; clientId: string },
    SetUserClaimsResponse
  >(functions, "setUserClaims")

  const response = await callable({ targetEmail, role, clientId })
  const uid = response.data.uid

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

  return uid
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
  const callable = httpsCallable<
    { targetEmail: string; role: Role; clientId: string },
    SetUserClaimsResponse
  >(functions, "setUserClaims")

  await callable({ targetEmail: userEmail, role: newRole, clientId })

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
