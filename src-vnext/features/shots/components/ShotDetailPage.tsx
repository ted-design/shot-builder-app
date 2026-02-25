import { useParams, useNavigate } from "react-router-dom"
import { LoadingState } from "@/shared/components/LoadingState"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { InlineEdit } from "@/shared/components/InlineEdit"
import { useShot } from "@/features/shots/hooks/useShot"
import { useShots } from "@/features/shots/hooks/useShots"
import { ShotStatusSelect } from "@/features/shots/components/ShotStatusSelect"
import { TalentPicker } from "@/features/shots/components/TalentPicker"
import { LocationPicker } from "@/features/shots/components/LocationPicker"
import { NotesSection } from "@/features/shots/components/NotesSection"
import { HeroImageSection } from "@/features/shots/components/HeroImageSection"
import { ActiveLookCoverReferencesPanel } from "@/features/shots/components/ActiveLookCoverReferencesPanel"
import { ShotLooksSection } from "@/features/shots/components/ShotLooksSection"
import { ShotCommentsSection } from "@/features/shots/components/ShotCommentsSection"
import { ShotVersionHistorySection } from "@/features/shots/components/ShotVersionHistorySection"
import { TagEditor } from "@/features/shots/components/TagEditor"
import { ShotLifecycleActionsMenu } from "@/features/shots/components/ShotLifecycleActionsMenu"
import { ShotReferenceLinksSection } from "@/features/shots/components/ShotReferenceLinksSection"
import { updateShotWithVersion } from "@/features/shots/lib/updateShotWithVersion"
import { formatDateOnly, parseDateOnly } from "@/features/shots/lib/dateOnly"
import { useAuth } from "@/app/providers/AuthProvider"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { canManageShots } from "@/shared/lib/rbac"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import { textPreview } from "@/shared/lib/textPreview"
import {
  SectionLabel,
  MetaEditorCard,
  ReadOnlyMetaValue,
  SaveIndicator,
  DescriptionEditor,
  DateEditor,
} from "@/features/shots/components/ShotDetailShared"
import { Button } from "@/ui/button"
import { Separator } from "@/ui/separator"
import { ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { useMemo, useState } from "react"
import { useKeyboardShortcuts } from "@/shared/hooks/useKeyboardShortcuts"
import { ShotsShareDialog } from "@/features/shots/components/ShotsShareDialog"
import { ShotPdfExportDialog } from "@/features/shots/components/ShotPdfExportDialog"
import { useLocations, useTalent } from "@/features/shots/hooks/usePickerData"
import { useProjects } from "@/features/projects/hooks/useProjects"

export default function ShotDetailPage() {
  const { sid } = useParams<{ sid: string }>()
  const navigate = useNavigate()
  const { data: shot, loading, error } = useShot(sid)
  const { data: projectShots } = useShots()
  const { data: projects } = useProjects()
  const { role, clientId, user } = useAuth()
  const { projectName } = useProjectScope()
  const isMobile = useIsMobile()
  const { data: talentRecords } = useTalent()
  const { data: locationRecords } = useLocations()

  const canEdit = canManageShots(role) && !isMobile
  const canDoOperational = canManageShots(role)
  const canManageLifecycle = (role === "admin" || role === "producer") && !isMobile
  const canShare = role === "admin" || role === "producer"
  const [shareOpen, setShareOpen] = useState(false)
  const canExport = !isMobile
  const [exportOpen, setExportOpen] = useState(false)

  const talentNameById = useMemo(() => {
    return new Map(talentRecords.map((t) => [t.id, t.name]))
  }, [talentRecords])

  const locationNameById = useMemo(() => {
    return new Map(locationRecords.map((l) => [l.id, l.name]))
  }, [locationRecords])

  const existingShotTitles = useMemo(() => {
    return new Set(
      projectShots
        .map((entry) => entry.title?.trim())
        .filter((entry): entry is string => !!entry && entry.length > 0),
    )
  }, [projectShots])

  // -- Keyboard shortcuts: Escape = back, Cmd+S = prevent browser save (auto-save handles it) --
  useKeyboardShortcuts([
    { key: "Escape", handler: () => navigate(-1) },
    { key: "s", meta: true, handler: () => { /* auto-save flushes on blur; this just prevents browser save dialog */ } },
  ])

  const save = async (fields: Record<string, unknown>): Promise<boolean> => {
    if (!shot || !clientId) return false
    try {
      await updateShotWithVersion({
        clientId,
        shotId: shot.id,
        patch: fields,
        shot,
        user,
        source: "ShotDetailPage",
      })
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
  const talentCount = (shot.talentIds ?? shot.talent ?? []).length

  return (
    <ErrorBoundary>
      <div className="flex flex-col gap-5">
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
          {canExport && (
            <Button variant="outline" onClick={() => setExportOpen(true)}>
              Export
            </Button>
          )}
          {canShare && (
            <Button variant="outline" onClick={() => setShareOpen(true)}>
              Share
            </Button>
          )}
          {canManageLifecycle && (
            <ShotLifecycleActionsMenu
              shot={shot}
              projects={projects}
              existingTitles={existingShotTitles}
            />
          )}
          <ShotStatusSelect
            shotId={shot.id}
            currentStatus={shot.status}
            shot={shot}
            disabled={!canDoOperational}
          />
        </div>

        <Separator />

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
          <div className="flex flex-col gap-4">
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

            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <SectionLabel>Hero / Header</SectionLabel>
              </div>
              <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_240px]">
                <HeroImageSection
                  heroImage={shot.heroImage}
                  shot={shot}
                  shotId={shot.id}
                  canUpload={canEdit}
                />
                <ActiveLookCoverReferencesPanel shot={shot} canEdit={canEdit} />
              </div>
              <div className="mt-2 grid grid-cols-1 gap-1.5 md:grid-cols-3">
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
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <NotesSection
                notes={shot.notes}
                notesAddendum={shot.notesAddendum}
                onSaveAddendum={async (value) => {
                  const ok = await save({ notesAddendum: value || null })
                  if (!ok) throw new Error("Failed to save addendum")
                }}
                canEditAddendum={canDoOperational}
              />
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

              <div>
                <SectionLabel>Tags</SectionLabel>
                <TagEditor
                  tags={shot.tags ?? []}
                  onSave={(next) => save({ tags: next })}
                  disabled={!canEdit}
                />
              </div>
            </div>

            <ShotCommentsSection shotId={shot.id} canComment={canDoOperational} />

            <ShotVersionHistorySection shot={shot} />
          </div>

          <div className="flex flex-col gap-4 xl:sticky xl:top-4">
            <SectionLabel>Looks + Products</SectionLabel>
            <ShotLooksSection shot={shot} canEdit={canEdit} showReferencesSection={false} />
          </div>
        </div>

        {canShare && (
          <ShotsShareDialog
            open={shareOpen}
            onOpenChange={setShareOpen}
            clientId={clientId}
            projectId={shot.projectId}
            projectName={projectName || "Project"}
            user={user}
            selectedShotIds={[shot.id]}
          />
        )}

        {canExport && (
          <ShotPdfExportDialog
            open={exportOpen}
            onOpenChange={setExportOpen}
            projectName={projectName || "Project"}
            shot={shot}
            talentNameById={talentNameById}
            locationNameById={locationNameById}
            storageKeyBase={clientId ? `sb:shots:detail:${clientId}:${shot.projectId}` : null}
          />
        )}
      </div>
    </ErrorBoundary>
  )
}

