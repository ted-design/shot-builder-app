import type { DayDetails } from "@/shared/types"

interface OnSetNotesTabProps {
  dayDetails: DayDetails | null
}

export function OnSetNotesTab({ dayDetails }: OnSetNotesTabProps) {
  const notes = dayDetails?.notes ?? null

  return (
    <div className="px-4 pt-6 pb-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-[var(--color-text)]">Notes</h3>
      </div>

      {notes ? (
        <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] p-4">
          <p className="text-sm text-[var(--color-text)] whitespace-pre-wrap leading-relaxed">
            {notes}
          </p>
        </div>
      ) : (
        <p className="text-sm text-[var(--color-text-muted)] py-6 text-center">
          No notes for today.
        </p>
      )}
    </div>
  )
}
