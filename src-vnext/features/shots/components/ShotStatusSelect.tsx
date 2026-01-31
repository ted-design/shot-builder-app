import { doc, updateDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { shotPath } from "@/shared/lib/paths"
import { useAuth } from "@/app/providers/AuthProvider"
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
import type { ShotFirestoreStatus } from "@/shared/types"
import { useState } from "react"
import { toast } from "sonner"

interface ShotStatusSelectProps {
  readonly shotId: string
  readonly currentStatus: ShotFirestoreStatus
  readonly disabled?: boolean
}

export function ShotStatusSelect({
  shotId,
  currentStatus,
  disabled = false,
}: ShotStatusSelectProps) {
  const { clientId } = useAuth()
  const [optimisticStatus, setOptimisticStatus] = useState<ShotFirestoreStatus | null>(null)

  const displayStatus = optimisticStatus ?? currentStatus

  const handleChange = async (value: string) => {
    const newStatus = value as ShotFirestoreStatus
    if (newStatus === currentStatus || !clientId) return

    const previousStatus = currentStatus
    setOptimisticStatus(newStatus)

    try {
      const path = shotPath(shotId, clientId)
      const ref = doc(db, path[0]!, ...path.slice(1))
      await updateDoc(ref, {
        status: newStatus,
        updatedAt: serverTimestamp(),
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
      <SelectTrigger className="h-8 w-[140px]">
        <SelectValue>
          <StatusBadge
            label={getShotStatusLabel(displayStatus)}
            color={getShotStatusColor(displayStatus)}
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
