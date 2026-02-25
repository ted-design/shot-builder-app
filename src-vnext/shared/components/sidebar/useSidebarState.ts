import { useCallback, useEffect, useState } from "react"

const TOGGLE_KEY = "["

export function useSidebarState(initialCollapsed = false) {
  const [collapsed, setCollapsed] = useState(initialCollapsed)

  const toggle = useCallback(() => setCollapsed((prev) => !prev), [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== TOGGLE_KEY) return
      const tag = (e.target as HTMLElement).tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
      if ((e.target as HTMLElement).isContentEditable) return
      e.preventDefault()
      toggle()
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [toggle])

  return { collapsed, toggle } as const
}
