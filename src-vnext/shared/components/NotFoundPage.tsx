import { FileQuestion } from "lucide-react"
import { Link, Navigate, useLocation } from "react-router-dom"
import { Button } from "@/ui/button"

// Bookmark preservation for URLs from redirect stubs removed in Phase 0.1.
// Keeps one centralized redirect map instead of four route-level Navigate stubs.
function resolveLegacyRedirect(pathname: string, search: string): string | null {
  const bareProject = pathname.match(/^\/projects\/([^/]+)\/?$/)
  if (bareProject) return `/projects/${bareProject[1]}/shots${search}`

  const bareSchedules = pathname.match(/^\/projects\/([^/]+)\/schedules\/?$/)
  if (bareSchedules) return `/projects/${bareSchedules[1]}/callsheet${search}`

  if (/^\/library\/?$/.test(pathname)) return `/library/talent${search}`
  if (/^\/inbox\/?$/.test(pathname)) return `/requests${search}`

  return null
}

/**
 * 404 Not Found page.
 * Centered layout with icon + message + dashboard link.
 */
export function NotFoundPage() {
  const location = useLocation()
  const legacyRedirect = resolveLegacyRedirect(location.pathname, location.search)
  if (legacyRedirect) return <Navigate to={legacyRedirect} replace />

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <span className="text-6xl font-light text-[var(--color-text-subtle)]">404</span>
      <FileQuestion className="h-12 w-12 text-[var(--color-text-subtle)]" />
      <h1 className="heading-page">Page Not Found</h1>
      <p className="max-w-sm text-sm text-[var(--color-text-muted)]">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Button asChild className="mt-2">
        <Link to="/">Go to Dashboard</Link>
      </Button>
    </div>
  )
}
