import type {
  ShotFirestoreStatus,
  PullFirestoreStatus,
  FulfillmentFirestoreStatus,
} from "@/shared/types"

// --- Shot Status ---

export interface ShotStatusMapping {
  readonly firestoreValue: ShotFirestoreStatus
  readonly label: string
  readonly color: "gray" | "blue" | "green" | "amber"
}

const SHOT_STATUS_MAP: Record<ShotFirestoreStatus, ShotStatusMapping> = {
  todo: { firestoreValue: "todo", label: "Draft", color: "gray" },
  in_progress: { firestoreValue: "in_progress", label: "In Progress", color: "blue" },
  complete: { firestoreValue: "complete", label: "Shot", color: "green" },
  on_hold: { firestoreValue: "on_hold", label: "On Hold", color: "amber" },
}

export const SHOT_STATUSES = Object.values(SHOT_STATUS_MAP)

export function getShotStatusLabel(status: ShotFirestoreStatus): string {
  return SHOT_STATUS_MAP[status]?.label ?? status
}

export function getShotStatusColor(status: ShotFirestoreStatus): string {
  return SHOT_STATUS_MAP[status]?.color ?? "gray"
}

export function getShotStatusMapping(status: ShotFirestoreStatus): ShotStatusMapping {
  return SHOT_STATUS_MAP[status] ?? SHOT_STATUS_MAP.todo
}

export function shotLabelToFirestore(label: string): ShotFirestoreStatus {
  const found = SHOT_STATUSES.find(
    (s) => s.label.toLowerCase() === label.toLowerCase(),
  )
  return found?.firestoreValue ?? "todo"
}

// --- Pull Status ---

export interface PullStatusMapping {
  readonly firestoreValue: PullFirestoreStatus
  readonly label: string
  readonly color: "gray" | "blue" | "green"
}

const PULL_STATUS_MAP: Record<PullFirestoreStatus, PullStatusMapping> = {
  draft: { firestoreValue: "draft", label: "Draft", color: "gray" },
  published: { firestoreValue: "published", label: "Published", color: "blue" },
  "in-progress": { firestoreValue: "in-progress", label: "In Progress", color: "blue" },
  fulfilled: { firestoreValue: "fulfilled", label: "Fulfilled", color: "green" },
}

export const PULL_STATUSES = Object.values(PULL_STATUS_MAP)

export function getPullStatusLabel(status: PullFirestoreStatus): string {
  return PULL_STATUS_MAP[status]?.label ?? status
}

export function getPullStatusColor(status: PullFirestoreStatus): string {
  return PULL_STATUS_MAP[status]?.color ?? "gray"
}

export function pullLabelToFirestore(label: string): PullFirestoreStatus {
  const found = PULL_STATUSES.find(
    (s) => s.label.toLowerCase() === label.toLowerCase(),
  )
  return found?.firestoreValue ?? "draft"
}

// --- Fulfillment Status ---

export interface FulfillmentStatusMapping {
  readonly firestoreValue: FulfillmentFirestoreStatus
  readonly label: string
  readonly color: "gray" | "green" | "amber" | "blue"
}

const FULFILLMENT_STATUS_MAP: Record<FulfillmentFirestoreStatus, FulfillmentStatusMapping> = {
  pending: { firestoreValue: "pending", label: "Pending", color: "gray" },
  fulfilled: { firestoreValue: "fulfilled", label: "Fulfilled", color: "green" },
  partial: { firestoreValue: "partial", label: "Partial", color: "amber" },
  substituted: { firestoreValue: "substituted", label: "Substituted", color: "blue" },
}

export const FULFILLMENT_STATUSES = Object.values(FULFILLMENT_STATUS_MAP)

export function getFulfillmentStatusLabel(status: FulfillmentFirestoreStatus): string {
  return FULFILLMENT_STATUS_MAP[status]?.label ?? status
}

export function getFulfillmentStatusColor(status: FulfillmentFirestoreStatus): string {
  return FULFILLMENT_STATUS_MAP[status]?.color ?? "gray"
}

export function fulfillmentLabelToFirestore(label: string): FulfillmentFirestoreStatus {
  const found = FULFILLMENT_STATUSES.find(
    (s) => s.label.toLowerCase() === label.toLowerCase(),
  )
  return found?.firestoreValue ?? "pending"
}
