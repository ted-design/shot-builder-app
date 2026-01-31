import { useState } from "react"
import { SanitizedHtml } from "@/shared/components/SanitizedHtml"
import { Label } from "@/ui/label"
import { Textarea } from "@/ui/textarea"
import { Separator } from "@/ui/separator"

interface NotesSectionProps {
  /** Legacy HTML notes — rendered read-only, NEVER written to. */
  readonly notes: string | null | undefined
  /** Plain-text addendum — the only writable notes field. */
  readonly notesAddendum: string | null | undefined
  /** Called with new addendum value. Never receives legacy notes. */
  readonly onSaveAddendum: (value: string) => void
  /** Whether the addendum field is editable (status + role check). */
  readonly canEditAddendum: boolean
}

/**
 * Notes section for shot detail page.
 *
 * - Legacy HTML notes: read-only via SanitizedHtml. No write path.
 * - Producer addendum: plain-text textarea, writes to notesAddendum only.
 */
export function NotesSection({
  notes,
  notesAddendum,
  onSaveAddendum,
  canEditAddendum,
}: NotesSectionProps) {
  const [draft, setDraft] = useState(notesAddendum ?? "")
  const [editing, setEditing] = useState(false)

  const handleBlur = () => {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed !== (notesAddendum ?? "").trim()) {
      onSaveAddendum(trimmed)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label className="mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
          Notes
        </Label>
        <SanitizedHtml html={notes} emptyText="No notes" />
      </div>

      <Separator />

      <div>
        <Label className="mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
          Producer Addendum
        </Label>
        {canEditAddendum ? (
          editing ? (
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={handleBlur}
              autoFocus
              rows={3}
              placeholder="Add on-set notes..."
              className="text-sm"
            />
          ) : (
            <p
              className="cursor-pointer rounded px-2 py-1 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-subtle)]"
              onClick={() => {
                setDraft(notesAddendum ?? "")
                setEditing(true)
              }}
            >
              {notesAddendum || "Click to add on-set notes..."}
            </p>
          )
        ) : (
          <p className="text-sm text-[var(--color-text-secondary)]">
            {notesAddendum || "No addendum"}
          </p>
        )}
      </div>
    </div>
  )
}
