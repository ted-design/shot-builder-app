import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog"
import { Button } from "@/ui/button"

interface ConfirmDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly title: string
  readonly description: string
  readonly confirmLabel?: string
  readonly cancelLabel?: string
  readonly destructive?: boolean
  readonly closeOnConfirm?: boolean
  readonly confirmDisabled?: boolean
  readonly cancelDisabled?: boolean
  readonly onConfirm: () => void
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  closeOnConfirm = true,
  confirmDisabled = false,
  cancelDisabled = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={cancelDisabled}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={confirmDisabled}
            onClick={() => {
              onConfirm()
              if (closeOnConfirm) onOpenChange(false)
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
