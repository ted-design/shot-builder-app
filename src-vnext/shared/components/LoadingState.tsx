import type { ReactNode } from "react"
import { Button } from "@/ui/button"
import { useStuckLoading } from "@/shared/hooks/useStuckLoading"

interface LoadingStateProps {
  readonly loading: boolean
  readonly onRetry?: () => void
  /** Content-shaped skeleton to show instead of a generic spinner */
  readonly skeleton?: ReactNode
}

export function LoadingState({ loading, onRetry, skeleton }: LoadingStateProps) {
  const stuck = useStuckLoading(loading)

  if (!loading) return null

  // Content-shaped skeleton mode
  if (skeleton) {
    return (
      <div className="relative">
        <div className={stuck ? "opacity-30" : undefined}>
          {skeleton}
        </div>
        {stuck && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-lg">
              <div className="h-6 w-6 animate-spin rounded-full border-3 border-[var(--color-primary)] border-t-transparent" />
              <p className="text-sm text-[var(--color-text-muted)]">
                Taking longer than expected...
              </p>
              {onRetry && (
                <Button variant="outline" size="sm" onClick={onRetry}>
                  Retry
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Fallback spinner for sub-section loading
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 p-8">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
      {stuck && (
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">
            Taking longer than expected...
          </p>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
