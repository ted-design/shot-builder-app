import { useOnlineStatus } from "@/shared/hooks/useOnlineStatus"

export function OfflineBanner() {
  const online = useOnlineStatus()

  if (online) return null

  return (
    <div className="fixed inset-x-0 top-0 z-[var(--z-fixed)] bg-[var(--color-warning)] px-4 py-2 text-center text-sm font-medium text-white">
      You&apos;re offline. Changes will sync when reconnected.
    </div>
  )
}
