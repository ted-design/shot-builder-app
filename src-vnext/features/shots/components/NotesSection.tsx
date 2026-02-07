import { useEffect, useState } from "react"
import { SanitizedHtml } from "@/shared/components/SanitizedHtml"
import { Label } from "@/ui/label"
import { Textarea } from "@/ui/textarea"
import { Button } from "@/ui/button"
import { Separator } from "@/ui/separator"

interface NotesSectionProps {
  /** Legacy HTML notes — rendered read-only, NEVER written to. */
  readonly notes: string | null | undefined
  /** Plain-text addendum — editable operational notes. */
  readonly notesAddendum: string | null | undefined
  /** Called with the full addendum value. Must return a Promise. */
  readonly onSaveAddendum: (value: string) => Promise<void>
  /** Whether the addendum edit control is available (status + role check). */
  readonly canEditAddendum: boolean
}

/**
 * Notes section for shot detail page.
 *
 * - Legacy HTML notes: read-only via SanitizedHtml. No write path.
 * - Producer addendum: editable plain text for operational updates.
 */
export function NotesSection({
  notes,
  notesAddendum,
  onSaveAddendum,
  canEditAddendum,
}: NotesSectionProps) {
  const [draft, setDraft] = useState(notesAddendum ?? "")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDraft(notesAddendum ?? "")
  }, [notesAddendum])

  const normalizedInitial = (notesAddendum ?? "").trim()
  const normalizedDraft = draft.trim()
  const hasChanges = normalizedDraft !== normalizedInitial

  const handleSave = async () => {
    if (!hasChanges) return
    setSaving(true)
    try {
      await onSaveAddendum(normalizedDraft)
    } catch {
      // Keep user's typed changes on failure — no silent data loss.
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

        {canEditAddendum && (
          <div className="mt-3 flex flex-col gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              placeholder="Add operational notes..."
              className="text-sm"
              data-testid="addendum-input"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="self-end"
              data-testid="addendum-submit"
            >
              {saving ? "Saving…" : "Save addendum"}
            </Button>
          </div>
        )}

        {!canEditAddendum && (
          notesAddendum ? (
            <p className="whitespace-pre-wrap text-sm text-[var(--color-text-secondary)]">
              {notesAddendum}
            </p>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">
              No addendum yet
            </p>
          )
        )}
      </div>
    </div>
  )
}
