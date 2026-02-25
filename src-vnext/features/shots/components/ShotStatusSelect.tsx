import { useAuth } from "@/app/providers/AuthProvider"
import { updateShotWithVersion } from "@/features/shots/lib/updateShotWithVersion"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import { StatusBadge } from "@/shared/components/StatusBadge"
import {
  SHOT_STATUSES,
  getShotStatusLabel,
  getShotStatusColor,
} from "@/shared/lib/statusMappings"
import type { Shot, ShotFirestoreStatus } from "@/shared/types"
import { useState } from "react"
import { toast } from "sonner"

interface ShotStatusSelectProps {
  readonly shotId: string
  readonly currentStatus: ShotFirestoreStatus
  readonly shot: Shot
  readonly disabled?: boolean
  readonly compact?: boolean
}

export function ShotStatusSelect({
  shotId,
  currentStatus,
  shot,
  disabled = false,
  compact = false,
}: ShotStatusSelectProps) {
  const { clientId, user } = useAuth()
  const [optimisticStatus, setOptimisticStatus] = useState<ShotFirestoreStatus | null>(null)

  const displayStatus = optimisticStatus ?? currentStatus

  const handleChange = async (value: string) => {
    const newStatus = value as ShotFirestoreStatus
    if (newStatus === currentStatus || !clientId) return

    const previousStatus = currentStatus
    setOptimisticStatus(newStatus)

    try {
      await updateShotWithVersion({
        clientId,
        shotId,
        patch: { status: newStatus },
        shot,
        user,
        source: "ShotStatusSelect",
      })
      setOptimisticStatus(null)
    } catch {
      setOptimisticStatus(null)
      toast.error("Failed to update status", {
        description: `Reverted to ${getShotStatusLabel(previousStatus)}`,
      })
    }
  }

  return (
    <Select
      value={displayStatus}
      onValueChange={handleChange}
      disabled={disabled}
    >
      <SelectTrigger className={compact ? "h-7 w-[108px] px-2 text-xs" : "h-8 w-[128px]"}>
        <SelectValue>
          <StatusBadge
            label={getShotStatusLabel(displayStatus)}
            color={getShotStatusColor(displayStatus)}
            className={compact ? "px-1.5 py-0 text-2xs leading-4" : undefined}
          />
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {SHOT_STATUSES.map((s) => (
          <SelectItem key={s.firestoreValue} value={s.firestoreValue}>
            <StatusBadge label={s.label} color={s.color} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
