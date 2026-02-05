import { Timestamp } from "firebase/firestore"
import type { ShotVersion, ShotVersionChangeType } from "@/shared/types"

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function asTimestamp(value: unknown): Timestamp | null {
  if (value && typeof value === "object" && "toDate" in value) {
    return value as Timestamp
  }
  return null
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean)
}

function asChangeType(value: unknown): ShotVersionChangeType | undefined {
  if (value === "create" || value === "update" || value === "rollback") return value
  return undefined
}

export function mapShotVersion(id: string, data: Record<string, unknown>): ShotVersion {
  const snapshot =
    data.snapshot && typeof data.snapshot === "object"
      ? (data.snapshot as Record<string, unknown>)
      : {}

  return {
    id,
    snapshot,
    createdAt: asTimestamp(data.createdAt) ?? undefined,
    createdBy: asString(data.createdBy) ?? undefined,
    createdByName: asString(data.createdByName),
    createdByAvatar: asString(data.createdByAvatar),
    changeType: asChangeType(data.changeType),
    changedFields: asStringArray(data.changedFields),
  }
}

