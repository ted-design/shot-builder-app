import type { ShotRequestStatus } from "@/shared/types"

export interface RequestStatusMapping {
  readonly firestoreValue: ShotRequestStatus
  readonly label: string
  readonly color: "gray" | "blue" | "green" | "amber"
}

const REQUEST_STATUS_MAP: Record<ShotRequestStatus, RequestStatusMapping> = {
  submitted: { firestoreValue: "submitted", label: "Submitted", color: "blue" },
  triaged: { firestoreValue: "triaged", label: "Triaged", color: "amber" },
  absorbed: { firestoreValue: "absorbed", label: "Absorbed", color: "green" },
  rejected: { firestoreValue: "rejected", label: "Rejected", color: "gray" },
}

export const REQUEST_STATUSES = Object.values(REQUEST_STATUS_MAP)

export function getRequestStatusLabel(status: ShotRequestStatus): string {
  return REQUEST_STATUS_MAP[status]?.label ?? status
}

export function getRequestStatusColor(status: ShotRequestStatus): string {
  return REQUEST_STATUS_MAP[status]?.color ?? "gray"
}

export function getRequestStatusMapping(status: ShotRequestStatus): RequestStatusMapping {
  return REQUEST_STATUS_MAP[status] ?? REQUEST_STATUS_MAP.submitted
}
