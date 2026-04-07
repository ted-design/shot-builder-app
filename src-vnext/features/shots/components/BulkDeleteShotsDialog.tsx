import { useState } from "react"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog"
import { bulkSoftDeleteShots } from "@/features/shots/lib/shotLifecycleActions"
import { toast } from "sonner"
import type { AuthUser } from "@/shared/types"

interface BulkDeleteShotsDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly selectedIds: ReadonlySet<string>
  readonly clientId: string | null
  readonly user: AuthUser | null
  readonly onDeleted: () => void
}

export function BulkDeleteShotsDialog({
  open,
  onOpenChange,
  selectedIds,
  clientId,
  user,
  onDeleted,
}: BulkDeleteShotsDialogProps) {
  const [text, setText] = useState("")
  const [deleting, setDeleting] = useState(false)
  const count = selectedIds.size

  const handleOpenChange = (next: boolean) => {
    if (!deleting) {
      onOpenChange(next)
      if (!next) setText("")
    }
  }

  const handleDelete = () => {
    if (!clientId || text.trim() !== "DELETE") return
    setDeleting(true)
    const ids = Array.from(selectedIds)
    void bulkSoftDeleteShots({
      clientId,
      shotIds: ids,
      user,
    })
      .then(() => {
        toast.success(`${count} shot${count === 1 ? "" : "s"} deleted`)
        onDeleted()
      })
      .catch((err) => {
        toast.error("Failed to delete shots", {
          description: err instanceof Error ? err.message : "Unknown error",
        })
      })
      .finally(() => {
        setDeleting(false)
        setText("")
        onOpenChange(false)
      })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {count} shot{count === 1 ? "" : "s"}?</DialogTitle>
          <DialogDescription>
            This hides the selected shots from active project lists and schedules. Type <strong>DELETE</strong> to confirm.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Type DELETE"
            disabled={deleting}
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false)
              setText("")
            }}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={deleting || text.trim() !== "DELETE"}
            onClick={handleDelete}
          >
            {deleting ? "Deleting\u2026" : `Delete ${count} shot${count === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
