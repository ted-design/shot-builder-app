import { useState, useEffect } from "react"
import { Input } from "@/ui/input"
import { Textarea } from "@/ui/textarea"

export function InlineInput({
  value,
  disabled,
  placeholder,
  onCommit,
  className,
}: {
  readonly value: string
  readonly disabled: boolean
  readonly placeholder?: string
  readonly onCommit: (next: string) => void
  readonly className?: string
}) {
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    setDraft(value)
  }, [value])

  return (
    <Input
      value={draft}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const next = draft.trim()
        if (next !== value.trim()) onCommit(next)
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          ;(e.target as HTMLInputElement).blur()
        }
        if (e.key === "Escape") {
          setDraft(value)
          ;(e.target as HTMLInputElement).blur()
        }
      }}
      className={className}
    />
  )
}

export function InlineTextarea({
  value,
  disabled,
  placeholder,
  onCommit,
  className,
}: {
  readonly value: string
  readonly disabled: boolean
  readonly placeholder?: string
  readonly onCommit: (next: string) => void
  readonly className?: string
}) {
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    setDraft(value)
  }, [value])

  return (
    <Textarea
      value={draft}
      disabled={disabled}
      placeholder={placeholder}
      className={className}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onCommit(draft)
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setDraft(value)
          ;(e.target as HTMLTextAreaElement).blur()
        }
      }}
    />
  )
}
