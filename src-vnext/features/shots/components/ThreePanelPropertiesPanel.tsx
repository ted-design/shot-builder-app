import { InlineEdit } from "@/shared/components/InlineEdit"
import { ShotStatusSelect } from "@/features/shots/components/ShotStatusSelect"
import { TalentPicker } from "@/features/shots/components/TalentPicker"
import { LocationPicker } from "@/features/shots/components/LocationPicker"
import { TagEditor } from "@/features/shots/components/TagEditor"
import { ShotLooksSection } from "@/features/shots/components/ShotLooksSection"
import { ShotCommentsSection } from "@/features/shots/components/ShotCommentsSection"
import {
  SectionLabel,
  MetaEditorCard,
  ReadOnlyMetaValue,
  DateEditor,
} from "@/features/shots/components/ShotDetailShared"
import { formatDateOnly, parseDateOnly } from "@/features/shots/lib/dateOnly"
import { toast } from "sonner"
import type { Shot } from "@/shared/types"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ThreePanelPropertiesPanelProps {
  readonly shot: Shot
  readonly save: (fields: Record<string, unknown>) => Promise<boolean>
  readonly canEdit: boolean
  readonly canDoOperational: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ThreePanelPropertiesPanel({
  shot,
  save,
  canEdit,
  canDoOperational,
}: ThreePanelPropertiesPanelProps) {
  const talentCount = (shot.talentIds ?? shot.talent ?? []).length

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex flex-col gap-3 p-3">
        {/* Status with keyboard hints */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <SectionLabel>Status</SectionLabel>
            <span className="text-3xs text-[var(--color-text-subtle)]">
              <kbd className="rounded border border-[var(--color-border-strong)] bg-[var(--color-surface-subtle)] px-1 text-3xs">1</kbd>-
              <kbd className="rounded border border-[var(--color-border-strong)] bg-[var(--color-surface-subtle)] px-1 text-3xs">4</kbd>
            </span>
          </div>
          <ShotStatusSelect
            shotId={shot.id}
            currentStatus={shot.status}
            shot={shot}
            disabled={!canDoOperational}
          />
        </div>

        {/* Shot number */}
        <MetaEditorCard label="Shot #">
          {canEdit ? (
            <InlineEdit
              value={shot.shotNumber ?? ""}
              onSave={(shotNumber) => save({ shotNumber: shotNumber || null })}
              className="text-xs font-semibold text-[var(--color-text)]"
              placeholder="e.g. SH-001"
            />
          ) : (
            <ReadOnlyMetaValue value={shot.shotNumber || "Not set"} />
          )}
        </MetaEditorCard>

        {/* Date */}
        <MetaEditorCard label="Date">
          {canEdit ? (
            <DateEditor
              value={formatDateOnly(shot.date)}
              onSave={(dateStr) => {
                if (!dateStr) {
                  save({ date: null })
                  return
                }
                try {
                  const ts = parseDateOnly(dateStr)
                  save({ date: ts })
                } catch {
                  toast.error("Invalid date")
                }
              }}
            />
          ) : (
            <ReadOnlyMetaValue value={formatDateOnly(shot.date) || "Not set"} />
          )}
        </MetaEditorCard>

        {/* Location */}
        <MetaEditorCard label="Location">
          {canEdit ? (
            <LocationPicker
              selectedId={shot.locationId}
              selectedName={shot.locationName}
              onSave={(locationId, locationName) =>
                save({ locationId, locationName })
              }
              disabled={!canEdit}
              compact
            />
          ) : (
            <ReadOnlyMetaValue value={shot.locationName?.trim() || "Not set"} />
          )}
        </MetaEditorCard>

        {/* Talent */}
        <MetaEditorCard label="Talent">
          {canEdit ? (
            <TalentPicker
              selectedIds={shot.talentIds ?? shot.talent}
              onSave={(ids) => save({ talent: ids, talentIds: ids })}
              disabled={!canEdit}
              compact
            />
          ) : (
            <ReadOnlyMetaValue value={`${talentCount} assigned`} />
          )}
        </MetaEditorCard>

        {/* Tags */}
        <div>
          <SectionLabel>Tags</SectionLabel>
          <div className="mt-1">
            <TagEditor
              tags={shot.tags ?? []}
              onSave={(next) => save({ tags: next })}
              disabled={!canEdit}
            />
          </div>
        </div>

        {/* Looks + Products */}
        <div>
          <SectionLabel>Looks + Products</SectionLabel>
          <div className="mt-1">
            <ShotLooksSection shot={shot} canEdit={canEdit} showReferencesSection={false} />
          </div>
        </div>

        {/* Comments */}
        <ShotCommentsSection shotId={shot.id} canComment={canDoOperational} />
      </div>
    </div>
  )
}
