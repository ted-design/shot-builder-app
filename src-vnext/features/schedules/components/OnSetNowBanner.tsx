import { useEffect, useState } from "react"

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

interface OnSetNowBannerProps {
  dayNumber?: number
  totalDays?: number
}

export function OnSetNowBanner({ dayNumber, totalDays }: OnSetNowBannerProps) {
  const [timeStr, setTimeStr] = useState(() => formatTime(new Date()))

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeStr(formatTime(new Date()))
    }, 30_000)
    return () => clearInterval(interval)
  }, [])

  const dayLabel =
    dayNumber != null && totalDays != null
      ? `Day ${dayNumber} of ${totalDays}`
      : null

  return (
    <div
      className="flex items-center justify-between px-4 sticky top-0 z-20 h-9 bg-zinc-900 dark:bg-zinc-950"
    >
      <div className="flex items-center gap-2">
        <span
          className="live-dot w-2 h-2 rounded-full bg-emerald-500"
          style={{
            boxShadow: "0 0 6px rgba(16,185,129,0.5)",
          }}
        />
        <span className="text-3xs font-bold uppercase tracking-wider text-emerald-500">
          LIVE
        </span>
        {dayLabel && (
          <span className="text-3xs ml-1 text-zinc-500">
            {dayLabel}
          </span>
        )}
      </div>
      <span className="text-xs font-medium text-zinc-400">
        {timeStr}
      </span>
    </div>
  )
}
