import { useState } from "react"
import { addDoc, collection, serverTimestamp } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { shotsPath } from "@/shared/lib/paths"
import { useAuth } from "@/app/providers/AuthProvider"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { createShotVersionSnapshot } from "@/features/shots/lib/shotVersioning"
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

interface CreateShotDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

export function CreateShotDialog({
  open,
  onOpenChange,
}: CreateShotDialogProps) {
  const { clientId, user } = useAuth()
  const { projectId } = useProjectScope()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    const trimmedTitle = title.trim()
    if (!trimmedTitle || !clientId) return

    setSaving(true)
    setError(null)

    try {
      const path = shotsPath(clientId)
      const createdBy = user?.uid ?? ""
      const ref = await addDoc(collection(db, path[0]!, ...path.slice(1)), {
        title: trimmedTitle,
        description: description.trim() || null,
        projectId,
        clientId,
        status: "todo",
        talent: [],
        products: [],
        sortOrder: Date.now(),
        deleted: false,
        notes: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy,
      })

      if (user?.uid) {
        void createShotVersionSnapshot({
          clientId,
          shotId: ref.id,
          previousShot: null,
          patch: {
            title: trimmedTitle,
            description: description.trim() || null,
            status: "todo",
            talent: [],
            products: [],
            sortOrder: Date.now(),
            deleted: false,
            notes: null,
            notesAddendum: null,
            shotNumber: null,
            date: null,
            locationId: null,
            locationName: null,
            heroImage: null,
            looks: null,
            activeLookId: null,
            tags: null,
            laneId: null,
          },
          user,
          changeType: "create",
        }).catch((err) => {
          console.error("[CreateShotDialog] Failed to write initial version:", err)
        })
      }

      setTitle("")
      setDescription("")
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create shot")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Shot</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="shot-title">Title</Label>
            <Input
              id="shot-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Hero Banner - White Tee"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="shot-description">Description (optional)</Label>
            <Textarea
              id="shot-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the shot..."
              rows={3}
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
          <Button onClick={handleCreate} disabled={!title.trim() || saving}>
            {saving ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
