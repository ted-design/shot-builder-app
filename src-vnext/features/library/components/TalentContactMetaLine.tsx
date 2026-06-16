import type { ReactNode } from "react"
import { InlineEdit } from "@/shared/components/InlineEdit"
import { ReferenceUrlField } from "@/features/library/components/TalentContactSection"
import type { TalentRecord } from "@/shared/types"

interface TalentContactMetaLineProps {
  readonly selected: TalentRecord
  readonly canEdit: boolean
  readonly busy: boolean
  readonly savePatch: (id: string, patch: Record<string, unknown>) => Promise<void>
}

// One inline editorial meta-line segment: an uppercase micro-label + its value.
function Segment({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <span className="inline-flex min-w-0 items-baseline gap-1.5">
      <span className="label-meta shrink-0">{label}</span>
      <span className="min-w-0">{children}</span>
    </span>
  )
}

function MetaDot() {
  return (
    <span aria-hidden="true" className="text-[var(--color-text-subtle)]">
      &middot;
    </span>
  )
}

// Inline editable contact meta-line — email · phone · web.
export function TalentContactMetaLine({
  selected,
  canEdit,
  busy,
  savePatch,
}: TalentContactMetaLineProps) {
  return (
    <div
      data-testid="talent-contact-metaline"
      className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5 text-sm"
    >
      <Segment label="Email">
        <InlineEdit
          value={selected.email ?? ""}
          disabled={!canEdit || busy}
          placeholder="—"
          onSave={(next) => void savePatch(selected.id, { email: next || null })}
          className="text-sm"
          showEditIcon={canEdit && !busy}
        />
      </Segment>

      <MetaDot />

      <Segment label="Phone">
        <InlineEdit
          value={selected.phone ?? ""}
          disabled={!canEdit || busy}
          placeholder="—"
          onSave={(next) => void savePatch(selected.id, { phone: next || null })}
          className="text-sm"
          showEditIcon={canEdit && !busy}
        />
      </Segment>

      <MetaDot />

      <Segment label="Web">
        <ReferenceUrlField
          url={selected.url}
          canEdit={canEdit}
          busy={busy}
          onSave={(next) => void savePatch(selected.id, { url: next })}
        />
      </Segment>
    </div>
  )
}
