import { useState } from "react"
import { Timestamp } from "firebase/firestore"
import { createSchedule } from "@/features/schedules/lib/scheduleWrites"
import { useAuth } from "@/app/providers/AuthProvider"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { useEffectiveRole } from "@/shared/hooks/useEffectiveRole"
import { canManageSchedules } from "@/shared/lib/rbac"
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

interface CreateScheduleDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onCreated?: (scheduleId: string) => void
}

export function CreateScheduleDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateScheduleDialogProps) {
  const { clientId } = useAuth()
  // 5b effective role: the project members doc WINS over the global claim
  // (locked Q5/Q6). Defense-in-depth guard — the dialog is only mounted by
  // canManage parents (ScheduleListPage), but the write guard below must
  // not fall back to the global-role guess while the first member read is
  // in flight. Backing rule: /schedules create/update
  // (firestore.rules:796-799).
  const { role, resolving: roleResolving } = useEffectiveRole()
  const { projectId } = useProjectScope()
  const [name, setName] = useState("")
  const [date, setDate] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    const trimmedName = name.trim()
    if (!trimmedName || !clientId || roleResolving || !canManageSchedules(role)) return

    setSaving(true)
    setError(null)

    try {
      const dateValue = date
        ? Timestamp.fromDate(new Date(date + "T00:00:00"))
        : null

      const id = await createSchedule(clientId, projectId, {
        name: trimmedName,
        date: dateValue,
      })
      setName("")
      setDate("")
      onOpenChange(false)
      onCreated?.(id)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create schedule",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Schedule</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="schedule-name">Name</Label>
            <Input
              id="schedule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Day 1 — Studio Shoot"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="schedule-date">Shoot Date</Label>
            <Input
              id="schedule-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
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
