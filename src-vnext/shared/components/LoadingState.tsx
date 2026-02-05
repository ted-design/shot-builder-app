import { Button } from "@/ui/button"
import { useStuckLoading } from "@/shared/hooks/useStuckLoading"

interface LoadingStateProps {
  readonly loading: boolean
  readonly onRetry?: () => void
}

export function LoadingState({ loading, onRetry }: LoadingStateProps) {
  const stuck = useStuckLoading(loading)

  if (!loading) return null

  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 p-8">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
      {stuck && (
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">
            This is taking longer than expected...
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
