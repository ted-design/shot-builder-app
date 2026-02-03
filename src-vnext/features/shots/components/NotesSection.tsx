import { useState } from "react"
import { SanitizedHtml } from "@/shared/components/SanitizedHtml"
import { Label } from "@/ui/label"
import { Textarea } from "@/ui/textarea"
import { Button } from "@/ui/button"
import { Separator } from "@/ui/separator"

interface NotesSectionProps {
  /** Legacy HTML notes — rendered read-only, NEVER written to. */
  readonly notes: string | null | undefined
  /** Plain-text addendum — displayed read-only. Only appended to. */
  readonly notesAddendum: string | null | undefined
  /** Called with the new entry string to append. Must return a Promise. */
  readonly onAppendAddendum: (newEntry: string) => Promise<void>
  /** Whether the addendum append control is available (status + role check). */
  readonly canEditAddendum: boolean
}

/**
 * Notes section for shot detail page.
 *
 * - Legacy HTML notes: read-only via SanitizedHtml. No write path.
 * - Producer addendum: existing text displayed read-only. Separate input
 *   appends new entries — prior content cannot be edited in-place.
 */
export function NotesSection({
  notes,
  notesAddendum,
  onAppendAddendum,
  canEditAddendum,
}: NotesSectionProps) {
  const [newEntry, setNewEntry] = useState("")
  const [saving, setSaving] = useState(false)

  const handleAppend = async () => {
    const trimmed = newEntry.trim()
    if (!trimmed) return
    setSaving(true)
    try {
      await onAppendAddendum(trimmed)
      setNewEntry("")
    } catch {
      // Keep user's typed entry on failure — no silent data loss.
    } finally {
      setSaving(false)
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

        {/* Existing addendum — always read-only */}
        {notesAddendum ? (
          <p className="whitespace-pre-wrap text-sm text-[var(--color-text-secondary)]">
            {notesAddendum}
          </p>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">
            No addendum yet
          </p>
        )}

        {/* Append control — only shown when user has permission */}
        {canEditAddendum && (
          <div className="mt-3 flex flex-col gap-2">
            <Textarea
              value={newEntry}
              onChange={(e) => setNewEntry(e.target.value)}
              rows={2}
              placeholder="Add to addendum..."
              className="text-sm"
              data-testid="addendum-input"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleAppend}
              disabled={saving || !newEntry.trim()}
              className="self-end"
              data-testid="addendum-submit"
            >
              Add to addendum
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
