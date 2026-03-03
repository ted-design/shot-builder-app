import { useEffect, useState } from "react"

function getNowMinute(): number {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

/**
 * Returns current minute of day (0–1439), updated every 60 seconds.
 * Used by the On-Set Viewer to determine block status (Done/In Progress/Up Next/Later).
 */
export function useNowMinute(): number {
  const [minute, setMinute] = useState(getNowMinute)

  useEffect(() => {
    const interval = setInterval(() => {
      setMinute(getNowMinute())
    }, 60_000)
    return () => clearInterval(interval)
  }, [])

  return minute
}
