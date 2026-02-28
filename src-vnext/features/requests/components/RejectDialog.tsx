import { useState, useEffect } from "react"
import { toast } from "sonner"
import { useAuth } from "@/app/providers/AuthProvider"
import { triageRejectRequest } from "@/features/requests/lib/requestWrites"
import { ResponsiveDialog } from "@/shared/components/ResponsiveDialog"
import { Button } from "@/ui/button"
import { Label } from "@/ui/label"
import { Textarea } from "@/ui/textarea"
import type { ShotRequest } from "@/shared/types"

interface RejectDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly request: ShotRequest
}

export function RejectDialog({ open, onOpenChange, request }: RejectDialogProps) {
  const { user, clientId } = useAuth()
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) {
      setReason("")
      setSaving(false)
    }
  }, [open])

  const handleSubmit = async () => {
    if (!clientId || !user) return

    setSaving(true)
    try {
      await triageRejectRequest({
        requestId: request.id,
        clientId,
        triagedBy: user.uid,
        rejectionReason: reason.trim() || null,
      })
      toast.success("Request rejected")
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Reject Request"
      description="Reject this shot request with an optional reason."
      contentClassName="sm:max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handleSubmit}
            disabled={saving}
            className="border-[var(--color-error)] text-[var(--color-error)] hover:bg-[var(--color-error)]/10"
          >
            {saving ? "Rejecting..." : "Reject Request"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 py-4">
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3">
          <p className="text-sm font-medium text-[var(--color-text)]">{request.title}</p>
          <p className="text-xs text-[var(--color-text-muted)]">
            by {request.submittedByName ?? "Unknown"}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="reject-reason">Reason (optional)</Label>
          <Textarea
            id="reject-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this request being rejected?"
            rows={3}
          />
        </div>
      </div>
    </ResponsiveDialog>
  )
}
