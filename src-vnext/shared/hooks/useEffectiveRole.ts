import { useEffect } from "react"
import { toast } from "sonner"
import { useAuth } from "@/app/providers/AuthProvider"
import { useOptionalProjectScope } from "@/app/providers/ProjectScopeProvider"
import { useFirestoreDoc } from "@/shared/hooks/useFirestoreDoc"
import { projectMemberDocPath } from "@/shared/lib/paths"
import { normalizeRole, roleRank, ROLE } from "@/shared/lib/rbac"
import type { Role } from "@/shared/types"

// Phase 5b effective-role source (locked Q5/Q6): the role project-scoped
// capability gates consume. A LIVE members/{uid} doc on the active project
// WINS over the global claim — including downgrades. Global admin is the
// single exception and it lives HERE, nowhere else.
//
// Failure semantics (each silent, fail-toward-fewer):
//   1. permission-denied — a NON-member reading its own member path is
//      denied by the members read rule (firestore.rules:706-709). Expected;
//      fall back to the global claim. No error UI, no console noise (the
//      lanes-carve-out swallow precedent, useShotDetailBundle.ts).
//   2. doc-absent — member-less project (the normal live state for
//      admin-created projects). Global-claim fallback, silent.
//   3. transient/other error — last-known-resolved role for this project if
//      one exists this session, else the global claim. NEVER read .data when
//      error is set: useFirestoreDoc keeps stale data on error, and a removed
//      user must not freeze at their old elevated role.
//
// `resolving` is true ONLY during the FIRST in-flight read for a projectId
// with no session cache. ProjectScopeProvider mounts per-route (12 routes),
// so subscriptions churn on every in-project nav — the module-level cache
// keeps the affordance gap from re-opening each time.

export interface EffectiveRoleResult {
  readonly role: Role
  readonly resolving: boolean
}

// Last RESOLVED effective role per `${uid}:${projectId}` for this session.
const resolvedRoleCache = new Map<string, Role>()

/** Test-only: clears the module-level session cache between specs. */
export function resetEffectiveRoleCacheForTests(): void {
  resolvedRoleCache.clear()
}

// Member docs store role as an untyped string (legacy 'wardrobe' must map to
// warehouse) — run it through normalizeRole, same as the claims path.
function mapMemberDoc(_id: string, data: Record<string, unknown>): { role: Role } {
  return { role: normalizeRole(data["role"]) }
}

// Stable options object — permission-denied is the EXPECTED non-member
// answer, not an error worth logging.
const MEMBER_DOC_OPTIONS = { quietErrorCodes: ["permission-denied"] } as const

function commitResolvedRole(key: string, role: Role): void {
  const prev = resolvedRoleCache.get(key)
  resolvedRoleCache.set(key, role)
  if (prev !== undefined && roleRank(role) < roleRank(prev)) {
    // Q6 mid-session downgrade: announce once, never silently collapse
    // affordances. The synchronous cache update dedupes across the several
    // mounted hook consumers — the first commit changes the cache, so later
    // effects see prev === role and skip the toast.
    toast("Your role on this project changed.")
  }
}

export function useEffectiveRole(): EffectiveRoleResult {
  const { role: globalRole, user, clientId, loading: authLoading } = useAuth()
  const scope = useOptionalProjectScope()
  const uid = user?.uid ?? null
  const projectId = scope?.projectId ?? null

  // Global admin is NEVER downgraded (locked Q6) — skip the member
  // subscription entirely.
  const isGlobalAdmin = globalRole === ROLE.ADMIN

  const memberPath =
    !isGlobalAdmin && !authLoading && uid && clientId && projectId
      ? projectMemberDocPath(uid, projectId, clientId)
      : null

  const { data, loading, error, errorCode } = useFirestoreDoc<{ role: Role }>(
    memberPath,
    mapMemberDoc,
    MEMBER_DOC_OPTIONS,
  )

  const key = uid && projectId ? `${uid}:${projectId}` : null
  const cached = key ? resolvedRoleCache.get(key) : undefined

  let role: Role
  let resolving = false
  // True only when we hold a SETTLED answer (member doc, doc-absent, or the
  // expected permission-denied) — the states worth caching for the session.
  let authoritative = false

  if (isGlobalAdmin) {
    role = ROLE.ADMIN
  } else if (!projectId) {
    // No ProjectScopeProvider (org pages; OnSetViewerPage mounts without the
    // provider) — the global claim is the effective role.
    role = globalRole
  } else if (!memberPath) {
    // Auth still settling / signed out: no read in flight, fall toward the
    // session cache then the global claim.
    role = cached ?? globalRole
  } else if (error) {
    if (errorCode === "permission-denied") {
      role = globalRole
      authoritative = true
    } else {
      role = cached ?? globalRole
    }
  } else if (loading) {
    if (cached !== undefined) {
      role = cached
    } else {
      role = globalRole
      resolving = true
    }
  } else if (data) {
    // PROJECT ROLE WINS, including downgrades (locked Q6).
    role = data.role
    authoritative = true
  } else {
    // Doc absent — member-less project, the normal live state.
    role = globalRole
    authoritative = true
  }

  useEffect(() => {
    if (!key || !authoritative) return
    commitResolvedRole(key, role)
  }, [key, role, authoritative])

  return { role, resolving }
}
