import { useEffect, useState } from "react"

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false
    const mql = window.matchMedia?.(query)
    return mql?.matches ?? false
  })

  useEffect(() => {
    const mql = window.matchMedia?.(query)
    if (!mql) return

    setMatches(mql.matches)

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener("change", handler)
    return () => mql.removeEventListener("change", handler)
  }, [query])

  return matches
}

export function useIsMobile(): boolean {
  return !useMediaQuery("(min-width: 768px)")
}

export function useIsTablet(): boolean {
  const aboveMobile = useMediaQuery("(min-width: 768px)")
  const aboveTablet = useMediaQuery("(min-width: 1024px)")
  return aboveMobile && !aboveTablet
}

export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)")
}
