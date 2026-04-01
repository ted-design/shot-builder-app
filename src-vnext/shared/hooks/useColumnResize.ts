import { useCallback, useRef, useState } from "react"

/**
 * Mouse-based column resize handler.
 * Tracks mousemove from an initial mousedown position and reports width changes.
 */
export function useColumnResize(opts: {
  readonly onWidthChange: (key: string, width: number) => void
  readonly minWidth?: number   // default 60
  readonly maxWidth?: number   // default 600
}): {
  readonly startResize: (key: string, startX: number, currentWidth: number) => void
  readonly isResizing: boolean
} {
  const { onWidthChange, minWidth = 60, maxWidth = 600 } = opts
  const [isResizing, setIsResizing] = useState(false)
  const stateRef = useRef<{
    readonly key: string
    readonly startX: number
    readonly startWidth: number
  } | null>(null)

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const state = stateRef.current
      if (!state) return
      const delta = e.clientX - state.startX
      const newWidth = Math.max(minWidth, Math.min(maxWidth, state.startWidth + delta))
      onWidthChange(state.key, newWidth)
    },
    [onWidthChange, minWidth, maxWidth],
  )

  const handleMouseUp = useCallback(() => {
    stateRef.current = null
    setIsResizing(false)
    document.body.style.cursor = ""
    document.body.style.userSelect = ""
    document.removeEventListener("mousemove", handleMouseMove)
    document.removeEventListener("mouseup", handleMouseUp)
  }, [handleMouseMove])

  const startResize = useCallback(
    (key: string, startX: number, currentWidth: number) => {
      stateRef.current = { key, startX, startWidth: currentWidth }
      setIsResizing(true)
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    },
    [handleMouseMove, handleMouseUp],
  )

  return { startResize, isResizing }
}
