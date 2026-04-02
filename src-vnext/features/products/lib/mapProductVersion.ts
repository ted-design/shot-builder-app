import { Timestamp } from "firebase/firestore"
import type {
  ProductVersion,
  ProductVersionChangeType,
  ProductVersionFieldChange,
} from "@/shared/types"

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

function asChangeType(value: unknown): ProductVersionChangeType | undefined {
  if (value === "create" || value === "update" || value === "rollback") return value
  return undefined
}

function asFieldChanges(value: unknown): ProductVersionFieldChange[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(
      (v): v is Record<string, unknown> =>
        v != null && typeof v === "object" && "field" in v && "label" in v,
    )
    .map((v) => ({
      field: typeof v.field === "string" ? v.field : "",
      label: typeof v.label === "string" ? v.label : "",
      previousValue: v.previousValue ?? null,
      currentValue: v.currentValue ?? null,
    }))
}

function asSkuSnapshots(
  value: unknown,
): Record<string, Record<string, unknown>> | undefined {
  if (!value || typeof value !== "object") return undefined
  const result: Record<string, Record<string, unknown>> = {}
  for (const [key, val] of Object.entries(value)) {
    if (val && typeof val === "object") {
      result[key] = val as Record<string, unknown>
    }
  }
  return Object.keys(result).length > 0 ? result : undefined
}

export function mapProductVersion(
  id: string,
  data: Record<string, unknown>,
): ProductVersion {
  const snapshot =
    data.snapshot && typeof data.snapshot === "object"
      ? (data.snapshot as Record<string, unknown>)
      : {}

  return {
    id,
    snapshot,
    skuSnapshots: asSkuSnapshots(data.skuSnapshots),
    fieldChanges: asFieldChanges(data.fieldChanges),
    createdAt: asTimestamp(data.createdAt) ?? undefined,
    createdBy: asString(data.createdBy) ?? undefined,
    createdByName: asString(data.createdByName),
    createdByAvatar: asString(data.createdByAvatar),
    changeType: asChangeType(data.changeType),
    changedFields: asStringArray(data.changedFields),
    targetSkuId: asString(data.targetSkuId),
    targetSkuLabel: asString(data.targetSkuLabel),
  }
}
