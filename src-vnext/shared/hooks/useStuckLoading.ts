import { useEffect, useState } from "react"

const STUCK_THRESHOLD_MS = 5000

export function useStuckLoading(loading: boolean): boolean {
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    if (!loading) {
      setStuck(false)
      return
    }

    const timer = setTimeout(() => setStuck(true), STUCK_THRESHOLD_MS)
    return () => clearTimeout(timer)
  }, [loading])

  return stuck
}
