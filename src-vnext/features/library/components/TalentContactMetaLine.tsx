import { Fragment, type ReactNode } from "react"
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

type Field = { readonly key: string; readonly label: string; readonly node: ReactNode }

// Contact block demoted from a bordered card to a single inline editorial line.
export function TalentContactMetaLine({
  selected,
  canEdit,
  busy,
  savePatch,
}: TalentContactMetaLineProps) {
  // Editors see every field (so they can fill blanks in); read-only viewers
  // only see the fields that actually have a value.
  const candidates: ReadonlyArray<Field | null> = [
    canEdit || selected.email
      ? {
          key: "email",
          label: "Email",
          node: (
            <InlineEdit
              value={selected.email ?? ""}
              disabled={!canEdit || busy}
              placeholder="—"
              onSave={(next) => void savePatch(selected.id, { email: next || null })}
              className="text-sm"
              showEditIcon={canEdit && !busy}
            />
          ),
        }
      : null,
    canEdit || selected.phone
      ? {
          key: "phone",
          label: "Phone",
          node: (
            <InlineEdit
              value={selected.phone ?? ""}
              disabled={!canEdit || busy}
              placeholder="—"
              onSave={(next) => void savePatch(selected.id, { phone: next || null })}
              className="text-sm"
              showEditIcon={canEdit && !busy}
            />
          ),
        }
      : null,
    canEdit || selected.url
      ? {
          key: "web",
          label: "Web",
          node: (
            <ReferenceUrlField
              url={selected.url}
              canEdit={canEdit}
              busy={busy}
              onSave={(next) => void savePatch(selected.id, { url: next })}
            />
          ),
        }
      : null,
  ]
  const fields = candidates.filter((f): f is Field => f !== null)

  return (
    <div
      data-testid="talent-contact-metaline"
      className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5 text-sm"
    >
      {fields.length === 0 ? (
        <span className="text-[var(--color-text-subtle)]">No contact details</span>
      ) : (
        fields.map((f, i) => (
          <Fragment key={f.key}>
            {i > 0 ? <MetaDot /> : null}
            <Segment label={f.label}>{f.node}</Segment>
          </Fragment>
        ))
      )}
    </div>
  )
}
