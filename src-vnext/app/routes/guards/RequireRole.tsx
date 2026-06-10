import { Navigate } from "react-router-dom"
import { useAuth } from "@/app/providers/AuthProvider"
import type { Role } from "@/shared/types"
import type { ReactNode } from "react"

interface RequireRoleProps {
  readonly children: ReactNode
  readonly allowed: readonly Role[]
}

export function RequireRole({ children, allowed }: RequireRoleProps) {
  // PINNED to the GLOBAL claim (5b): route guards are org-scope chrome with no
  // project context (no ProjectScopeProvider above the router), so there is no
  // effective role to resolve. The guarded backends are global-role rules:
  // /shotRequests requires a global admin/producer claim (firestore.rules:409-433)
  // and the admin collections /users (firestore.rules:539-543) +
  // /pendingInvitations (firestore.rules:547-549) require a global admin claim.
  const { role, loading } = useAuth()

  if (loading) return null

  if (!allowed.includes(role)) {
    return <Navigate to="/projects" replace />
  }

  return <>{children}</>
}
