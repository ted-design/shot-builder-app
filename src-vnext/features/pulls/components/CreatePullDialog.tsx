import { useState } from "react"
import { addDoc, collection, serverTimestamp } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { pullsPath } from "@/shared/lib/paths"
import { useAuth } from "@/app/providers/AuthProvider"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
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

interface CreatePullDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

export function CreatePullDialog({
  open,
  onOpenChange,
}: CreatePullDialogProps) {
  const { clientId } = useAuth()
  const { projectId } = useProjectScope()
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!clientId || !projectId) return

    setSaving(true)
    setError(null)

    try {
      const path = pullsPath(projectId, clientId)
      await addDoc(collection(db, path[0]!, ...path.slice(1)), {
        name: name.trim() || null,
        projectId,
        clientId,
        shotIds: [],
        items: [],
        status: "draft",
        shareEnabled: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      setName("")
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create pull sheet")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Pull Sheet</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="pull-name">Name (optional)</Label>
            <Input
              id="pull-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Day 1 Pull"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate()
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
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
