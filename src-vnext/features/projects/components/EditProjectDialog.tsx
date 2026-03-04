import { useEffect, useMemo, useRef, useState } from "react"
import { useAuth } from "@/app/providers/AuthProvider"
import type { Project, ProjectStatus, ProjectVisibility } from "@/shared/types"
import { updateProjectField } from "@/features/projects/lib/updateProject"
import { canManageProjects } from "@/shared/lib/rbac"
import { deleteField } from "firebase/firestore"
import {
  projectNameSchema,
  optionalUrlSchema,
  optionalNotesSchema,
  validateField,
} from "@/shared/lib/validation"
import { ResponsiveDialog } from "@/shared/components/ResponsiveDialog"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Textarea } from "@/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/ui/radio-group"
import { ShootDatesField } from "@/features/projects/components/ShootDatesField"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import { ChevronDown } from "lucide-react"
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

const VISIBILITY_OPTIONS: ReadonlyArray<{
  readonly value: ProjectVisibility
  readonly label: string
  readonly description: string
}> = [
  {
    value: "team",
    label: "Team",
    description: "All producers in your organization can access this project.",
  },
  {
    value: "restricted",
    label: "Restricted",
    description: "Only members explicitly added to this project can access it.",
  },
  {
    value: "private",
    label: "Private",
    description: "Only you and admins can see this project.",
  },
]

export function EditProjectDialog({
  open,
  onOpenChange,
  project,
}: EditProjectDialogProps) {
  const { clientId, role } = useAuth()
  const showVisibility = canManageProjects(role)

  const [name, setName] = useState("")
  const [shootDates, setShootDates] = useState<string[]>([])
  const [briefUrl, setBriefUrl] = useState("")
  const [notes, setNotes] = useState("")
  const [status, setStatus] = useState<ProjectStatus>("active")
  const [visibility, setVisibility] = useState<ProjectVisibility>("team")
  const [expanded, setExpanded] = useState(false)

  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({})

  // Track previous open state to initialize form only on open transition.
  // `project` is excluded from deps because it's a live onSnapshot reference
  // that creates new objects on each Firestore update, which would reset
  // local form state mid-edit.
  const wasOpen = useRef(false)
  useEffect(() => {
    if (open && !wasOpen.current && project) {
      setName(project.name ?? "")
      setShootDates(project.shootDates ? [...project.shootDates] : [])
      setBriefUrl(project.briefUrl ?? "")
      setNotes(project.notes ?? "")
      setStatus(project.status ?? "active")
      setVisibility(project.visibility ?? "team")
      setFieldErrors({})

      const hasOptionalData = !!project.briefUrl || !!project.notes
      setExpanded(!!hasOptionalData)
    }
    wasOpen.current = open
  }, [open, project])

  const canSave = useMemo(() => {
    return !!project && !!clientId && name.trim().length > 0 && !saving
  }, [clientId, name, project, saving])

  const validate = (): boolean => {
    const errors: Record<string, string | null> = {
      name: validateField(projectNameSchema, name),
      briefUrl: validateField(optionalUrlSchema, briefUrl),
      notes: validateField(optionalNotesSchema, notes),
    }
    setFieldErrors(errors)

    const hasUrlOrNotesError = errors.briefUrl || errors.notes
    if (hasUrlOrNotesError && !expanded) {
      setExpanded(true)
    }

    return !errors.name && !errors.briefUrl && !errors.notes
  }

  const handleSave = async () => {
    if (!project || !clientId) return
    if (!validate()) return

    const trimmedName = name.trim()
    const brief = briefUrl.trim()

    setSaving(true)

    try {
      await updateProjectField(project.id, clientId, {
        name: trimmedName,
        status,
        visibility,
        shootDates: [...shootDates].sort(),
        briefUrl: brief || deleteField(),
        notes: notes.trim() || deleteField(),
      })
      toast.success("Project updated")
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update project"
      toast.error("Failed to update project", { description: message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Project"
      contentClassName="sm:max-w-xl"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 py-4">
        {/* Name — always visible */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-project-name">Project Name</Label>
          <Input
            id="edit-project-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (fieldErrors.name) {
                setFieldErrors((prev) => ({ ...prev, name: null }))
              }
            }}
            disabled={saving}
            autoFocus
          />
          {fieldErrors.name && (
            <p className="text-xs text-[var(--color-error)]">{fieldErrors.name}</p>
          )}
        </div>

        {/* Status — always visible */}
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

        {/* Shoot Dates — always visible */}
        <div className="flex flex-col gap-2">
          <Label>Shoot Dates</Label>
          <ShootDatesField value={shootDates} onChange={setShootDates} disabled={saving} />
        </div>

        {/* More options toggle */}
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
          data-testid="more-options-toggle"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          />
          More options
        </button>

        {/* Collapsible optional fields */}
        {expanded && (
          <div className="flex flex-col gap-4" data-testid="optional-fields">
            {/* Visibility — only shown to admin/producer */}
            {showVisibility && (
              <div className="flex flex-col gap-3" data-testid="visibility-field">
                <Label>Visibility</Label>
                <RadioGroup
                  value={visibility}
                  onValueChange={(v) => setVisibility(v as ProjectVisibility)}
                  disabled={saving}
                >
                  {VISIBILITY_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className="flex items-start gap-3 cursor-pointer"
                    >
                      <RadioGroupItem
                        value={opt.value}
                        id={`visibility-${opt.value}`}
                        className="mt-0.5"
                      />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium leading-none">
                          {opt.label}
                        </span>
                        <span className="text-xs text-[var(--color-text-muted)]">
                          {opt.description}
                        </span>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-project-brief-url">Brief URL</Label>
              <Input
                id="edit-project-brief-url"
                value={briefUrl}
                onChange={(e) => {
                  setBriefUrl(e.target.value)
                  if (fieldErrors.briefUrl) {
                    setFieldErrors((prev) => ({ ...prev, briefUrl: null }))
                  }
                }}
                placeholder="https://..."
                disabled={saving}
              />
              {fieldErrors.briefUrl && (
                <p className="text-xs text-[var(--color-error)]">{fieldErrors.briefUrl}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-project-notes">Notes</Label>
              <Textarea
                id="edit-project-notes"
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value)
                  if (fieldErrors.notes) {
                    setFieldErrors((prev) => ({ ...prev, notes: null }))
                  }
                }}
                placeholder="Optional context for the team..."
                rows={5}
                disabled={saving}
              />
              {fieldErrors.notes && (
                <p className="text-xs text-[var(--color-error)]">{fieldErrors.notes}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </ResponsiveDialog>
  )
}
