import { useState, useMemo, useEffect } from "react"
import { toast } from "sonner"
import { Info } from "lucide-react"
import { useAuth } from "@/app/providers/AuthProvider"
import { useProjects } from "@/features/projects/hooks/useProjects"
import { ShootDatesField } from "@/features/projects/components/ShootDatesField"
import {
  triageAbsorbRequest,
  createProjectFromRequest,
} from "@/features/requests/lib/requestWrites"
import { projectNameSchema, validateField } from "@/shared/lib/validation"
import { ResponsiveDialog } from "@/shared/components/ResponsiveDialog"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/ui/tabs"
import type { ShotRequest } from "@/shared/types"

interface AbsorbDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly request: ShotRequest
}

export function AbsorbDialog({ open, onOpenChange, request }: AbsorbDialogProps) {
  const { user, clientId } = useAuth()
  const { data: projects } = useProjects()
  const [mode, setMode] = useState<"existing" | "create">("existing")
  const [selectedProjectId, setSelectedProjectId] = useState("")
  const [projectName, setProjectName] = useState("")
  const [shootDates, setShootDates] = useState<string[]>([])
  const [nameError, setNameError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) {
      setMode("existing")
      setSelectedProjectId("")
      setProjectName("")
      setShootDates([])
      setNameError(null)
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

  const canSubmit = mode === "existing"
    ? selectedProjectId.length > 0 && !saving
    : projectName.trim().length > 0 && !saving

  const handleModeChange = (value: string) => {
    const newMode = value as "existing" | "create"
    setMode(newMode)
    if (newMode === "create") {
      setSelectedProjectId("")
      setNameError(null)
    } else {
      setProjectName("")
      setShootDates([])
      setNameError(null)
    }
  }

  const handleSubmit = async () => {
    if (!clientId || !user) return

    if (mode === "existing") {
      if (!selectedProjectId) return
      setSaving(true)
      try {
        await triageAbsorbRequest({
          requestId: request.id,
          clientId,
          projectId: selectedProjectId,
          triagedBy: user.uid,
        })
        const name = selectedProject?.name ?? "project"
        toast.success(`Request absorbed into ${name}`)
        onOpenChange(false)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        toast.error(message)
      } finally {
        setSaving(false)
      }
    } else {
      const error = validateField(projectNameSchema, projectName)
      if (error) {
        setNameError(error)
        return
      }
      setSaving(true)
      try {
        await createProjectFromRequest({
          clientId,
          requestId: request.id,
          projectName: projectName.trim(),
          shootDates,
          createdBy: user.uid,
        })
        toast.success("Project created from request")
        onOpenChange(false)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        toast.error(message)
      } finally {
        setSaving(false)
      }
    }
  }

  const description = mode === "existing"
    ? "Create a new shot from this request and add it to a project."
    : "Create a new project and shot from this request."

  const buttonLabel = saving
    ? (mode === "existing" ? "Absorbing..." : "Creating...")
    : (mode === "existing" ? "Absorb Request" : "Create Project")

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Absorb Request"
      description={description}
      contentClassName="sm:max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={mode === "existing"
              ? "bg-[var(--color-status-green-text)] text-white hover:opacity-90"
              : undefined}
          >
            {buttonLabel}
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

        <Tabs value={mode} onValueChange={handleModeChange}>
          <TabsList className="w-full">
            <TabsTrigger value="existing" className="flex-1">Existing Project</TabsTrigger>
            <TabsTrigger value="create" className="flex-1">New Project</TabsTrigger>
          </TabsList>
          <TabsContent value="existing">
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
          </TabsContent>
          <TabsContent value="create">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-project-name">Project Name</Label>
                <Input
                  id="new-project-name"
                  value={projectName}
                  onChange={(e) => {
                    setProjectName(e.target.value)
                    if (nameError) setNameError(null)
                  }}
                  placeholder="e.g. Spring Campaign 2026"
                  autoFocus
                />
                {nameError && (
                  <p className="text-xs text-[var(--color-error)]">{nameError}</p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label>Shoot Dates</Label>
                <ShootDatesField
                  value={shootDates}
                  onChange={setShootDates}
                  disabled={saving}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

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
