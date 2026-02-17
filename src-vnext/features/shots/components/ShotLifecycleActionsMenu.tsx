import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { MoreHorizontal } from "lucide-react"
import { useAuth } from "@/app/providers/AuthProvider"
import {
  copyShotToProject,
  duplicateShotInProject,
  moveShotToProject,
  softDeleteShot,
} from "@/features/shots/lib/shotLifecycleActions"
import type { Project, Shot } from "@/shared/types"
import { toast } from "sonner"
import { Button } from "@/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog"
import { Input } from "@/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"

interface ShotLifecycleActionsMenuProps {
  readonly shot: Shot
  readonly projects: ReadonlyArray<Project>
  readonly existingTitles: ReadonlySet<string>
  readonly disabled?: boolean
}

type TransferMode = "copy" | "move"

export function ShotLifecycleActionsMenu({
  shot,
  projects,
  existingTitles,
  disabled = false,
}: ShotLifecycleActionsMenuProps) {
  const navigate = useNavigate()
  const { clientId, user } = useAuth()

  const [busyAction, setBusyAction] = useState<
    "duplicate" | "copy" | "move" | "delete" | null
  >(null)

  const [transferMode, setTransferMode] = useState<TransferMode>("copy")
  const [transferOpen, setTransferOpen] = useState(false)
  const [targetProjectId, setTargetProjectId] = useState("")

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteText, setDeleteText] = useState("")

  const targetProjects = useMemo(() => {
    return projects.filter(
      (project) =>
        project.id !== shot.projectId &&
        project.status !== "archived" &&
        !project.deletedAt,
    )
  }, [projects, shot.projectId])

  const targetProjectName = useMemo(() => {
    return projects.find((project) => project.id === targetProjectId)?.name ?? "project"
  }, [projects, targetProjectId])

  const openTransfer = (mode: TransferMode) => {
    setTransferMode(mode)
    setTargetProjectId("")
    setTransferOpen(true)
  }

  const handleDuplicate = async () => {
    if (!clientId || disabled || busyAction) return
    setBusyAction("duplicate")
    try {
      const result = await duplicateShotInProject({
        clientId,
        shot,
        user,
        existingTitles,
      })
      toast.success("Shot duplicated", {
        description: result.title,
        action: {
          label: "Open",
          onClick: () => {
            navigate(`/projects/${shot.projectId}/shots/${result.shotId}`)
          },
        },
      })
    } catch (err) {
      toast.error("Failed to duplicate shot", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setBusyAction(null)
    }
  }

  const handleConfirmTransfer = async () => {
    if (!clientId || !targetProjectId || busyAction || disabled) return
    const action = transferMode
    setBusyAction(action)
    try {
      if (transferMode === "copy") {
        const result = await copyShotToProject({
          clientId,
          shot,
          targetProjectId,
          user,
        })
        toast.success("Shot copied", {
          description: `Copied to ${targetProjectName}.`,
          action: {
            label: "Open copy",
            onClick: () => {
              navigate(`/projects/${targetProjectId}/shots/${result.shotId}`)
            },
          },
        })
      } else {
        await moveShotToProject({
          clientId,
          shotId: shot.id,
          targetProjectId,
          user,
        })
        toast.success("Shot moved", {
          description: `Moved to ${targetProjectName}.`,
        })
        navigate(`/projects/${targetProjectId}/shots/${shot.id}`)
      }
      setTransferOpen(false)
    } catch (err) {
      toast.error(
        transferMode === "copy" ? "Failed to copy shot" : "Failed to move shot",
        {
          description: err instanceof Error ? err.message : "Unknown error",
        },
      )
    } finally {
      setBusyAction(null)
    }
  }

  const handleDelete = async () => {
    if (!clientId || disabled || busyAction) return
    if (deleteText.trim() !== "DELETE") return
    setBusyAction("delete")
    try {
      await softDeleteShot({
        clientId,
        shotId: shot.id,
        user,
      })
      toast.success("Shot deleted", {
        description: "Removed from this project's active shot list.",
      })
      navigate(`/projects/${shot.projectId}/shots`)
    } catch (err) {
      toast.error("Failed to delete shot", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setBusyAction(null)
      setDeleteText("")
      setDeleteOpen(false)
    }
  }

  const transferDisabled = disabled || busyAction !== null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            aria-label="Shot actions"
            disabled={disabled || busyAction !== null}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault()
              void handleDuplicate()
            }}
            disabled={disabled || busyAction !== null}
          >
            Duplicate in project
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault()
              openTransfer("copy")
            }}
            disabled={transferDisabled || targetProjects.length === 0}
          >
            Copy to another project…
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault()
              openTransfer("move")
            }}
            disabled={transferDisabled || targetProjects.length === 0}
          >
            Move to another project…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-[var(--color-error)] focus:text-[var(--color-error)]"
            onSelect={(event) => {
              event.preventDefault()
              setDeleteText("")
              setDeleteOpen(true)
            }}
            disabled={disabled || busyAction !== null}
          >
            Delete shot…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {transferMode === "copy" ? "Copy shot to project" : "Move shot to project"}
            </DialogTitle>
            <DialogDescription>
              {transferMode === "copy"
                ? "A new shot will be created in the target project. Shot number is reset to avoid collisions."
                : "The existing shot will move to the target project and be removed from this project's shot list."}
            </DialogDescription>
          </DialogHeader>

          {targetProjects.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              No eligible destination projects are available.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
                Destination project
              </p>
              <Select value={targetProjectId} onValueChange={setTargetProjectId} disabled={transferDisabled}>
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
            <Button variant="outline" onClick={() => setTransferOpen(false)} disabled={transferDisabled}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                void handleConfirmTransfer()
              }}
              disabled={transferDisabled || !targetProjectId || targetProjects.length === 0}
            >
              {busyAction === transferMode
                ? transferMode === "copy"
                  ? "Copying…"
                  : "Moving…"
                : transferMode === "copy"
                  ? "Copy shot"
                  : "Move shot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete shot?</DialogTitle>
            <DialogDescription>
              This hides the shot from active project lists and schedules. Type <strong>DELETE</strong> to confirm.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <p className="text-xs text-[var(--color-text-subtle)]">
              Shot: {shot.title || "Untitled Shot"}
            </p>
            <Input
              value={deleteText}
              onChange={(event) => setDeleteText(event.target.value)}
              placeholder="Type DELETE"
              disabled={disabled || busyAction !== null}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteOpen(false)
                setDeleteText("")
              }}
              disabled={disabled || busyAction !== null}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                void handleDelete()
              }}
              disabled={disabled || busyAction !== null || deleteText.trim() !== "DELETE"}
            >
              {busyAction === "delete" ? "Deleting…" : "Delete shot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
