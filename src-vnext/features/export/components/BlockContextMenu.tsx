import { useEffect, useRef } from "react"
import { ArrowDown, ArrowUp, Copy, Trash2 } from "lucide-react"

interface BlockContextMenuProps {
  readonly x: number
  readonly y: number
  readonly onDuplicate: () => void
  readonly onDelete: () => void
  readonly onMoveUp: () => void
  readonly onMoveDown: () => void
  readonly canMoveUp: boolean
  readonly canMoveDown: boolean
  readonly onClose: () => void
}

export function BlockContextMenu({
  x,
  y,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  onClose,
}: BlockContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [onClose])

  const itemClass =
    "flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-left text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] transition-colors"
  const disabledClass =
    "flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-left text-sm text-[var(--color-text-subtle)] cursor-not-allowed opacity-50"

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-lg"
      style={{ left: x, top: y }}
      role="menu"
    >
      <button
        type="button"
        role="menuitem"
        className={itemClass}
        onClick={() => {
          onDuplicate()
          onClose()
        }}
      >
        <Copy className="h-3.5 w-3.5" />
        Duplicate Block
      </button>
      <button
        type="button"
        role="menuitem"
        className={`${itemClass} text-[var(--color-danger)] hover:text-[var(--color-danger)]`}
        onClick={() => {
          onDelete()
          onClose()
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete Block
      </button>
      <div className="my-1 h-px bg-[var(--color-border)]" role="separator" />
      <button
        type="button"
        role="menuitem"
        className={canMoveUp ? itemClass : disabledClass}
        disabled={!canMoveUp}
        onClick={() => {
          if (canMoveUp) {
            onMoveUp()
            onClose()
          }
        }}
      >
        <ArrowUp className="h-3.5 w-3.5" />
        Move Up
      </button>
      <button
        type="button"
        role="menuitem"
        className={canMoveDown ? itemClass : disabledClass}
        disabled={!canMoveDown}
        onClick={() => {
          if (canMoveDown) {
            onMoveDown()
            onClose()
          }
        }}
      >
        <ArrowDown className="h-3.5 w-3.5" />
        Move Down
      </button>
    </div>
  )
}
