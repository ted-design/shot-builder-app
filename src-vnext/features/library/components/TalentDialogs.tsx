import { ConfirmDialog } from "@/shared/components/ConfirmDialog"
import { TalentCastingPrintPortal } from "@/features/library/components/TalentCastingPrintPortal"
import { DeleteTalentDialog } from "@/features/library/components/DeleteTalentDialog"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import type { TalentRecord } from "@/shared/types"
import type { TalentImage, CastingSession } from "@/features/library/components/talentUtils"

interface TalentDialogClusterProps {
  readonly busy: boolean
  readonly selected: TalentRecord | null
  readonly clientId: string | null
  readonly talentId: string
  readonly projectIds: readonly string[]
  readonly portfolioImages: readonly TalentImage[]
  readonly castingSessions: readonly CastingSession[]
  readonly projectLookup: ReadonlyMap<string, string>
  readonly printSession: CastingSession | null
  readonly printSessionId: string | null
  readonly setPrintSessionId: (id: string | null) => void
  readonly headshotRemoveOpen: boolean
  readonly setHeadshotRemoveOpen: (open: boolean) => void
  readonly galleryRemoveOpen: boolean
  readonly setGalleryRemoveOpen: (open: boolean) => void
  readonly galleryRemoveTarget: TalentImage | null
  readonly setGalleryRemoveTarget: (target: TalentImage | null) => void
  readonly sessionRemoveOpen: boolean
  readonly setSessionRemoveOpen: (open: boolean) => void
  readonly sessionRemoveTarget: CastingSession | null
  readonly setSessionRemoveTarget: (target: CastingSession | null) => void
  readonly deleteOpen: boolean
  readonly setDeleteOpen: (open: boolean) => void
  readonly createSessionOpen: boolean
  readonly setCreateSessionOpen: (open: boolean) => void
  readonly createSessionDate: string
  readonly setCreateSessionDate: (date: string) => void
  readonly createSessionTitle: string
  readonly setCreateSessionTitle: (title: string) => void
  readonly onConfirmRemoveHeadshot: () => Promise<void>
  readonly onUpdateGallery: (
    next: TalentImage[],
    removedPaths: readonly (string | null | undefined)[],
    successLabel?: string,
  ) => Promise<void>
  readonly onUpdateCastingSessions: (
    next: CastingSession[],
    removedPaths: readonly (string | null | undefined)[],
    successLabel?: string,
  ) => Promise<void>
  readonly onCreateCastingSession: () => Promise<void>
  readonly onConfirmDeleteTalent: () => void
}

export function TalentDialogCluster({
  busy,
  selected,
  clientId,
  talentId,
  projectIds,
  portfolioImages,
  castingSessions,
  projectLookup,
  printSession,
  printSessionId,
  setPrintSessionId,
  headshotRemoveOpen,
  setHeadshotRemoveOpen,
  galleryRemoveOpen,
  setGalleryRemoveOpen,
  galleryRemoveTarget,
  setGalleryRemoveTarget,
  sessionRemoveOpen,
  setSessionRemoveOpen,
  sessionRemoveTarget,
  setSessionRemoveTarget,
  deleteOpen,
  setDeleteOpen,
  createSessionOpen,
  setCreateSessionOpen,
  createSessionDate,
  setCreateSessionDate,
  createSessionTitle,
  setCreateSessionTitle,
  onConfirmRemoveHeadshot,
  onUpdateGallery,
  onUpdateCastingSessions,
  onCreateCastingSession,
  onConfirmDeleteTalent,
}: TalentDialogClusterProps) {
  return (
    <>
      <ConfirmDialog
        open={headshotRemoveOpen}
        onOpenChange={setHeadshotRemoveOpen}
        title="Remove headshot?"
        description="This removes the headshot from this talent profile."
        confirmLabel={busy ? "Removing..." : "Remove"}
        destructive
        confirmDisabled={busy}
        onConfirm={() => {
          void onConfirmRemoveHeadshot()
        }}
      />

      <ConfirmDialog
        open={galleryRemoveOpen}
        onOpenChange={setGalleryRemoveOpen}
        title="Remove image?"
        description="This removes the image from this profile."
        confirmLabel={busy ? "Removing..." : "Remove"}
        destructive
        confirmDisabled={busy}
        onConfirm={() => {
          if (!galleryRemoveTarget || !selected) return
          const inPortfolio = portfolioImages.some((i) => i.id === galleryRemoveTarget.id)
          if (inPortfolio) {
            const next = portfolioImages.filter((i) => i.id !== galleryRemoveTarget.id)
            void onUpdateGallery(next, [galleryRemoveTarget.path], "Image removed")
            setGalleryRemoveTarget(null)
            return
          }

          const session = castingSessions.find((s) =>
            (s.images ?? []).some((i) => i.id === galleryRemoveTarget.id),
          )
          if (!session) return
          const nextSessions = castingSessions.map((s) => {
            if (s.id !== session.id) return s
            return { ...s, images: (s.images ?? []).filter((i) => i.id !== galleryRemoveTarget.id) }
          })
          void onUpdateCastingSessions(nextSessions, [galleryRemoveTarget.path], "Image removed")
          setGalleryRemoveTarget(null)
        }}
      />

      <ConfirmDialog
        open={sessionRemoveOpen}
        onOpenChange={setSessionRemoveOpen}
        title="Delete casting?"
        description="This deletes the casting session and all its images."
        confirmLabel={busy ? "Deleting..." : "Delete"}
        destructive
        confirmDisabled={busy}
        onConfirm={() => {
          if (!sessionRemoveTarget || !selected) return
          const removedPaths = (sessionRemoveTarget.images ?? []).map((i) => i.path)
          const nextSessions = castingSessions.filter((s) => s.id !== sessionRemoveTarget.id)
          void onUpdateCastingSessions(nextSessions, removedPaths, "Casting deleted")
          setSessionRemoveTarget(null)
        }}
      />

      <Dialog open={createSessionOpen} onOpenChange={setCreateSessionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add casting</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <div className="label-meta">
                Date
              </div>
              <Input
                type="date"
                value={createSessionDate}
                onChange={(e) => setCreateSessionDate(e.target.value)}
                disabled={busy}
                aria-label="Casting date"
              />
            </div>
            <div>
              <div className="label-meta">
                Title (optional)
              </div>
              <Input
                value={createSessionTitle}
                onChange={(e) => setCreateSessionTitle(e.target.value)}
                placeholder="e.g. Jan 30 casting"
                disabled={busy}
                aria-label="Casting title"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateSessionOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void onCreateCastingSession()} disabled={busy}>
              {busy ? "Saving..." : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteTalentDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        talentName={selected?.name ?? ""}
        clientId={clientId ?? ""}
        talentId={talentId}
        projectIds={projectIds}
        projectLookup={projectLookup}
        busy={busy}
        onConfirm={onConfirmDeleteTalent}
      />

      {selected && printSession ? (
        <TalentCastingPrintPortal
          open={Boolean(printSessionId)}
          onOpenChange={(open) => {
            if (!open) setPrintSessionId(null)
          }}
          talent={selected}
          session={printSession}
          projectName={
            printSession.projectId
              ? projectLookup.get(printSession.projectId) ?? printSession.projectId
              : null
          }
        />
      ) : null}
    </>
  )
}
