import { FileQuestion } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/ui/button"

/**
 * 404 Not Found page.
 * Centered layout with icon + message + dashboard link.
 */
export function NotFoundPage() {
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
