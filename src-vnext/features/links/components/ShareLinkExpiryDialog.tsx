import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import type { ShareLink } from "@/features/links/lib/shareLinkTypes"

interface ShareLinkExpiryDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly link: ShareLink | null
  readonly onSave: (link: ShareLink, date: Date | null) => void
}

function formatDateForInput(date: Date | null): string {
  if (!date) return ""
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function ShareLinkExpiryDialog({
  open,
  onOpenChange,
  link,
  onSave,
}: ShareLinkExpiryDialogProps) {
  const [dateValue, setDateValue] = useState("")

  useEffect(() => {
    if (open && link) {
      setDateValue(formatDateForInput(link.expiresAt))
    }
  }, [open, link])

  const handleSave = () => {
    if (!link) return
    const parsed = dateValue ? new Date(dateValue + "T23:59:59") : null
    onSave(link, parsed)
    onOpenChange(false)
  }

  const handleClear = () => {
    if (!link) return
    onSave(link, null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set Expiry</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Input
            type="date"
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
            className="text-sm"
          />
          <p className="text-xs text-[var(--color-text-muted)]">
            Leave empty for no expiry
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={handleClear}>
            Clear Expiry
          </Button>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
