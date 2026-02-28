import { useState } from "react"
import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { projectMembersPath, projectsPath } from "@/shared/lib/paths"
import { useAuth } from "@/app/providers/AuthProvider"
import { isAdmin } from "@/shared/lib/rbac"
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
import { ShootDatesField } from "@/features/projects/components/ShootDatesField"
import { ChevronDown } from "lucide-react"
import { toast } from "sonner"

interface CreateProjectDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

export function CreateProjectDialog({
  open,
  onOpenChange,
}: CreateProjectDialogProps) {
  const { clientId, user, role } = useAuth()
  const [name, setName] = useState("")
  const [shootDates, setShootDates] = useState<string[]>([])
  const [briefUrl, setBriefUrl] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({})

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

  const handleCreate = async () => {
    if (!validate()) return
    if (!clientId) return

    const trimmedName = name.trim()
    const brief = briefUrl.trim()

    setSaving(true)

    try {
      const path = projectsPath(clientId)
      const projectRef = doc(collection(db, path[0]!, ...path.slice(1)))
      const batch = writeBatch(db)

      batch.set(projectRef, {
        name: trimmedName,
        clientId,
        status: "active",
        shootDates,
        ...(brief ? { briefUrl: brief } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      // Auto-membership: non-admin creators get a member doc atomically
      if (!isAdmin(role) && user) {
        const memberPath = projectMembersPath(projectRef.id, clientId)
        const memberRef = doc(db, memberPath[0]!, ...memberPath.slice(1), user.uid)
        batch.set(memberRef, {
          role: "producer",
          addedAt: serverTimestamp(),
          addedBy: user.uid,
        })
      }

      await batch.commit()
      setName("")
      setShootDates([])
      setBriefUrl("")
      setNotes("")
      setFieldErrors({})
      setExpanded(false)
      onOpenChange(false)
      toast.success("Project created")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create project"
      toast.error("Failed to create project", { description: message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create Project"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || saving}>
            {saving ? "Creating..." : "Create"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 py-4">
        {/* Name — always visible */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="project-name">Project Name</Label>
          <Input
            id="project-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (fieldErrors.name) {
                setFieldErrors((prev) => ({ ...prev, name: null }))
              }
            }}
            placeholder="e.g. Spring Campaign 2026"
            autoFocus
            data-testid="project-name-input"
          />
          {fieldErrors.name && (
            <p className="text-xs text-[var(--color-error)]" data-testid="name-error">
              {fieldErrors.name}
            </p>
          )}
        </div>

        {/* Shoot Dates — always visible */}
        <div className="flex flex-col gap-2">
          <Label>Shoot Dates</Label>
          <ShootDatesField
            value={shootDates}
            onChange={setShootDates}
            disabled={saving}
          />
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
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-brief-url">Brief URL</Label>
              <Input
                id="project-brief-url"
                value={briefUrl}
                onChange={(e) => {
                  setBriefUrl(e.target.value)
                  if (fieldErrors.briefUrl) {
                    setFieldErrors((prev) => ({ ...prev, briefUrl: null }))
                  }
                }}
                placeholder="https://..."
                disabled={saving}
                data-testid="brief-url-input"
              />
              {fieldErrors.briefUrl && (
                <p className="text-xs text-[var(--color-error)]" data-testid="brief-url-error">
                  {fieldErrors.briefUrl}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-notes">Notes</Label>
              <Textarea
                id="project-notes"
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value)
                  if (fieldErrors.notes) {
                    setFieldErrors((prev) => ({ ...prev, notes: null }))
                  }
                }}
                placeholder="Optional context for the team..."
                rows={4}
                disabled={saving}
                data-testid="notes-input"
              />
              {fieldErrors.notes && (
                <p className="text-xs text-[var(--color-error)]" data-testid="notes-error">
                  {fieldErrors.notes}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </ResponsiveDialog>
  )
}
