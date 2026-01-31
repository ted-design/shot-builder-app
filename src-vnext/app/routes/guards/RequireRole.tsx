import { Navigate } from "react-router-dom"
import { useAuth } from "@/app/providers/AuthProvider"
import type { Role } from "@/shared/types"
import type { ReactNode } from "react"

interface RequireRoleProps {
  readonly children: ReactNode
  readonly allowed: readonly Role[]
}

export function RequireRole({ children, allowed }: RequireRoleProps) {
  const { role, loading } = useAuth()

  if (loading) return null

  if (!allowed.includes(role)) {
    return <Navigate to="/projects" replace />
  }

  return <>{children}</>
}
