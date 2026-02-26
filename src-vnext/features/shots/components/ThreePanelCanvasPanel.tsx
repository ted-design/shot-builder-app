import { ChevronLeft } from "lucide-react"
import { InlineEdit } from "@/shared/components/InlineEdit"
import { HeroImageSection } from "@/features/shots/components/HeroImageSection"
import { ActiveLookCoverReferencesPanel } from "@/features/shots/components/ActiveLookCoverReferencesPanel"
import { NotesSection } from "@/features/shots/components/NotesSection"
import { ShotReferenceLinksSection } from "@/features/shots/components/ShotReferenceLinksSection"
import { CompactActiveEditors } from "@/features/shots/components/ActiveEditorsBar"
import {
  SectionLabel,
  DescriptionEditor,
  SaveIndicator,
} from "@/features/shots/components/ShotDetailShared"
import { textPreview } from "@/shared/lib/textPreview"
import { useAuth } from "@/app/providers/AuthProvider"
import type { SaveState } from "@/shared/hooks/useAutoSave"
import type { Shot } from "@/shared/types"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ThreePanelCanvasPanelProps {
  readonly shot: Shot
  readonly save: (fields: Record<string, unknown>) => Promise<boolean>
  readonly canEdit: boolean
  readonly canDoOperational: boolean
  readonly onClose: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ThreePanelCanvasPanel({
  shot,
  save,
  canEdit,
  canDoOperational,
  onClose,
}: ThreePanelCanvasPanelProps) {
  const { clientId } = useAuth()
  const safeDescription = textPreview(shot.description, Number.POSITIVE_INFINITY)

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Back to list + presence indicator */}
      <div className="flex-shrink-0 border-b border-[var(--color-border)] px-4 py-1.5 flex items-center justify-between">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 -ml-1.5 text-xs text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text)]"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          <span>Shots</span>
        </button>
        <CompactActiveEditors
          clientId={clientId}
          entityType="shots"
          entityId={shot.id}
        />
      </div>

      <div className="flex flex-col gap-4 p-4">
        {/* Header: title + shot number */}
        <div className="flex items-baseline gap-3">
          {canEdit ? (
            <InlineEdit
              value={shot.title}
              onSave={(title) => save({ title })}
              className="heading-section"
            />
          ) : (
            <h2 className="heading-section">
              {shot.title || "Untitled Shot"}
            </h2>
          )}
          {canEdit ? (
            <InlineEdit
              value={shot.shotNumber ?? ""}
              onSave={(shotNumber) => save({ shotNumber: shotNumber || null })}
              className="text-sm text-[var(--color-text-subtle)]"
              placeholder="#"
            />
          ) : (
            shot.shotNumber && (
              <span className="text-sm text-[var(--color-text-subtle)]">
                #{shot.shotNumber}
              </span>
            )
          )}
        </div>

        {/* Hero / header image */}
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5">
          <SectionLabel>Hero / Header</SectionLabel>
          <div className="mt-1.5 grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_200px]">
            <HeroImageSection
              heroImage={shot.heroImage}
              shot={shot}
              shotId={shot.id}
              canUpload={canEdit}
            />
            <ActiveLookCoverReferencesPanel shot={shot} canEdit={canEdit} />
          </div>
        </div>

        {/* Description */}
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5">
          <SectionLabel>Description</SectionLabel>
          <div className="mt-1.5">
            {canEdit ? (
              <DescriptionEditor
                value={safeDescription}
                onSave={async (description) => {
                  const ok = await save({ description: description || null })
                  if (!ok) throw new Error("Save failed")
                }}
              />
            ) : (
              <p className="text-sm text-[var(--color-text-secondary)]">
                {safeDescription || "No description"}
              </p>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5">
          <SectionLabel>Notes</SectionLabel>
          <div className="mt-1.5">
            <NotesSection
              notes={shot.notes}
              notesAddendum={shot.notesAddendum}
              onSaveAddendum={async (value) => {
                const ok = await save({ notesAddendum: value || null })
                if (!ok) throw new Error("Failed to save addendum")
              }}
              canEditAddendum={canDoOperational}
            />
          </div>
        </div>

        {/* Reference links */}
        <ShotReferenceLinksSection
          shotId={shot.id}
          referenceLinks={shot.referenceLinks}
          notesAddendum={shot.notesAddendum}
          canEdit={canEdit}
          onSaveReferenceLinks={async (next) => {
            const ok = await save({ referenceLinks: next })
            if (!ok) throw new Error("Failed to save reference links")
          }}
        />
      </div>
    </div>
  )
}
