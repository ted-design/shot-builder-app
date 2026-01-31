import { useParams, useNavigate } from "react-router-dom"
import { LoadingState } from "@/shared/components/LoadingState"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { InlineEdit } from "@/shared/components/InlineEdit"
import { useShot } from "@/features/shots/hooks/useShot"
import { ShotStatusSelect } from "@/features/shots/components/ShotStatusSelect"
import { TalentPicker } from "@/features/shots/components/TalentPicker"
import { LocationPicker } from "@/features/shots/components/LocationPicker"
import { ProductAssignmentPicker } from "@/features/shots/components/ProductAssignmentPicker"
import { NotesSection } from "@/features/shots/components/NotesSection"
import { HeroImageSection } from "@/features/shots/components/HeroImageSection"
import { updateShotField } from "@/features/shots/lib/updateShot"
import { useAuth } from "@/app/providers/AuthProvider"
import { canManageShots } from "@/shared/lib/rbac"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import { Button } from "@/ui/button"
import { Label } from "@/ui/label"
import { Input } from "@/ui/input"
import { Textarea } from "@/ui/textarea"
import { Separator } from "@/ui/separator"
import { Badge } from "@/ui/badge"
import { ArrowLeft } from "lucide-react"
import { Timestamp } from "firebase/firestore"
import { toast } from "sonner"
import { useState } from "react"

function formatShotDate(date: Timestamp | undefined): string {
  if (!date) return ""
  const d = date.toDate()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

export default function ShotDetailPage() {
  const { sid } = useParams<{ sid: string }>()
  const navigate = useNavigate()
  const { data: shot, loading, error } = useShot(sid)
  const { role, clientId } = useAuth()
  const isMobile = useIsMobile()

  const canEdit = canManageShots(role) && !isMobile
  const canDoOperational = canManageShots(role)

  /**
   * Save arbitrary fields to the shot document.
   * SAFETY: Never include `notes` in the fields object.
   * Legacy HTML notes are read-only. Use `notesAddendum` only.
   */
  const save = async (fields: Record<string, unknown>) => {
    if (!shot || !clientId) return
    try {
      await updateShotField(shot.id, clientId, fields)
    } catch {
      toast.error("Failed to save changes")
    }
  }

  if (loading) return <LoadingState loading />
  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-[var(--color-error)]">{error}</p>
      </div>
    )
  }
  if (!shot) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-[var(--color-text-muted)]">Shot not found.</p>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="flex flex-col gap-6">
        {/* Header: back, title, shot number, status */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex flex-1 items-baseline gap-3">
            {canEdit ? (
              <InlineEdit
                value={shot.title}
                onSave={(title) => save({ title })}
                className="text-xl font-semibold"
              />
            ) : (
              <h1 className="text-xl font-semibold text-[var(--color-text)]">
                {shot.title || "Untitled Shot"}
              </h1>
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
          <ShotStatusSelect
            shotId={shot.id}
            currentStatus={shot.status}
            disabled={!canDoOperational}
          />
        </div>

        <Separator />

        {/* Hero image: display on all viewports, upload on desktop only */}
        <HeroImageSection
          heroImage={shot.heroImage}
          shotId={shot.id}
          canUpload={canEdit}
        />

        <div className="grid gap-6 md:grid-cols-2">
          {/* Left column: metadata + notes */}
          <div className="flex flex-col gap-4">
            {/* Date field */}
            <div>
              <Label className="mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
                Date
              </Label>
              {canEdit ? (
                <DateEditor
                  value={formatShotDate(shot.date)}
                  onSave={(dateStr) => {
                    if (!dateStr) {
                      save({ date: null })
                      return
                    }
                    const ms = Date.parse(dateStr)
                    if (!Number.isNaN(ms)) {
                      save({ date: Timestamp.fromMillis(ms) })
                    }
                  }}
                />
              ) : (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {formatShotDate(shot.date) || "No date set"}
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <Label className="mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
                Description
              </Label>
              {canEdit ? (
                <DescriptionEditor
                  value={shot.description ?? ""}
                  onSave={(description) => save({ description: description || null })}
                />
              ) : (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {shot.description || "No description"}
                </p>
              )}
            </div>

            {/* Notes: read-only HTML + writable addendum */}
            <NotesSection
              notes={shot.notes}
              notesAddendum={shot.notesAddendum}
              onSaveAddendum={(value) => save({ notesAddendum: value || null })}
              canEditAddendum={canDoOperational}
            />

            {/* Tags: read-only badges */}
            {shot.tags && shot.tags.length > 0 && (
              <div>
                <Label className="mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
                  Tags
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {shot.tags.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant="outline"
                      className="text-xs"
                      style={{ borderColor: tag.color, color: tag.color }}
                    >
                      {tag.label}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right column: assignments */}
          <div className="flex flex-col gap-4">
            <div>
              <Label className="mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
                Products
              </Label>
              <ProductAssignmentPicker
                selected={shot.products}
                onSave={(products) => save({ products })}
                disabled={!canEdit}
              />
            </div>

            <div>
              <Label className="mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
                Talent
              </Label>
              <TalentPicker
                selectedIds={shot.talentIds ?? shot.talent}
                onSave={(ids) => save({ talent: ids, talentIds: ids })}
                disabled={!canEdit}
              />
            </div>

            <div>
              <Label className="mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
                Location
              </Label>
              <LocationPicker
                selectedId={shot.locationId}
                selectedName={shot.locationName}
                onSave={(locationId, locationName) =>
                  save({ locationId, locationName })
                }
                disabled={!canEdit}
              />
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}

function DescriptionEditor({
  value,
  onSave,
}: {
  readonly value: string
  readonly onSave: (value: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const [editing, setEditing] = useState(false)

  const handleBlur = () => {
    setEditing(false)
    if (draft.trim() !== value) {
      onSave(draft.trim())
    }
  }

  if (!editing) {
    return (
      <p
        className="cursor-pointer rounded px-2 py-1 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-subtle)]"
        onClick={() => setEditing(true)}
      >
        {value || "Click to add..."}
      </p>
    )
  }

  return (
    <Textarea
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={handleBlur}
      autoFocus
      rows={3}
      className="text-sm"
    />
  )
}

function DateEditor({
  value,
  onSave,
}: {
  readonly value: string
  readonly onSave: (value: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  const handleBlur = () => {
    setEditing(false)
    if (draft !== value) {
      onSave(draft)
    }
  }

  if (!editing) {
    return (
      <p
        className="cursor-pointer rounded px-2 py-1 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-subtle)]"
        onClick={() => {
          setDraft(value)
          setEditing(true)
        }}
      >
        {value || "Click to set date..."}
      </p>
    )
  }

  return (
    <Input
      type="date"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={handleBlur}
      autoFocus
      className="text-sm"
    />
  )
}
