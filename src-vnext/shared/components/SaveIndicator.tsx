import { useEffect, useState } from "react"
import { cn } from "@/shared/lib/utils"

// "Saved Xs ago" pill. Driven by the useLastSaved hook — see
// src-vnext/shared/hooks/useLastSaved.ts. Renders nothing until the
// first save lands. After that, shows "Saved" for the first 3 seconds
// (quiet, friendly confirmation) and then ticks every 5 seconds with a
// relative time label.

export interface SaveIndicatorProps {
  readonly savedAt: number | null
  readonly className?: string
}

const TICK_INTERVAL_MS = 5_000
const RECENT_THRESHOLD_MS = 3_000

function formatSaveLabel(savedAt: number, now: number): string {
  const ageMs = Math.max(0, now - savedAt)
  if (ageMs < RECENT_THRESHOLD_MS) return "Saved"
  const ageSeconds = Math.floor(ageMs / 1000)
  if (ageSeconds < 60) return `Saved ${ageSeconds}s ago`
  const ageMinutes = Math.floor(ageSeconds / 60)
  if (ageMinutes < 60) return `Saved ${ageMinutes}m ago`
  const ageHours = Math.floor(ageMinutes / 60)
  return `Saved ${ageHours}h ago`
}

export function SaveIndicator({ savedAt, className }: SaveIndicatorProps) {
  // Seed `now` from savedAt (or Date.now() if savedAt is still null)
  // so the very first render already yields the correct "Saved" label
  // without any follow-up state write inside useEffect. Avoiding the
  // post-mount setNow keeps React's "update not wrapped in act()"
  // warning quiet in tests that render the editor components.
  //
  // savedAt changes re-drive the initial state via the React key the
  // parent passes — or, lacking that, via the interval below which
  // eventually catches up. Consumers that need a hard reset on
  // savedAt change can remount via a key prop.
  const [now, setNow] = useState<number>(() => savedAt ?? Date.now())

  useEffect(() => {
    if (savedAt === null) return
    const id = setInterval(() => {
      setNow(Date.now())
    }, TICK_INTERVAL_MS)
    return () => {
      clearInterval(id)
    }
  }, [savedAt])

  if (savedAt === null) return null

  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1.5 text-2xs font-medium text-[var(--color-success)]",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full bg-current"
      />
      {formatSaveLabel(savedAt, now)}
    </span>
  )
}
