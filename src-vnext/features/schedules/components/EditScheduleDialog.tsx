import { useEffect, useRef, useState } from "react"
import { Timestamp } from "firebase/firestore"
import { toast } from "sonner"
import { ResponsiveDialog } from "@/shared/components/ResponsiveDialog"
import { updateScheduleFields } from "@/features/schedules/lib/scheduleWrites"
import { useAuth } from "@/app/providers/AuthProvider"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import type { Schedule } from "@/shared/types"

interface EditScheduleDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly schedule: Schedule | null
}

export function EditScheduleDialog({
  open,
  onOpenChange,
  schedule,
}: EditScheduleDialogProps) {
  const { clientId } = useAuth()
  const { projectId } = useProjectScope()

  const [name, setName] = useState("")
  const [date, setDate] = useState("")
  const [saving, setSaving] = useState(false)

  // Track previous open state to initialize form only on open transition.
  // `schedule` is excluded from deps because it's a live onSnapshot reference
  // that creates new objects on each Firestore update, which would reset
  // local form state mid-edit.
  const wasOpen = useRef(false)
  useEffect(() => {
    if (open && !wasOpen.current && schedule) {
      setName(schedule.name ?? "")
      setDate(schedule.date?.toDate().toISOString().split("T")[0] ?? "")
    }
    wasOpen.current = open
  }, [open, schedule])

  const handleSave = async () => {
    if (!schedule || !clientId) return

    const trimmedName = name.trim()
    if (!trimmedName) return

    const dateValue = date
      ? Timestamp.fromDate(new Date(date + "T00:00:00"))
      : null

    setSaving(true)
    try {
      await updateScheduleFields(clientId, projectId, schedule.id, {
        name: trimmedName,
        date: dateValue,
      })
      toast.success("Schedule updated")
      onOpenChange(false)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update schedule",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Schedule"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 py-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-schedule-name">Name</Label>
          <Input
            id="edit-schedule-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
            autoFocus
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-schedule-date">Shoot Date</Label>
          <Input
            id="edit-schedule-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={saving}
          />
        </div>
      </div>
    </ResponsiveDialog>
  )
}
