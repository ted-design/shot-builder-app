import { useEffect, useRef } from "react"
import { GripVertical } from "lucide-react"

interface ColumnResizeHandleProps {
  readonly onResize: (deltaPercent: number) => void
}

export function ColumnResizeHandle({ onResize }: ColumnResizeHandleProps) {
  const handleRef = useRef<HTMLDivElement>(null)
  const startXRef = useRef(0)
  const parentWidthRef = useRef(0)
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => { cleanupRef.current?.() }
  }, [])

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    startXRef.current = e.clientX
    const parent = handleRef.current?.parentElement
    parentWidthRef.current = parent?.offsetWidth ?? 1

    const handlePointerUp = (upEvent: PointerEvent) => {
      const deltaX = upEvent.clientX - startXRef.current
      const deltaPercent = (deltaX / parentWidthRef.current) * 100
      onResize(deltaPercent)
      cleanup()
    }

    const cleanup = () => {
      document.removeEventListener("pointerup", handlePointerUp)
      cleanupRef.current = null
    }
    cleanupRef.current = cleanup

    document.addEventListener("pointerup", handlePointerUp)
  }

  return (
    <div
      ref={handleRef}
      onPointerDown={handlePointerDown}
      className="group/resize relative w-3 shrink-0 cursor-col-resize"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize columns"
    >
      {/* Always-visible faint line */}
      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[var(--color-border)] transition-all group-hover/resize:w-0.5 group-hover/resize:bg-[var(--color-accent)]" />
      {/* Grip dots on hover */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover/resize:opacity-100">
        <GripVertical className="h-4 w-4 text-[var(--color-accent)]" />
      </div>
    </div>
  )
}
