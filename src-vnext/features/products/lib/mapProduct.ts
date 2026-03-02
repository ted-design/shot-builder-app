import { Timestamp } from "firebase/firestore"
import type { ProductFamily, ProductSku, ProductAssetRequirements } from "@/shared/types"

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === "string" && v.length > 0)
}

function normalizeTimestamp(value: unknown): Timestamp | undefined {
  if (!value) return undefined
  if (value instanceof Timestamp) return value

  if (typeof value === "object" && !Array.isArray(value)) {
    const maybe = value as { seconds?: unknown; nanoseconds?: unknown }
    if (typeof maybe.seconds === "number" && typeof maybe.nanoseconds === "number") {
      return new Timestamp(maybe.seconds, maybe.nanoseconds)
    }
  }

  const ms = asNumber(value)
  if (typeof ms === "number") return Timestamp.fromMillis(ms)

  const s = asString(value)
  if (s) {
    const parsed = Date.parse(s)
    if (Number.isFinite(parsed)) return Timestamp.fromMillis(parsed)
  }

  return undefined
}

export function mapProductFamily(id: string, data: Record<string, unknown>): ProductFamily {
  const styleName = asString(data["styleName"]) ?? ""

  const productType =
    asString(data["productType"]) ??
    asString(data["type"]) ??
    undefined

  const productSubcategory =
    asString(data["productSubcategory"]) ??
    asString(data["subcategory"]) ??
    undefined

  const category =
    asString(data["category"]) ??
    productSubcategory ??
    productType

  return {
    id,
    clientId: (asString(data["clientId"]) ?? "") as string,
    styleName,
    styleNumber: asString(data["styleNumber"]),
    previousStyleNumber: asString(data["previousStyleNumber"]),
    gender: asString(data["gender"]) ?? null,
    productType,
    productSubcategory,
    category,
    status: asString(data["status"]) ?? "active",
    archived: asBoolean(data["archived"]) ?? false,
    notes: data["notes"] as ProductFamily["notes"],
    headerImagePath: asString(data["headerImagePath"]),
    thumbnailImagePath: asString(data["thumbnailImagePath"]),
    sizes: asStringArray(data["sizes"]),
    skuCount: asNumber(data["skuCount"]),
    activeSkuCount: asNumber(data["activeSkuCount"]),
    skuCodes: asStringArray(data["skuCodes"]),
    colorNames: asStringArray(data["colorNames"]),
    sizeOptions: asStringArray(data["sizeOptions"]),
    shotIds: asStringArray(data["shotIds"]),
    launchDate: normalizeTimestamp(data["launchDate"]),
    deleted: asBoolean(data["deleted"]),
    deletedAt: normalizeTimestamp(data["deletedAt"]),
    createdAt: normalizeTimestamp(data["createdAt"]),
    updatedAt: normalizeTimestamp(data["updatedAt"]),
    createdBy: asString(data["createdBy"]),
    updatedBy: asString(data["updatedBy"]),
  }
}

const VALID_ASSET_FLAGS = new Set(["needed", "in_progress", "delivered", "not_needed"])

function normalizeAssetRequirements(value: unknown): ProductAssetRequirements | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  const result: Record<string, string> = {}
  let hasAny = false
  for (const key of ["ecomm", "campaign", "video", "ai_generated"]) {
    const flag = raw[key]
    if (typeof flag === "string" && VALID_ASSET_FLAGS.has(flag)) {
      result[key] = flag
      hasAny = true
    }
  }
  return hasAny ? (result as unknown as ProductAssetRequirements) : undefined
}

export function mapProductSku(id: string, data: Record<string, unknown>): ProductSku {
  const colorName = asString(data["colorName"]) ?? asString(data["name"]) ?? ""
  const hexColor = asString(data["hexColor"]) ?? asString(data["colourHex"])

  return {
    id,
    colorName,
    name: colorName,
    skuCode: asString(data["skuCode"]) ?? asString(data["sku"]),
    sizes: asStringArray(data["sizes"]),
    status: asString(data["status"]) ?? "active",
    archived: asBoolean(data["archived"]) ?? false,
    imagePath: asString(data["imagePath"]),
    colorKey: asString(data["colorKey"]),
    colourHex: hexColor,
    hexColor,
    assetRequirements: normalizeAssetRequirements(data["assetRequirements"]),
    deleted: asBoolean(data["deleted"]),
    deletedAt: normalizeTimestamp(data["deletedAt"]),
    createdAt: normalizeTimestamp(data["createdAt"]),
    updatedAt: normalizeTimestamp(data["updatedAt"]),
    createdBy: asString(data["createdBy"]),
    updatedBy: asString(data["updatedBy"]),
  }
}
