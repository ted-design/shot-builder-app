import { ShieldAlert } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/ui/button"

/**
 * 403 Permission Denied page.
 * Centered layout with icon + message + dashboard link.
 */
export function ForbiddenPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <span className="text-6xl font-light text-[var(--color-text-subtle)]">403</span>
      <ShieldAlert className="h-12 w-12 text-[var(--color-text-subtle)]" />
      <h1 className="heading-page">Permission Denied</h1>
      <p className="max-w-sm text-sm text-[var(--color-text-muted)]">
        You don't have permission to access this page. Contact your admin if you
        believe this is a mistake.
      </p>
      <Button asChild className="mt-2">
        <Link to="/">Go to Dashboard</Link>
      </Button>
    </div>
  )
}
