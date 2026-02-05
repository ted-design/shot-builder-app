import { useState } from "react"
import { addDoc, collection, serverTimestamp } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { projectsPath } from "@/shared/lib/paths"
import { useAuth } from "@/app/providers/AuthProvider"
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
import { toast } from "sonner"

interface CreateProjectDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

export function CreateProjectDialog({
  open,
  onOpenChange,
}: CreateProjectDialogProps) {
  const { clientId } = useAuth()
  const [name, setName] = useState("")
  const [shootDates, setShootDates] = useState<string[]>([])
  const [briefUrl, setBriefUrl] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    const trimmed = name.trim()
    if (!trimmed || !clientId) return

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
      const path = projectsPath(clientId)
      await addDoc(collection(db, path[0]!, ...path.slice(1)), {
        name: trimmed,
        clientId,
        status: "active",
        shootDates,
        ...(brief ? { briefUrl: brief } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      setName("")
      setShootDates([])
      setBriefUrl("")
      setNotes("")
      onOpenChange(false)
      toast.success("Project created")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create project"
      setError(message)
      toast.error("Failed to create project", { description: message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Project</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="project-name">Project Name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Spring Campaign 2026"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Shoot Dates</Label>
            <ShootDatesField
              value={shootDates}
              onChange={setShootDates}
              disabled={saving}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="project-brief-url">Brief URL</Label>
            <Input
              id="project-brief-url"
              value={briefUrl}
              onChange={(e) => setBriefUrl(e.target.value)}
              placeholder="https://…"
              disabled={saving}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="project-notes">Notes</Label>
            <Textarea
              id="project-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional context for the team…"
              rows={4}
              disabled={saving}
            />
          </div>
          {error && (
            <p className="text-sm text-[var(--color-error)]">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || saving}>
            {saving ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
