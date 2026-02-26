import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { useAuth } from "@/app/providers/AuthProvider"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { createPullFromShots } from "@/features/pulls/lib/createPullFromShots"

function defaultPullName(): string {
  return `Pull - ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
}
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
import type { Shot } from "@/shared/types"

export function CreatePullFromShotsDialog({
  open,
  onOpenChange,
  shots,
  onCreated,
}: {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly shots: readonly Shot[]
  readonly onCreated: (pullId: string) => void
}) {
  const { clientId } = useAuth()
  const { projectId } = useProjectScope()
  const [name, setName] = useState(defaultPullName)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(defaultPullName())
    setSaving(false)
  }, [open])

  const shotCount = shots.length
  const productCount = useMemo(
    () => shots.reduce((sum, s) => sum + (s.products?.length ?? 0), 0),
    [shots],
  )

  const canCreate = !!clientId && shotCount > 0 && !saving

  const handleCreate = async () => {
    if (!clientId) return
    if (shotCount === 0) return

    setSaving(true)
    try {
      const pullId = await createPullFromShots({
        clientId,
        projectId,
        name: name.trim() || null,
        shots,
      })
      toast.success("Pull sheet created.")
      onOpenChange(false)
      onCreated(pullId)
    } catch (err) {
      console.error("[CreatePullFromShotsDialog] Failed to create pull:", err)
      toast.error("Failed to create pull sheet.")
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Pull Sheet</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1">
            <p className="text-sm text-[var(--color-text-muted)]">
              {shotCount} shot{shotCount === 1 ? "" : "s"} selected • {productCount} product assignment{productCount === 1 ? "" : "s"}
            </p>
            <p className="text-xs text-[var(--color-text-subtle)]">
              Pull items are aggregated by product + color and expanded by sizeScope.
            </p>
          </div>

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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!canCreate}>
            {saving ? "Creating..." : "Create pull"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

