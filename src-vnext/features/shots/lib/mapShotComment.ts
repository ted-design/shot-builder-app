import { Timestamp } from "firebase/firestore"
import type { ShotComment } from "@/shared/types"

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

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value
  return undefined
}

export function mapShotComment(id: string, data: Record<string, unknown>): ShotComment {
  return {
    id,
    body: asString(data.body) ?? "",
    createdAt: asTimestamp(data.createdAt) ?? undefined,
    createdBy: asString(data.createdBy) ?? undefined,
    createdByName: asString(data.createdByName),
    createdByAvatar: asString(data.createdByAvatar),
    deleted: asBoolean(data.deleted),
  }
}

