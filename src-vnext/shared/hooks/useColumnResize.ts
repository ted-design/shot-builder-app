import { useCallback, useRef, useState } from "react"

/**
 * Mouse-based column resize handler.
 * Tracks mousemove from an initial mousedown position and reports width changes.
 *
 * `onWidthChange` is rAF-coalesced: mousemove can fire far more often than the
 * browser paints, so intermediate positions within a single animation frame are
 * collapsed and only the LATEST width for that frame is delivered. The pending
 * frame is always flushed on mouseup (even if the browser never got to paint it),
 * so `onWidthChange` still reports the true end-of-drag width.
 *
 * `onResizeEnd`, if provided, fires exactly once per drag — on mouseup, with the
 * final {key, width} — for consumers that want to defer expensive work (e.g. a
 * localStorage persist) until the drag is over rather than on every width update.
 */
export function useColumnResize(opts: {
  readonly onWidthChange: (key: string, width: number) => void
  readonly onResizeEnd?: (key: string, width: number) => void
  readonly minWidth?: number   // default 60
  readonly maxWidth?: number   // default 600
}): {
  readonly startResize: (key: string, startX: number, currentWidth: number) => void
  readonly isResizing: boolean
} {
  const { onWidthChange, onResizeEnd, minWidth = 60, maxWidth = 600 } = opts
  const [isResizing, setIsResizing] = useState(false)
  const stateRef = useRef<{
    readonly key: string
    readonly startX: number
    readonly startWidth: number
  } | null>(null)
  const rafIdRef = useRef<number | null>(null)
  const pendingRef = useRef<{ key: string; width: number } | null>(null)

  const flushPending = useCallback(() => {
    rafIdRef.current = null
    const pending = pendingRef.current
    if (!pending) return
    pendingRef.current = null
    onWidthChange(pending.key, pending.width)
  }, [onWidthChange])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const state = stateRef.current
      if (!state) return
      const delta = e.clientX - state.startX
      const newWidth = Math.max(minWidth, Math.min(maxWidth, state.startWidth + delta))
      pendingRef.current = { key: state.key, width: newWidth }
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(flushPending)
      }
    },
    [minWidth, maxWidth, flushPending],
  )

  const handleMouseUp = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
    const pending = pendingRef.current
    pendingRef.current = null
    const state = stateRef.current
    stateRef.current = null
    setIsResizing(false)
    document.body.style.cursor = ""
    document.body.style.userSelect = ""
    document.removeEventListener("mousemove", handleMouseMove)
    document.removeEventListener("mouseup", handleMouseUp)
    if (!state) return
    // Flush any frame the rAF never got to paint so onWidthChange still sees
    // the true end-of-drag width, then report the single resize-end signal.
    if (pending) onWidthChange(pending.key, pending.width)
    onResizeEnd?.(state.key, pending?.width ?? state.startWidth)
  }, [handleMouseMove, onWidthChange, onResizeEnd])

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
