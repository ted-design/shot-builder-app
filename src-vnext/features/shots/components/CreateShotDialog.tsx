import { useState } from "react"
import { addDoc, collection, serverTimestamp } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { shotsPath } from "@/shared/lib/paths"
import { useAuth } from "@/app/providers/AuthProvider"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { createShotVersionSnapshot } from "@/features/shots/lib/shotVersioning"
import { nextShotNumber } from "@/features/shots/lib/shotNumbering"
import { shotTitleSchema, validateField } from "@/shared/lib/validation"
import { ResponsiveDialog } from "@/shared/components/ResponsiveDialog"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Textarea } from "@/ui/textarea"
import type { Shot } from "@/shared/types"

interface CreateShotDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onCreated?: (shotId: string, title: string) => void
  /** All shots in the project — used to auto-generate the next shot number. */
  readonly shots?: ReadonlyArray<Shot>
}

export function CreateShotDialog({
  open,
  onOpenChange,
  onCreated,
  shots = [],
}: CreateShotDialogProps) {
  const { clientId, user } = useAuth()
  const { projectId } = useProjectScope()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)
  const [titleError, setTitleError] = useState<string | null>(null)

  const validate = (): boolean => {
    const error = validateField(shotTitleSchema, title)
    setTitleError(error)
    return !error
  }

  const handleCreate = async () => {
    if (!validate()) return
    if (!clientId) {
      setTitleError("Missing client scope. Try refreshing, then sign in again.")
      return
    }

    setSaving(true)
    setTitleError(null)

    try {
      const trimmedTitle = title.trim()
      const path = shotsPath(clientId)
      const createdBy = user?.uid ?? ""
      const sortOrder = Date.now()
      const shotNumber = nextShotNumber(shots)

      const ref = await addDoc(collection(db, path[0]!, ...path.slice(1)), {
        title: trimmedTitle,
        description: description.trim() || null,
        projectId,
        clientId,
        status: "todo",
        talent: [],
        products: [],
        sortOrder,
        shotNumber,
        date: null,
        deleted: false,
        notes: null,
        referenceLinks: [],
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
            sortOrder,
            shotNumber,
            deleted: false,
            notes: null,
            notesAddendum: null,
            date: null,
            locationId: null,
            locationName: null,
            heroImage: null,
            looks: null,
            activeLookId: null,
            tags: null,
            referenceLinks: [],
            laneId: null,
          },
          user,
          changeType: "create",
        }).catch(() => {
          // Version snapshot is non-critical
        })
      }

      setTitle("")
      setDescription("")
      setTitleError(null)
      onOpenChange(false)
      onCreated?.(ref.id, trimmedTitle)
    } catch (err) {
      setTitleError(err instanceof Error ? err.message : "Failed to create shot")
    } finally {
      setSaving(false)
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create Shot"
      description="Create a new shot in this project."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!title.trim() || saving}>
            {saving ? "Creating..." : "Create"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 py-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="shot-title">Title</Label>
          <Input
            id="shot-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              if (titleError) setTitleError(null)
            }}
            placeholder="e.g. Hero Banner - White Tee"
            autoFocus
            data-testid="shot-title-input"
          />
          {titleError && (
            <p className="text-xs text-[var(--color-error)]" data-testid="title-error">
              {titleError}
            </p>
          )}
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
      </div>
    </ResponsiveDialog>
  )
}
