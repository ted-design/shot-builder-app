import { useEffect, useRef, useState } from "react"
import { Input } from "@/ui/input"
import { cn } from "@/shared/lib/utils"

interface InlineEditProps {
  readonly value: string
  readonly onSave: (value: string) => void
  readonly placeholder?: string
  readonly className?: string
  readonly disabled?: boolean
}

export function InlineEdit({
  value,
  onSave,
  placeholder = "Click to edit",
  className,
  disabled = false,
}: InlineEditProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraft(value)
  }, [value])

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

  return (
    <span
      className={cn(
        "inline-block cursor-pointer rounded px-1 py-0.5 transition-colors hover:bg-[var(--color-surface-subtle)]",
        disabled && "cursor-default hover:bg-transparent",
        !value && "text-[var(--color-text-subtle)]",
        className,
      )}
      onClick={() => {
        if (!disabled) setEditing(true)
      }}
    >
      {value || placeholder}
    </span>
  )
}
