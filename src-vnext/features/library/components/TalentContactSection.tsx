import { useEffect, useRef, useState } from "react"
import { ExternalLink, Pencil } from "lucide-react"
import { Input } from "@/ui/input"
import { InlineEdit } from "@/shared/components/InlineEdit"
import type { TalentRecord } from "@/shared/types"

function tryHostname(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

interface ReferenceUrlFieldProps {
  readonly url: string | null | undefined
  readonly canEdit: boolean
  readonly busy: boolean
  readonly onSave: (next: string | null) => void
}

// Reference URL row: clickable hostname link as the display; full URL only while editing.
function ReferenceUrlField({ url, canEdit, busy, onSave }: ReferenceUrlFieldProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(url ?? "")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) setDraft(url ?? "")
  }, [editing, url])

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const commit = () => {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed !== (url ?? "")) onSave(trimmed || null)
  }

  if (editing) {
    return (
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit()
          if (e.key === "Escape") {
            setDraft(url ?? "")
            setEditing(false)
          }
        }}
        placeholder="https://…"
        className="h-auto py-1 text-sm"
      />
    )
  }

  const host = url ? tryHostname(url) : null

  return (
    <div className="group/url flex items-center gap-2">
      {url && host ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3 w-3 flex-shrink-0" />
          {host}
        </a>
      ) : (
        <span className="text-sm text-[var(--color-text-subtle)]">{url || "—"}</span>
      )}
      {canEdit && !busy ? (
        <button
          type="button"
          aria-label="Edit reference URL"
          className="invisible inline-flex flex-shrink-0 text-[var(--color-text-subtle)] transition-colors hover:text-[var(--color-text)] group-hover/url:visible"
          onClick={() => setEditing(true)}
        >
          <Pencil className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  )
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
          <ReferenceUrlField
            url={selected.url}
            canEdit={canEdit}
            busy={busy}
            onSave={(next) => void savePatch(selected.id, { url: next })}
          />
        </div>
      </div>
    </div>
  )
}
