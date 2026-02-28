import { useState, useMemo, useEffect } from "react"
import { toast } from "sonner"
import { Info } from "lucide-react"
import { useAuth } from "@/app/providers/AuthProvider"
import { useProjects } from "@/features/projects/hooks/useProjects"
import { triageAbsorbRequest } from "@/features/requests/lib/requestWrites"
import { ResponsiveDialog } from "@/shared/components/ResponsiveDialog"
import { Button } from "@/ui/button"
import { Label } from "@/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import type { ShotRequest } from "@/shared/types"

interface AbsorbDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly request: ShotRequest
}

export function AbsorbDialog({ open, onOpenChange, request }: AbsorbDialogProps) {
  const { user, clientId } = useAuth()
  const { data: projects } = useProjects()
  const [selectedProjectId, setSelectedProjectId] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) {
      setSelectedProjectId("")
      setSaving(false)
    }
  }, [open])

  const activeProjects = useMemo(
    () => projects.filter((p) => p.status === "active"),
    [projects],
  )

  const selectedProject = useMemo(
    () => activeProjects.find((p) => p.id === selectedProjectId) ?? null,
    [activeProjects, selectedProjectId],
  )

  const canSubmit = selectedProjectId.length > 0 && !saving

  const handleSubmit = async () => {
    if (!clientId || !user || !selectedProjectId) return

    setSaving(true)
    try {
      await triageAbsorbRequest({
        requestId: request.id,
        clientId,
        projectId: selectedProjectId,
        triagedBy: user.uid,
      })
      const projectName = selectedProject?.name ?? "project"
      toast.success(`Request absorbed into ${projectName}`)
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Absorb Request"
      description="Create a new shot from this request and add it to a project."
      contentClassName="sm:max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="bg-[var(--color-status-green-text)] hover:bg-[var(--color-status-green-text)]/90 text-white"
          >
            {saving ? "Absorbing..." : "Absorb Request"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 py-4">
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3">
          <p className="text-sm font-medium text-[var(--color-text)]">{request.title}</p>
          <p className="text-xs text-[var(--color-text-muted)]">
            by {request.submittedByName ?? "Unknown"}
            {request.priority === "urgent" && (
              <span className="ml-2 text-[var(--color-error)]">Urgent</span>
            )}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Target Project</Label>
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a project..." />
            </SelectTrigger>
            <SelectContent>
              {activeProjects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {activeProjects.length === 0 && (
            <p className="text-xs text-[var(--color-text-muted)]">
              No active projects available.
            </p>
          )}
        </div>

        <div className="flex items-start gap-2 rounded-md bg-[var(--color-surface-subtle)] p-2.5">
          <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[var(--color-text-muted)]" />
          <p className="text-xs text-[var(--color-text-muted)]">
            A new shot will be created in the selected project with this request's title and description.
          </p>
        </div>
      </div>
    </ResponsiveDialog>
  )
}
