import { useCallback, useEffect, useRef, useState } from "react"
import { SanitizedHtml } from "@/shared/components/SanitizedHtml"
import { useAutoSave, type SaveState } from "@/shared/hooks/useAutoSave"
import { Label } from "@/ui/label"
import { Textarea } from "@/ui/textarea"
import { Separator } from "@/ui/separator"

interface NotesSectionProps {
  /** Legacy HTML notes — rendered read-only context, NEVER written to. */
  readonly notes: string | null | undefined
  /** Plain-text notes body backed by notesAddendum on shot docs. */
  readonly notesAddendum: string | null | undefined
  /** Called with the full notes value (persisted to notesAddendum). */
  readonly onSaveAddendum: (value: string) => Promise<void>
  /** Whether notes editing is available (status + role check). */
  readonly canEditAddendum: boolean
}

const URL_RE = /(https?:\/\/[^\s]+)/gi
const URL_PART_RE = /^https?:\/\/[^\s]+$/i

function LinkifiedText({ value }: { readonly value: string }) {
  const parts = value.split(URL_RE)
  return (
    <p className="whitespace-pre-wrap text-sm text-[var(--color-text-secondary)]">
      {parts.map((part, index) => {
        if (URL_PART_RE.test(part)) {
          return (
            <a
              key={`${part}-${index}`}
              href={part}
              target="_blank"
              rel="noreferrer noopener"
              className="text-[var(--color-primary)] underline underline-offset-2"
            >
              {part}
            </a>
          )
        }
        return <span key={`${part}-${index}`}>{part}</span>
      })}
    </p>
  )
}

/**
 * Notes section for shot detail page.
 *
 * - Read mode by default — click to enter edit mode (editable users only).
 * - Edit mode: Textarea with autoFocus, auto-save on change, flush + exit on blur.
 * - Legacy HTML notes remain visible as read-only historical context.
 */
function NotesSaveIndicator({ state }: { readonly state: SaveState }) {
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
    <span className={`text-3xs font-medium ${color}`} data-testid="notes-save-indicator">
      {label}
    </span>
  )
}

export function NotesSection({
  notes,
  notesAddendum,
  onSaveAddendum,
  canEditAddendum,
}: NotesSectionProps) {
  const [draft, setDraft] = useState(notesAddendum ?? "")
  const [editing, setEditing] = useState(false)
  const { saveState, scheduleSave, flush, cancel } = useAutoSave()

  // Keep flush ref current for unmount cleanup
  const flushRef = useRef(flush)
  flushRef.current = flush

  // Flush pending save on unmount
  useEffect(() => {
    return () => flushRef.current()
  }, [])

  // Sync draft when server value changes (and user hasn't made local changes)
  useEffect(() => {
    if (!editing) {
      setDraft(notesAddendum ?? "")
    }
  }, [notesAddendum, editing])

  const normalizedInitial = (notesAddendum ?? "").trim()

  const handleChange = useCallback(
    (newValue: string) => {
      setDraft(newValue)
      const trimmed = newValue.trim()
      if (trimmed !== normalizedInitial) {
        scheduleSave(() => onSaveAddendum(trimmed))
      } else {
        cancel()
      }
    },
    [normalizedInitial, onSaveAddendum, scheduleSave, cancel],
  )

  const handleBlur = useCallback(() => {
    flush()
    setEditing(false)
  }, [flush])

  const enterEditMode = useCallback(() => {
    setDraft(notesAddendum ?? "")
    setEditing(true)
  }, [notesAddendum])

  return (
    <div className="flex flex-col gap-4">
      <div>
        {/* Editable notes — read/edit toggle */}
        {canEditAddendum && editing ? (
          <div className="flex flex-col gap-1.5">
            <Textarea
              value={draft}
              onChange={(e) => handleChange(e.target.value)}
              onBlur={handleBlur}
              autoFocus
              rows={4}
              placeholder="Add notes or reminders..."
              className="text-sm"
              data-testid="notes-input"
            />
            <div className="flex items-center justify-end">
              <NotesSaveIndicator state={saveState} />
            </div>
          </div>
        ) : canEditAddendum && !editing ? (
          <div
            className="cursor-pointer rounded px-1.5 py-0.5 transition-colors hover:bg-[var(--color-surface-subtle)]"
            onClick={enterEditMode}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") enterEditMode()
            }}
            data-testid="notes-read-mode"
          >
            {normalizedInitial ? (
              <LinkifiedText value={normalizedInitial} />
            ) : (
              <p className="text-sm text-[var(--color-text-muted)]">
                Click to add notes...
              </p>
            )}
          </div>
        ) : (
          /* Read-only mode */
          normalizedInitial ? (
            <LinkifiedText value={normalizedInitial} />
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">
              No notes yet
            </p>
          )
        )}
      </div>

      {notes && notes.trim().length > 0 && (
        <>
          <Separator />
          <div>
            <Label className="mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
              Legacy Notes (Read-only)
            </Label>
            <SanitizedHtml html={notes} emptyText="No legacy notes" />
          </div>
        </>
      )}
    </div>
  )
}
