import { ExternalLink } from "lucide-react"
import { InlineEdit } from "@/shared/components/InlineEdit"
import type { TalentRecord } from "@/shared/types"

function tryHostname(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

interface TalentContactSectionProps {
  readonly selected: TalentRecord
  readonly canEdit: boolean
  readonly busy: boolean
  readonly savePatch: (id: string, patch: Record<string, unknown>) => Promise<void>
}

export function TalentContactSection({
  selected,
  canEdit,
  busy,
  savePatch,
}: TalentContactSectionProps) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="heading-subsection mb-3">Contact</div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="label-meta mb-1">Email</div>
          <InlineEdit
            value={selected.email ?? ""}
            disabled={!canEdit || busy}
            placeholder="—"
            onSave={(next) => void savePatch(selected.id, { email: next || null })}
            className="text-sm"
            showEditIcon={canEdit && !busy}
          />
        </div>

        <div>
          <div className="label-meta mb-1">Phone</div>
          <InlineEdit
            value={selected.phone ?? ""}
            disabled={!canEdit || busy}
            placeholder="—"
            onSave={(next) => void savePatch(selected.id, { phone: next || null })}
            className="text-sm"
            showEditIcon={canEdit && !busy}
          />
        </div>

        <div className="sm:col-span-2">
          <div className="label-meta mb-1">Reference URL</div>
          {selected.url && tryHostname(selected.url) ? (
            <a
              href={selected.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-1 inline-flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-3 w-3" />
              {tryHostname(selected.url)}
            </a>
          ) : null}
          {canEdit ? (
            <InlineEdit
              value={selected.url ?? ""}
              disabled={busy}
              placeholder="—"
              onSave={(next) => void savePatch(selected.id, { url: next || null })}
              className="text-sm"
              showEditIcon={!busy}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
