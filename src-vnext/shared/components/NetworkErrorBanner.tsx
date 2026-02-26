import { AlertTriangle } from "lucide-react"
import { Button } from "@/ui/button"

interface NetworkErrorBannerProps {
  readonly message?: string
  readonly onRetry?: () => void
}

/**
 * Red top-of-page banner for network/server errors.
 * Requires manual dismiss via Retry button.
 */
export function NetworkErrorBanner({
  message = "Something went wrong. Please check your connection and try again.",
  onRetry,
}: NetworkErrorBannerProps) {
  return (
    <div className="flex items-center justify-center gap-3 bg-[var(--color-accent-light)] px-4 py-2 text-sm font-medium text-[var(--color-error)]">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>{message}</span>
      {onRetry && (
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}
