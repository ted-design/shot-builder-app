import { WifiOff } from "lucide-react"
import { useOnlineStatus } from "@/shared/hooks/useOnlineStatus"

/**
 * Amber top-of-page banner shown when the browser goes offline.
 * Auto-dismisses when connectivity is restored.
 */
export function OfflineBanner() {
  const online = useOnlineStatus()

  if (online) return null

  return (
    <div className="flex items-center justify-center gap-2 bg-[var(--color-status-amber-bg)] px-4 py-2 text-sm font-medium text-[var(--color-status-amber-text)]">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>You are offline. Changes will sync when your connection is restored.</span>
    </div>
  )
}
