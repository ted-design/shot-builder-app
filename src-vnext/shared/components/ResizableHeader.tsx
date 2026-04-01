/**
 * A <th> wrapper that adds a resize handle on the right edge.
 * Used in interactive tables for Saturation-pattern column resizing.
 */

import { cn } from "@/shared/lib/utils"

interface ResizableHeaderProps {
  readonly columnKey: string
  readonly width: number
  readonly onStartResize: (key: string, startX: number, currentWidth: number) => void
  readonly children?: React.ReactNode
  readonly className?: string
}

export function ResizableHeader({
  columnKey,
  width,
  onStartResize,
  children,
  className,
}: ResizableHeaderProps) {
  return (
    <th
      style={{ width: `${width}px` }}
      className={cn("relative", className)}
    >
      {children}
      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={(e) => {
          e.preventDefault()
          onStartResize(columnKey, e.clientX, width)
        }}
        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-[var(--color-primary)]/30"
      />
    </th>
  )
}
