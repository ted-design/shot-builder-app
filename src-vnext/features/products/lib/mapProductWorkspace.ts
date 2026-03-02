import { Timestamp } from "firebase/firestore"
import type {
  ProductComment,
  ProductDocument,
  ProductSample,
  ProductSampleStatus,
  ProductSampleType,
} from "@/shared/types"

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean)
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

function normalizeSampleType(value: unknown): ProductSampleType {
  const v = asString(value)?.toLowerCase()
  if (v === "shoot") return "shoot"
  if (v === "pre_production" || v === "pre-prod" || v === "preprod") return "pre_production"
  if (v === "bulk") return "bulk"
  return "shoot"
}

function normalizeSampleStatus(value: unknown): ProductSampleStatus {
  const v = asString(value)?.toLowerCase()
  if (v === "requested") return "requested"
  if (v === "in_transit" || v === "in transit") return "in_transit"
  if (v === "arrived") return "arrived"
  if (v === "returned") return "returned"
  if (v === "issue") return "issue"
  return "requested"
}

export function mapProductSample(id: string, data: Record<string, unknown>): ProductSample {
  return {
    id,
    type: normalizeSampleType(data.type),
    status: normalizeSampleStatus(data.status),
    sizeRun: asStringArray(data.sizeRun),
    carrier: asString(data.carrier),
    tracking: asString(data.tracking),
    eta: asTimestamp(data.eta),
    arrivedAt: asTimestamp(data.arrivedAt),
    notes: asString(data.notes),
    scopeSkuId: asString(data.scopeSkuId),
    returnDueDate: asTimestamp(data.returnDueDate),
    condition: asString(data.condition) ?? null,
    deleted: asBoolean(data.deleted),
    createdAt: asTimestamp(data.createdAt) ?? undefined,
    updatedAt: asTimestamp(data.updatedAt) ?? undefined,
    createdBy: asString(data.createdBy),
    updatedBy: asString(data.updatedBy),
  }
}

export function mapProductComment(id: string, data: Record<string, unknown>): ProductComment {
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

export function mapProductDocument(id: string, data: Record<string, unknown>): ProductDocument {
  return {
    id,
    name: asString(data.name) ?? "Document",
    storagePath: asString(data.storagePath) ?? "",
    contentType: asString(data.contentType),
    sizeBytes: typeof data.sizeBytes === "number" ? data.sizeBytes : null,
    createdAt: asTimestamp(data.createdAt) ?? undefined,
    createdBy: asString(data.createdBy) ?? undefined,
    createdByName: asString(data.createdByName),
    createdByAvatar: asString(data.createdByAvatar),
    deleted: asBoolean(data.deleted),
  }
}

