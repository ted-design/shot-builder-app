import { useParams, useNavigate } from "react-router-dom"
import { PageHeader } from "@/shared/components/PageHeader"
import { LoadingState } from "@/shared/components/LoadingState"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { InlineEdit } from "@/shared/components/InlineEdit"
import { useShot } from "@/features/shots/hooks/useShot"
import { ShotStatusSelect } from "@/features/shots/components/ShotStatusSelect"
import { TalentPicker } from "@/features/shots/components/TalentPicker"
import { LocationPicker } from "@/features/shots/components/LocationPicker"
import { ProductPicker } from "@/features/shots/components/ProductPicker"
import { updateShotField } from "@/features/shots/lib/updateShot"
import { useAuth } from "@/app/providers/AuthProvider"
import { canManageShots } from "@/shared/lib/rbac"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import { Button } from "@/ui/button"
import { Label } from "@/ui/label"
import { Textarea } from "@/ui/textarea"
import { Separator } from "@/ui/separator"
import { ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { useState } from "react"

export default function ShotDetailPage() {
  const { sid } = useParams<{ sid: string }>()
  const navigate = useNavigate()
  const { data: shot, loading, error } = useShot(sid)
  const { role, clientId } = useAuth()
  const isMobile = useIsMobile()

  const canEdit = canManageShots(role) && !isMobile
  const canDoOperational = canManageShots(role)

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
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
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
          </div>
          <ShotStatusSelect
            shotId={shot.id}
            currentStatus={shot.status}
            disabled={!canDoOperational}
          />
        </div>

        <Separator />

        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-4">
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

            <div>
              <Label className="mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
                Notes
              </Label>
              {canDoOperational ? (
                <DescriptionEditor
                  value={shot.notes ?? ""}
                  onSave={(notes) => save({ notes: notes || null })}
                />
              ) : (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {shot.notes || "No notes"}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <Label className="mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
                Products
              </Label>
              <ProductPicker
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
