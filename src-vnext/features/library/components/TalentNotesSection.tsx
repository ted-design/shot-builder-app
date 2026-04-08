import { SanitizedHtml } from "@/shared/components/SanitizedHtml"
import { containsHtml } from "@/shared/lib/textUtils"
import { InlineTextarea } from "@/features/library/components/TalentInlineEditors"
import type { TalentRecord } from "@/shared/types"

interface TalentNotesSectionProps {
  readonly selected: TalentRecord
  readonly canEdit: boolean
  readonly busy: boolean
  readonly savePatch: (id: string, patch: Record<string, unknown>) => Promise<void>
}

export function TalentNotesSection({
  selected,
  canEdit,
  busy,
  savePatch,
}: TalentNotesSectionProps) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="heading-subsection mb-3">Notes</div>

      {selected.notes && containsHtml(selected.notes) ? (
        <div className="max-h-[240px] overflow-y-auto">
          <SanitizedHtml html={selected.notes} className="text-sm" />
        </div>
      ) : (
        <InlineTextarea
          value={selected.notes ?? ""}
          disabled={!canEdit || busy}
          placeholder="Notes about sizing, fit, availability…"
          className="min-h-[140px] max-h-[240px] overflow-y-auto"
          onCommit={(next) => {
            void savePatch(selected.id, { notes: next.trim() ? next : null })
          }}
        />
      )}
    </div>
  )
}
