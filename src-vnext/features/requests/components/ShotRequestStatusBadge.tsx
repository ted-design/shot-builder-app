import { StatusBadge } from "@/shared/components/StatusBadge"
import { getRequestStatusMapping } from "@/shared/lib/requestStatusMappings"
import type { ShotRequestStatus } from "@/shared/types"

interface ShotRequestStatusBadgeProps {
  readonly status: ShotRequestStatus
  readonly className?: string
}

export function ShotRequestStatusBadge({ status, className }: ShotRequestStatusBadgeProps) {
  const mapping = getRequestStatusMapping(status)
  return <StatusBadge label={mapping.label} color={mapping.color} className={className} />
}
