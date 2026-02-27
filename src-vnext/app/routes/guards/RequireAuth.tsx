import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "@/app/providers/AuthProvider"
import { PendingAccessPage } from "@/shared/components/PendingAccessPage"
import type { ReactNode } from "react"

export function RequireAuth({ children }: { readonly children: ReactNode }) {
  const { user, claims, loading, error } = useAuth()
  const location = useLocation()

  if (loading) return null

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!claims) {
    return <PendingAccessPage error={error} />
  }

  return <>{children}</>
}
