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
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    const trimmed = name.trim()
    if (!trimmed || !clientId) return

    setSaving(true)
    setError(null)

    try {
      const path = projectsPath(clientId)
      await addDoc(collection(db, path[0]!, ...path.slice(1)), {
        name: trimmed,
        clientId,
        status: "active",
        shootDates: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      setName("")
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project")
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
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) {
                  handleCreate()
                }
              }}
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
