import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { Button } from "@/ui/button"

interface RouteBoundaryProps {
  readonly featureName: string
  readonly children: ReactNode
}

function capitalize(value: string): string {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function handleReload() {
  if (typeof window === "undefined") return
  window.location.reload()
}

/**
 * Per-feature error boundary. Wraps a single route element so a crash in one
 * feature does not unmount the sidebar/nav (which sit above this boundary in
 * AppShell). Renders a feature-aware fallback with recovery actions.
 */
export function RouteBoundary({ featureName, children }: RouteBoundaryProps) {
  const fallback = (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="heading-section">
        Something went wrong in {capitalize(featureName)}
      </h2>
      <p className="max-w-md text-sm text-[var(--color-text-muted)]">
        This view crashed, but the rest of the app is still running. Go back to
        Projects or try again.
      </p>
      <div className="flex items-center gap-2">
        <Button asChild>
          <Link to="/projects">Go to Projects</Link>
        </Button>
        <Button variant="outline" onClick={handleReload}>
          Reload page
        </Button>
      </div>
    </div>
  )

  return <ErrorBoundary fallback={fallback}>{children}</ErrorBoundary>
}
