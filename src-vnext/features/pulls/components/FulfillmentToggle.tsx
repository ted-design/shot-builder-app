import { useState } from "react"
import { Button } from "@/ui/button"
import { StatusBadge } from "@/shared/components/StatusBadge"
import {
  getFulfillmentStatusLabel,
  getFulfillmentStatusColor,
  FULFILLMENT_STATUSES,
} from "@/shared/lib/statusMappings"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import type { FulfillmentFirestoreStatus } from "@/shared/types"
import { toast } from "sonner"

interface FulfillmentToggleProps {
  readonly currentStatus: FulfillmentFirestoreStatus
  readonly onUpdate: (status: FulfillmentFirestoreStatus) => Promise<void>
  readonly disabled?: boolean
}

export function FulfillmentToggle({
  currentStatus,
  onUpdate,
  disabled,
}: FulfillmentToggleProps) {
  const [optimistic, setOptimistic] = useState<FulfillmentFirestoreStatus | null>(null)

  const display = optimistic ?? currentStatus

  const handleChange = async (value: string) => {
    const next = value as FulfillmentFirestoreStatus
    if (next === currentStatus) return

    setOptimistic(next)
    try {
      await onUpdate(next)
      setOptimistic(null)
    } catch {
      setOptimistic(null)
      toast.error("Failed to update fulfillment status")
    }
  }

  return (
    <Select value={display} onValueChange={handleChange} disabled={disabled}>
      <SelectTrigger className="h-8 w-[130px]">
        <SelectValue>
          <StatusBadge
            label={getFulfillmentStatusLabel(display)}
            color={getFulfillmentStatusColor(display)}
          />
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {FULFILLMENT_STATUSES.map((s) => (
          <SelectItem key={s.firestoreValue} value={s.firestoreValue}>
            <StatusBadge label={s.label} color={s.color} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
