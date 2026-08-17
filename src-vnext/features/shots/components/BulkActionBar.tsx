import { useCallback, useMemo, useState } from "react"
import { collection, getDocs, query, where } from "firebase/firestore"
import { GitMerge, Layers, MapPin, Tag, Trash2, User } from "lucide-react"
import { toast } from "sonner"
import { db } from "@/shared/lib/firebase"
import { projectsPath, shotsPath } from "@/shared/lib/paths"
import { Button } from "@/ui/button"
import { Checkbox } from "@/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog"
import { StatusBadge } from "@/shared/components/StatusBadge"
import {
  SHOT_STATUSES,
} from "@/shared/lib/statusMappings"
import { canManageShots } from "@/shared/lib/rbac"
import { shotWriteErrorDescription } from "@/features/shots/lib/shotWriteError"
import { useAvailableTags } from "@/features/shots/hooks/useAvailableTags"
import { mapProject } from "@/features/projects/hooks/useProjects"
import { filterEligibleTransferTargets } from "@/features/projects/lib/transferTargets"
import {
  bulkUpdateShotStatus,
  bulkApplyTags,
  bulkUpdateLocation,
  bulkAddTalent,
} from "@/features/shots/lib/bulkShotUpdates"
import {
  BulkCopyPartialFailureError,
  bulkCopyShotsToProject,
  bulkMoveShotsToProject,
} from "@/features/shots/lib/shotLifecycleActions"
import type { AuthUser, Project, Role, Shot, ShotFirestoreStatus, ShotTag } from "@/shared/types"

type TransferMode = "copy" | "move"

interface BulkActionBarProps {
  readonly displayShots: ReadonlyArray<Shot>
  readonly selectedIds: ReadonlySet<string>
  readonly onSelectAll: () => void
  readonly onDeselectAll: () => void
  readonly clientId: string | null
  readonly user: AuthUser | null
  readonly role: Role
  // Handlers for existing actions
  readonly onShareOpen: () => void
  readonly onExportClick: () => void
  readonly onCreatePullOpen: () => void
  readonly onBulkDeleteOpen: () => void
  readonly onClearSelection: () => void
  readonly onGroupSceneOpen?: () => void
  readonly onMergeOpen?: () => void
  // Flags
  readonly canShare: boolean
  readonly canExport: boolean
  // Location + talent data
  readonly locations: ReadonlyArray<{ readonly id: string; readonly name: string }>
  readonly talent: ReadonlyArray<{ readonly id: string; readonly name: string }>
  // Cross-project bulk Copy/Move — same GLOBAL-claim gate as
  // ShotLifecycleActionsMenu's canTransferAcrossProjects. currentProjectId
  // excludes the current project from the destination picker.
  readonly canTransferAcrossProjects?: boolean
  readonly currentProjectId?: string
}

export function BulkActionBar({
  displayShots,
  selectedIds,
  onSelectAll,
  onDeselectAll,
  clientId,
  user,
  role,
  onShareOpen,
  onExportClick,
  onCreatePullOpen,
  onBulkDeleteOpen,
  onClearSelection,
  onGroupSceneOpen,
  onMergeOpen,
  canShare,
  canExport,
  locations,
  talent,
  canTransferAcrossProjects = false,
  currentProjectId = "",
}: BulkActionBarProps) {
  const selectedShots = useMemo(
    () => displayShots.filter((s) => selectedIds.has(s.id)),
    [displayShots, selectedIds],
  )
  const allSelected = displayShots.length > 0 && displayShots.every((s) => selectedIds.has(s.id))
  const someSelected = selectedIds.size > 0

  const { tags } = useAvailableTags()
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false)
  const [locationPopoverOpen, setLocationPopoverOpen] = useState(false)
  const [talentPopoverOpen, setTalentPopoverOpen] = useState(false)

  // -- Cross-project bulk Copy/Move --
  const [transferMode, setTransferMode] = useState<TransferMode>("copy")
  const [transferOpen, setTransferOpen] = useState(false)
  const [targetProjectId, setTargetProjectId] = useState("")
  const [transferBusy, setTransferBusy] = useState(false)
  const [projects, setProjects] = useState<ReadonlyArray<Project>>([])
  const [projectsLoaded, setProjectsLoaded] = useState(false)
  const [projectsLoading, setProjectsLoading] = useState(false)

  const ensureProjects = useCallback(async () => {
    if (!clientId || projectsLoaded || projectsLoading) return
    setProjectsLoading(true)
    try {
      const segs = projectsPath(clientId)
      const snap = await getDocs(collection(db, segs[0]!, ...segs.slice(1)))
      setProjects(snap.docs.map((d) => mapProject(d.id, d.data())))
      setProjectsLoaded(true)
    } catch (err) {
      console.error("[BulkActionBar] failed to load projects", err)
      toast.error("Couldn't load projects")
    } finally {
      setProjectsLoading(false)
    }
  }, [clientId, projectsLoaded, projectsLoading])

  const targetProjects = useMemo(
    () => filterEligibleTransferTargets(projects, currentProjectId),
    [projects, currentProjectId],
  )

  const targetProjectName = useMemo(
    () => projects.find((p) => p.id === targetProjectId)?.name ?? "project",
    [projects, targetProjectId],
  )

  const openTransfer = (mode: TransferMode) => {
    setTransferMode(mode)
    setTargetProjectId("")
    setTransferOpen(true)
    void ensureProjects()
  }

  const handleConfirmTransfer = async () => {
    if (!clientId || !targetProjectId || transferBusy || selectedShots.length === 0) return
    setTransferBusy(true)
    try {
      if (transferMode === "copy") {
        const shotsSegs = shotsPath(clientId)
        const titlesSnap = await getDocs(
          query(
            collection(db, shotsSegs[0]!, ...shotsSegs.slice(1)),
            where("projectId", "==", targetProjectId),
            where("deleted", "==", false),
          ),
        )
        const targetTitles = new Set<string>()
        for (const d of titlesSnap.docs) {
          const title = (d.data()["title"] as string | undefined)?.trim()
          if (title) targetTitles.add(title)
        }
        const { copiedCount } = await bulkCopyShotsToProject({
          clientId,
          shots: selectedShots,
          targetProjectId,
          targetTitles,
          createdByUid: user?.uid ?? null,
        })
        toast.success(`Copied ${copiedCount} shot${copiedCount === 1 ? "" : "s"}`, {
          description: `Copied to ${targetProjectName}.`,
        })
      } else {
        const { movedCount } = await bulkMoveShotsToProject({
          clientId,
          shots: selectedShots,
          targetProjectId,
          user,
        })
        toast.success(`Moved ${movedCount} shot${movedCount === 1 ? "" : "s"}`, {
          description: `Moved to ${targetProjectName}.`,
        })
      }
      setTransferOpen(false)
      onClearSelection()
    } catch (err) {
      // Partial failure (some shots landed before a chunk failed): name the
      // count and leave the selection intact — the user still needs it to
      // retry the shots that didn't make it. Any other error: generic
      // failure toast, selection also left intact (nothing copied/moved).
      if (err instanceof BulkCopyPartialFailureError) {
        toast.error("Copy stopped partway", { description: err.message })
      } else {
        toast.error(transferMode === "copy" ? "Failed to copy shots" : "Failed to move shots", {
          description: err instanceof Error ? err.message : "Unknown error",
        })
      }
    } finally {
      setTransferBusy(false)
    }
  }

  const handleBulkStatus = async (status: ShotFirestoreStatus) => {
    if (!clientId || selectedIds.size === 0) return
    try {
      const count = await bulkUpdateShotStatus(clientId, Array.from(selectedIds), status, user)
      toast.success(`Updated status on ${count} shot${count === 1 ? "" : "s"}`)
    } catch (err) {
      toast.error("Failed to update status", {
        description: shotWriteErrorDescription(err, err instanceof Error ? err.message : "Unknown error"),
      })
    }
  }

  const handleApplyTag = async (tag: ShotTag) => {
    if (!clientId || selectedShots.length === 0) return
    try {
      const count = await bulkApplyTags(clientId, selectedShots, [tag], user)
      toast.success(`Applied "${tag.label}" to ${count} shot${count === 1 ? "" : "s"}`)
      setTagPopoverOpen(false)
    } catch (err) {
      toast.error("Failed to apply tag", {
        description: shotWriteErrorDescription(err, err instanceof Error ? err.message : "Unknown error"),
      })
    }
  }

  const handleSetLocation = async (locationId: string, locationName: string) => {
    if (!clientId || selectedIds.size === 0) return
    try {
      const count = await bulkUpdateLocation(clientId, Array.from(selectedIds), locationId, locationName, user)
      toast.success(`Set location on ${count} shot${count === 1 ? "" : "s"}`)
      setLocationPopoverOpen(false)
    } catch (err) {
      toast.error("Failed to set location", {
        description: shotWriteErrorDescription(err, err instanceof Error ? err.message : "Unknown error"),
      })
    }
  }

  const handleAddTalent = async (talentId: string) => {
    if (!clientId || selectedShots.length === 0) return
    try {
      const count = await bulkAddTalent(clientId, selectedShots, [talentId], user)
      toast.success(`Added talent to ${count} shot${count === 1 ? "" : "s"}`)
      setTalentPopoverOpen(false)
    } catch (err) {
      toast.error("Failed to add talent", {
        description: shotWriteErrorDescription(err, err instanceof Error ? err.message : "Unknown error"),
      })
    }
  }

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
      {/* Left: selection controls */}
      <div className="flex items-center gap-3">
        <Checkbox
          checked={allSelected ? true : someSelected ? "indeterminate" : false}
          onCheckedChange={(v) => { v ? onSelectAll() : onDeselectAll() }}
          aria-label={allSelected ? "Deselect all shots" : "Select all visible shots"}
        />
        <span className="text-xs text-[var(--color-text-muted)]">
          {selectedIds.size} selected
          {selectedIds.size < displayShots.length && (
            <button
              type="button"
              className="ml-1.5 text-[var(--color-primary)] hover:underline"
              onClick={onSelectAll}
            >
              Select all {displayShots.length}
            </button>
          )}
        </span>
      </div>

      {/* Right: actions */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Batch status */}
        <Select
          value=""
          onValueChange={(v) => handleBulkStatus(v as ShotFirestoreStatus)}
          disabled={selectedIds.size === 0}
        >
          <SelectTrigger className="h-8 w-[120px] text-xs">
            <SelectValue placeholder="Set status" />
          </SelectTrigger>
          <SelectContent>
            {SHOT_STATUSES.map((s) => (
              <SelectItem key={s.firestoreValue} value={s.firestoreValue}>
                <StatusBadge label={s.label} color={s.color} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Batch tags */}
        <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" disabled={selectedIds.size === 0}>
              <Tag className="mr-1.5 h-3.5 w-3.5" />
              Tags
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0" align="start">
            <Command>
              <CommandInput placeholder="Search tags..." />
              <CommandList>
                <CommandEmpty>No tags found.</CommandEmpty>
                <CommandGroup>
                  {tags.map((tag) => (
                    <CommandItem
                      key={tag.id}
                      onSelect={() => handleApplyTag(tag)}
                    >
                      <span
                        className="mr-2 h-2 w-2 rounded-full"
                        style={{ backgroundColor: tag.color ?? "var(--color-text-subtle)" }}
                      />
                      {tag.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Batch location */}
        <Popover open={locationPopoverOpen} onOpenChange={setLocationPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" disabled={selectedIds.size === 0}>
              <MapPin className="mr-1.5 h-3.5 w-3.5" />
              Location
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0" align="start">
            <Command>
              <CommandInput placeholder="Search locations..." />
              <CommandList>
                <CommandEmpty>No locations found.</CommandEmpty>
                <CommandGroup>
                  {locations.map((loc) => (
                    <CommandItem
                      key={loc.id}
                      onSelect={() => handleSetLocation(loc.id, loc.name)}
                    >
                      {loc.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Batch talent */}
        <Popover open={talentPopoverOpen} onOpenChange={setTalentPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" disabled={selectedIds.size === 0}>
              <User className="mr-1.5 h-3.5 w-3.5" />
              Talent
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0" align="start">
            <Command>
              <CommandInput placeholder="Search talent..." />
              <CommandList>
                <CommandEmpty>No talent found.</CommandEmpty>
                <CommandGroup>
                  {talent.map((t) => (
                    <CommandItem
                      key={t.id}
                      onSelect={() => handleAddTalent(t.id)}
                    >
                      {t.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Divider */}
        <div className="h-5 w-px bg-[var(--color-border)]" />

        {/* Existing actions */}
        {canShare && (
          <Button
            variant="outline"
            size="sm"
            disabled={selectedIds.size === 0}
            onClick={onShareOpen}
          >
            Share link
          </Button>
        )}
        {canExport && (
          <Button variant="outline" size="sm" onClick={onExportClick}>
            Export PDF
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onClearSelection}>
          Clear
        </Button>
        <Button
          size="sm"
          disabled={selectedIds.size === 0}
          onClick={onCreatePullOpen}
        >
          Create pull sheet
        </Button>
        {/* Cross-project bulk Copy/Move — GLOBAL-claim gated (same shape as
            ShotLifecycleActionsMenu's Transfer/Copy split). */}
        {canTransferAcrossProjects && (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={selectedIds.size === 0}
              onClick={() => openTransfer("copy")}
            >
              Copy to project…
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={selectedIds.size === 0}
              onClick={() => openTransfer("move")}
            >
              Move to project…
            </Button>
          </>
        )}
        {onGroupSceneOpen && canManageShots(role) && (
          <Button
            variant="default"
            size="sm"
            disabled={selectedIds.size === 0}
            onClick={onGroupSceneOpen}
          >
            <Layers className="mr-1.5 h-3.5 w-3.5" />
            Set Scene
          </Button>
        )}
        {onMergeOpen && canManageShots(role) && (
          <Button
            variant="outline"
            size="sm"
            disabled={selectedIds.size !== 2}
            onClick={onMergeOpen}
          >
            <GitMerge className="mr-1.5 h-3.5 w-3.5" />
            Merge
          </Button>
        )}
        {canManageShots(role) && (
          <Button
            variant="destructive"
            size="sm"
            disabled={selectedIds.size === 0}
            onClick={onBulkDeleteOpen}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Delete
          </Button>
        )}
      </div>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {transferMode === "copy" ? "Copy shots to project" : "Move shots to project"}
            </DialogTitle>
            <DialogDescription>
              {targetProjectId
                ? `${transferMode === "copy" ? "Copy" : "Move"} ${selectedShots.length} shot${selectedShots.length === 1 ? "" : "s"} to «${targetProjectName}»?`
                : transferMode === "copy"
                  ? "New shots will be created in the target project. Shot numbers are reset to avoid collisions."
                  : "The selected shots will move to the target project and be removed from this project's shot list."}
            </DialogDescription>
          </DialogHeader>

          {projectsLoading ? (
            <p className="text-sm text-[var(--color-text-muted)]">Loading projects…</p>
          ) : targetProjects.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              No eligible destination projects are available.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
                Destination project
              </p>
              <Select value={targetProjectId} onValueChange={setTargetProjectId} disabled={transferBusy}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {targetProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)} disabled={transferBusy}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                void handleConfirmTransfer()
              }}
              disabled={transferBusy || !targetProjectId || targetProjects.length === 0}
            >
              {transferBusy
                ? transferMode === "copy"
                  ? "Copying…"
                  : "Moving…"
                : transferMode === "copy"
                  ? "Copy shots"
                  : "Move shots"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
