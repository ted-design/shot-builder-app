import type { Pull, PullItem, PullItemSize, PullItemSizeStatus, FulfillmentFirestoreStatus, PullFirestoreStatus } from "@/shared/types"

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function mapSize(raw: Record<string, unknown>): PullItemSize | null {
  const size = asString(raw["size"]) ?? ""
  if (!size) return null
  const quantity = asNumber(raw["quantity"]) ?? 0
  const fulfilled = asNumber(raw["fulfilled"]) ?? 0
  const status = asString(raw["status"]) as PullItemSizeStatus | null

  return {
    size,
    quantity,
    fulfilled,
    status: status ?? undefined,
  }
}

function mapItem(raw: Record<string, unknown>): PullItem | null {
  const familyId = asString(raw["familyId"]) ?? ""
  if (!familyId) return null

  const sizes = asArray(raw["sizes"])
    .map(asObject)
    .filter(Boolean)
    .map((s) => mapSize(s!))
    .filter(Boolean) as PullItemSize[]

  const fulfillmentStatus =
    (asString(raw["fulfillmentStatus"]) as FulfillmentFirestoreStatus | null) ??
    "pending"

  return {
    id: asString(raw["id"]) ?? undefined,
    familyId,
    familyName: asString(raw["familyName"]) ?? undefined,
    styleNumber: asString(raw["styleNumber"]),
    gender: asString(raw["gender"]),
    colourId: asString(raw["colourId"]),
    colourName: asString(raw["colourName"]) ?? asString(raw["colorName"]),
    sizes,
    fulfillmentStatus,
    notes: asString(raw["notes"]),
    changeOrders: Array.isArray(raw["changeOrders"]) ? (raw["changeOrders"] as Record<string, unknown>[]) : undefined,
  }
}

export function mapPull(id: string, data: Record<string, unknown>): Pull {
  const items = asArray(data["items"])
    .map(asObject)
    .filter(Boolean)
    .map((i) => mapItem(i!))
    .filter(Boolean) as PullItem[]

  const shareExpireAtRaw = data["shareExpireAt"]
  const shareExpiresAtRaw = data["shareExpiresAt"]

  return {
    id,
    projectId: (asString(data["projectId"]) ?? "") as string,
    clientId: (asString(data["clientId"]) ?? "") as string,
    name: asString(data["name"]) ?? undefined,
    title: asString(data["title"]) ?? undefined,
    shotIds: (Array.isArray(data["shotIds"]) ? (data["shotIds"] as string[]) : []) ?? [],
    items,
    status: (asString(data["status"]) as PullFirestoreStatus | null) ?? "draft",
    shareToken: asString(data["shareToken"]) ?? undefined,
    shareEnabled: asBoolean(data["shareEnabled"]) ?? false,
    shareAllowResponses: asBoolean(data["shareAllowResponses"]) ?? undefined,
    shareExpireAt: (shareExpireAtRaw as Pull["shareExpireAt"]) ?? null,
    shareExpiresAt: (shareExpiresAtRaw as Pull["shareExpiresAt"]) ?? null,
    exportSettings: (asObject(data["exportSettings"]) as Record<string, unknown> | null) ?? undefined,
    createdAt: data["createdAt"] as Pull["createdAt"],
    updatedAt: data["updatedAt"] as Pull["updatedAt"],
  }
}

