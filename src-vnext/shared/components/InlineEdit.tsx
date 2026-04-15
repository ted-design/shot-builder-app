import { useEffect, useRef, useState } from "react"
import { Pencil } from "lucide-react"
import { Input } from "@/ui/input"
import { cn } from "@/shared/lib/utils"

interface InlineEditProps {
  readonly value: string
  readonly onSave: (value: string) => void
  readonly placeholder?: string
  readonly className?: string
  readonly disabled?: boolean
  /** When true, shows a pencil icon on hover to indicate the field is editable */
  readonly showEditIcon?: boolean
}

export function InlineEdit({
  value,
  onSave,
  placeholder = "Click to edit",
  className,
  disabled = false,
  showEditIcon = false,
}: InlineEditProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) return
    setDraft(value)
  }, [editing, value])

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const handleSave = () => {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed !== value) {
      onSave(trimmed)
    }
  }

  if (editing) {
    return (
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave()
          if (e.key === "Escape") {
            setDraft(value)
            setEditing(false)
          }
        }}
        className={cn("h-auto py-1", className)}
      />
    )
  }

  const showIcon = showEditIcon && !disabled

  return (
    <span
      className={cn(
        "group/edit inline-flex items-center gap-1 cursor-pointer rounded px-1 py-0.5 transition-colors hover:bg-[var(--color-surface-subtle)]",
        disabled && "cursor-default hover:bg-transparent",
        !value && "text-[var(--color-text-subtle)]",
        className,
      )}
      role={disabled ? undefined : "button"}
      tabIndex={disabled ? undefined : 0}
      onClick={() => {
        if (!disabled) setEditing(true)
      }}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault()
          setEditing(true)
        }
      }}
    >
      {value || placeholder}
      {showIcon ? (
        <Pencil className="invisible h-3 w-3 flex-shrink-0 text-[var(--color-text-subtle)] group-hover/edit:visible" />
      ) : null}
    </span>
  )
}
