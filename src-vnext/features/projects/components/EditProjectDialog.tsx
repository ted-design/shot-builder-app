import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/app/providers/AuthProvider"
import type { Project, ProjectStatus } from "@/shared/types"
import { updateProjectField } from "@/features/projects/lib/updateProject"
import { deleteField } from "firebase/firestore"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Textarea } from "@/ui/textarea"
import { ShootDatesField } from "@/features/projects/components/ShootDatesField"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import { toast } from "sonner"

interface EditProjectDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly project: Project | null
}

const STATUS_OPTIONS: ReadonlyArray<{ readonly value: ProjectStatus; readonly label: string }> = [
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
]

export function EditProjectDialog({
  open,
  onOpenChange,
  project,
}: EditProjectDialogProps) {
  const { clientId } = useAuth()

  const [name, setName] = useState("")
  const [shootDates, setShootDates] = useState<string[]>([])
  const [briefUrl, setBriefUrl] = useState("")
  const [notes, setNotes] = useState("")
  const [status, setStatus] = useState<ProjectStatus>("active")

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (!project) return
    setName(project.name ?? "")
    setShootDates(project.shootDates ? [...project.shootDates] : [])
    setBriefUrl(project.briefUrl ?? "")
    setNotes(project.notes ?? "")
    setStatus(project.status ?? "active")
    setError(null)
  }, [open, project])

  const canSave = useMemo(() => {
    return !!project && !!clientId && name.trim().length > 0 && !saving
  }, [clientId, name, project, saving])

  const handleSave = async () => {
    if (!project || !clientId) return

    const trimmedName = name.trim()
    if (!trimmedName) return

    const brief = briefUrl.trim()
    if (brief.length > 0) {
      try {
        const parsed = new URL(brief)
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          setError("Brief URL must start with http:// or https://")
          return
        }
      } catch {
        setError("Brief URL must be a valid URL (include https://)")
        return
      }
    }

    setSaving(true)
    setError(null)

    try {
      await updateProjectField(project.id, clientId, {
        name: trimmedName,
        status,
        shootDates: [...shootDates].sort(),
        briefUrl: brief || deleteField(),
        notes: notes.trim() || deleteField(),
      })
      toast.success("Project updated")
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update project"
      setError(message)
      toast.error("Failed to update project", { description: message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-project-name">Project Name</Label>
            <Input
              id="edit-project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as ProjectStatus)}
              disabled={saving}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-[var(--color-text-muted)]">
              Archived projects are hidden by default on the dashboard.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Shoot Dates</Label>
            <ShootDatesField value={shootDates} onChange={setShootDates} disabled={saving} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-project-brief-url">Brief URL</Label>
            <Input
              id="edit-project-brief-url"
              value={briefUrl}
              onChange={(e) => setBriefUrl(e.target.value)}
              placeholder="https://…"
              disabled={saving}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-project-notes">Notes</Label>
            <Textarea
              id="edit-project-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional context for the team…"
              rows={5}
              disabled={saving}
            />
          </div>

          {error && (
            <p className="text-sm text-[var(--color-error)]">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
