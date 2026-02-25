import { useCallback, useEffect, useRef, useState } from "react"
import { useAutoSave, type SaveState } from "@/shared/hooks/useAutoSave"
import { Textarea } from "@/ui/textarea"
import { Input } from "@/ui/input"

// ---------------------------------------------------------------------------
// SectionLabel
// ---------------------------------------------------------------------------

export function SectionLabel({ children }: { readonly children: React.ReactNode }) {
  return (
    <span className="text-2xs font-semibold uppercase tracking-widest text-[var(--color-text-subtle)]">
      {children}
    </span>
  )
}

// ---------------------------------------------------------------------------
// MetaEditorCard
// ---------------------------------------------------------------------------

export function MetaEditorCard({
  label,
  children,
}: {
  readonly label: string
  readonly children: React.ReactNode
}) {
  return (
    <div className="rounded-md border border-[var(--color-border)] px-2 py-1.5">
      <p className="text-3xs font-semibold uppercase tracking-wide text-[var(--color-text-subtle)]">
        {label}
      </p>
      <div className="mt-0.5">{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ReadOnlyMetaValue
// ---------------------------------------------------------------------------

export function ReadOnlyMetaValue({ value }: { readonly value: string }) {
  return <p className="text-xs font-semibold text-[var(--color-text)]">{value}</p>
}

// ---------------------------------------------------------------------------
// SaveIndicator
// ---------------------------------------------------------------------------

export function SaveIndicator({ state }: { readonly state: SaveState }) {
  if (state === "idle") return null
  const label =
    state === "saving" ? "Saving\u2026" :
    state === "saved" ? "Saved" :
    "Save failed"
  const color =
    state === "error"
      ? "text-[var(--color-error)]"
      : "text-[var(--color-text-subtle)]"
  return (
    <span className={`text-3xs font-medium ${color}`} data-testid="save-indicator">
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// DescriptionEditor
// ---------------------------------------------------------------------------

export function DescriptionEditor({
  value,
  onSave,
}: {
  readonly value: string
  readonly onSave: (value: string) => Promise<void>
}) {
  const [draft, setDraft] = useState(value)
  const [editing, setEditing] = useState(false)
  const { saveState, scheduleSave, flush, cancel } = useAutoSave()

  // Keep a ref to flush so cleanup always uses the latest version
  const flushRef = useRef(flush)
  flushRef.current = flush

  // Flush pending save on unmount (e.g. back-button navigation)
  useEffect(() => {
    return () => flushRef.current()
  }, [])

  const handleChange = useCallback(
    (newValue: string) => {
      setDraft(newValue)
      const trimmed = newValue.trim()
      if (trimmed !== value) {
        scheduleSave(() => onSave(trimmed))
      } else {
        cancel()
      }
    },
    [value, onSave, scheduleSave, cancel],
  )

  const handleBlur = useCallback(() => {
    flush()
    setEditing(false)
  }, [flush])

  if (!editing) {
    return (
      <p
        className="cursor-pointer rounded px-1.5 py-0.5 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-subtle)]"
        onClick={() => {
          setDraft(value)
          setEditing(true)
        }}
      >
        {value || "Click to add..."}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <Textarea
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        autoFocus
        rows={2}
        className="text-sm"
        data-testid="description-input"
      />
      <div className="flex justify-end">
        <SaveIndicator state={saveState} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DateEditor
// ---------------------------------------------------------------------------

export function DateEditor({
  value,
  onSave,
}: {
  readonly value: string
  readonly onSave: (value: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  const handleBlur = () => {
    setEditing(false)
    if (draft !== value) {
      onSave(draft)
    }
  }

  if (!editing) {
    return (
      <p
        className="cursor-pointer rounded px-1.5 py-0.5 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-subtle)]"
        onClick={() => {
          setDraft(value)
          setEditing(true)
        }}
      >
        {value || "Click to set date..."}
      </p>
    )
  }

  return (
    <Input
      type="date"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={handleBlur}
      autoFocus
      className="h-8 px-2 text-xs"
    />
  )
}
