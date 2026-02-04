import { useParams, useNavigate } from "react-router-dom"
import { LoadingState } from "@/shared/components/LoadingState"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { InlineEdit } from "@/shared/components/InlineEdit"
import { useShot } from "@/features/shots/hooks/useShot"
import { ShotStatusSelect } from "@/features/shots/components/ShotStatusSelect"
import { TalentPicker } from "@/features/shots/components/TalentPicker"
import { LocationPicker } from "@/features/shots/components/LocationPicker"
import { NotesSection } from "@/features/shots/components/NotesSection"
import { HeroImageSection } from "@/features/shots/components/HeroImageSection"
import { ShotLooksSection } from "@/features/shots/components/ShotLooksSection"
import { ShotCommentsSection } from "@/features/shots/components/ShotCommentsSection"
import { updateShotField } from "@/features/shots/lib/updateShot"
import { formatDateOnly, parseDateOnly } from "@/features/shots/lib/dateOnly"
import { useAuth } from "@/app/providers/AuthProvider"
import { canManageShots } from "@/shared/lib/rbac"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import { textPreview } from "@/shared/lib/textPreview"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Textarea } from "@/ui/textarea"
import { Separator } from "@/ui/separator"
import { Badge } from "@/ui/badge"
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

  const save = async (fields: Record<string, unknown>): Promise<boolean> => {
    if (!shot || !clientId) return false
    try {
      await updateShotField(shot.id, clientId, fields)
      return true
    } catch {
      toast.error("Failed to save changes")
      return false
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

  const safeDescription = textPreview(shot.description, Number.POSITIVE_INFINITY)

  return (
    <ErrorBoundary>
      <div className="flex flex-col gap-6">
        {/* ── Header: back, title, shot number, status ── */}
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

        {/* ── Composition zone: hero + assignments ── */}
        <div className="grid gap-6 md:grid-cols-[1fr_minmax(280px,360px)]">
          {/* LEFT: Hero image (visual anchor) */}
          <div>
            <HeroImageSection
              heroImage={shot.heroImage}
              shotId={shot.id}
              canUpload={canEdit}
            />
          </div>

          {/* RIGHT: Composition panel — what's in the frame */}
          <div className="flex flex-col gap-5">
            <SectionLabel>Looks</SectionLabel>
            <ShotLooksSection shot={shot} canEdit={canEdit} />

            <SectionLabel>Talent</SectionLabel>
            <TalentPicker
              selectedIds={shot.talentIds ?? shot.talent}
              onSave={(ids) => save({ talent: ids, talentIds: ids })}
              disabled={!canEdit}
            />

            <SectionLabel>Location</SectionLabel>
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

        <Separator />

        {/* ── Metadata zone: secondary, below-the-fold ── */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <SectionLabel>Date</SectionLabel>
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
              <p className="text-sm text-[var(--color-text-secondary)]">
                {formatDateOnly(shot.date) || "No date set"}
              </p>
            )}

            <SectionLabel>Description</SectionLabel>
            {canEdit ? (
              <DescriptionEditor
                value={safeDescription}
                onSave={(description) => save({ description: description || null })}
              />
            ) : (
              <p className="text-sm text-[var(--color-text-secondary)]">
                {safeDescription || "No description"}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <NotesSection
              notes={shot.notes}
              notesAddendum={shot.notesAddendum}
              onAppendAddendum={async (newEntry) => {
                const existing = (shot.notesAddendum ?? "").trim()
                const appended = existing
                  ? `${existing}\n\n${newEntry}`
                  : newEntry
                const ok = await save({ notesAddendum: appended })
                if (!ok) throw new Error("Failed to save addendum")
              }}
              canEditAddendum={canDoOperational}
            />

            {shot.tags && shot.tags.length > 0 && (
              <div>
                <SectionLabel>Tags</SectionLabel>
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
        </div>

        <Separator />

        <ShotCommentsSection shotId={shot.id} canComment={canDoOperational} />
      </div>
    </ErrorBoundary>
  )
}

function SectionLabel({ children }: { readonly children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-subtle)]">
      {children}
    </span>
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
