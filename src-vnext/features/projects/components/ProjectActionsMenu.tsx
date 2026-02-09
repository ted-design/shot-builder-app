import { useMemo, useState } from "react"
import type { Project } from "@/shared/types"
import { useAuth } from "@/app/providers/AuthProvider"
import { canManageProjects } from "@/shared/lib/rbac"
import { updateProjectField, softDeleteProject } from "@/features/projects/lib/updateProject"
import { toast } from "sonner"
import { Button } from "@/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu"
import { ConfirmDialog } from "@/shared/components/ConfirmDialog"
import { MoreHorizontal } from "lucide-react"

interface ProjectActionsMenuProps {
  readonly project: Project
  readonly onEdit: () => void
}

export function ProjectActionsMenu({ project, onEdit }: ProjectActionsMenuProps) {
  const { role, clientId } = useAuth()
  const canManage = canManageProjects(role)
  const canDelete = canManage

  const [busy, setBusy] = useState(false)
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  const status = project.status ?? "active"

  const archiveCopy = useMemo(() => {
    if (status === "archived") {
      return {
        title: "Restore project?",
        description: "This project will return to the Active list.",
        confirmLabel: "Restore",
        nextStatus: "active" as const,
      }
    }
    return {
      title: "Archive project?",
      description: "This project will be hidden from the Active list. You can restore it later.",
      confirmLabel: "Archive",
      nextStatus: "archived" as const,
    }
  }, [status])

  const completeCopy = useMemo(() => {
    if (status === "completed") {
      return { label: "Reopen", nextStatus: "active" as const }
    }
    return { label: "Mark completed", nextStatus: "completed" as const }
  }, [status])

  const updateStatus = async (nextStatus: "active" | "completed" | "archived") => {
    if (!clientId) {
      toast.error("Missing clientId.")
      return
    }
    setBusy(true)
    try {
      await updateProjectField(project.id, clientId, { status: nextStatus })
      toast.success("Project updated")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update project"
      const description = message.includes("Missing or insufficient permissions")
        ? "You do not have permission to update this project."
        : message
      toast.error("Failed to update project", { description })
    } finally {
      setBusy(false)
    }
  }

  const deleteProject = async () => {
    if (!clientId) {
      toast.error("Missing clientId.")
      return
    }
    setBusy(true)
    try {
      await softDeleteProject(project.id, clientId)
      toast.success("Project deleted", { description: "It is now hidden from the dashboard." })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete project"
      const description = message.includes("Missing or insufficient permissions")
        ? "You do not have permission to delete this project."
        : message
      toast.error("Failed to delete project", { description })
    } finally {
      setBusy(false)
    }
  }

  if (!canManage) return null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Project actions"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            disabled={busy}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onSelect={() => {
              onEdit()
            }}
          >
            Edit details…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              if (status !== completeCopy.nextStatus) updateStatus(completeCopy.nextStatus)
            }}
            disabled={busy}
          >
            {completeCopy.label}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setConfirmArchiveOpen(true)
            }}
            disabled={busy}
          >
            {status === "archived" ? "Restore from archive" : "Archive"}
          </DropdownMenuItem>

          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-[var(--color-error)] focus:text-[var(--color-error)]"
                onSelect={() => setConfirmDeleteOpen(true)}
                disabled={busy}
              >
                Delete…
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmArchiveOpen}
        onOpenChange={setConfirmArchiveOpen}
        title={archiveCopy.title}
        description={archiveCopy.description}
        confirmLabel={archiveCopy.confirmLabel}
        destructive={status !== "archived"}
        confirmDisabled={busy}
        cancelDisabled={busy}
        onConfirm={() => updateStatus(archiveCopy.nextStatus)}
      />

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Delete project?"
        description="This will hide the project from the dashboard. This action cannot be undone from the UI."
        confirmLabel="Delete"
        destructive
        confirmDisabled={busy}
        cancelDisabled={busy}
        onConfirm={deleteProject}
      />
    </>
  )
}
