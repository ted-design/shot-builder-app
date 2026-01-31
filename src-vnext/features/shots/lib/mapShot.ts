import { Timestamp } from "firebase/firestore"
import type { Shot, ProductAssignment, ShotTag } from "@/shared/types"

/**
 * Normalize a Firestore date field that may be a Timestamp or an ISO string.
 * Returns a Firestore Timestamp or undefined.
 */
function normalizeDate(value: unknown): Timestamp | undefined {
  if (!value) return undefined
  if (value instanceof Timestamp) return value
  if (typeof value === "object" && value !== null && "seconds" in value) {
    const ts = value as { seconds: number; nanoseconds: number }
    return new Timestamp(ts.seconds, ts.nanoseconds)
  }
  if (typeof value === "string") {
    const ms = Date.parse(value)
    if (!Number.isNaN(ms)) {
      return Timestamp.fromMillis(ms)
    }
  }
  return undefined
}

/**
 * Normalize product assignments to handle legacy field naming.
 * Legacy uses productId/productName; vNext uses familyId/familyName.
 * Defaults missing sizeScope to "pending".
 */
function normalizeProducts(raw: unknown): ProductAssignment[] {
  if (!Array.isArray(raw)) return []
  return raw.map((p: Record<string, unknown>) => ({
    familyId: ((p["familyId"] ?? p["productId"]) as string) ?? "",
    familyName: (p["familyName"] ?? p["productName"]) as string | undefined,
    skuId: p["skuId"] as string | undefined,
    skuName: p["skuName"] as string | undefined,
    colourId: p["colourId"] as string | undefined,
    colourName: p["colourName"] as string | undefined,
    size: p["size"] as string | undefined,
    sizeScope: (p["sizeScope"] as ProductAssignment["sizeScope"]) ?? "pending",
    quantity: p["quantity"] as number | undefined,
  }))
}

/**
 * Normalize tags array from legacy data.
 * Validates each entry has id, label, and color.
 */
function normalizeTags(raw: unknown): ReadonlyArray<ShotTag> {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (t): t is ShotTag =>
      typeof t === "object" &&
      t !== null &&
      typeof t.id === "string" &&
      typeof t.label === "string" &&
      typeof t.color === "string",
  )
}

/**
 * Maps a raw Firestore document to a typed Shot.
 * Handles legacy field naming, date format variations, and sizeScope defaults.
 */
export function mapShot(id: string, data: Record<string, unknown>): Shot {
  return {
    id,
    title: (data["title"] as string) ?? "",
    description: data["description"] as string | undefined,
    projectId: (data["projectId"] as string) ?? "",
    clientId: (data["clientId"] as string) ?? "",
    status: (data["status"] as Shot["status"]) ?? "todo",
    talent: (data["talent"] as string[]) ?? [],
    talentIds: data["talentIds"] as string[] | undefined,
    products: normalizeProducts(data["products"]),
    locationId: data["locationId"] as string | undefined,
    locationName: data["locationName"] as string | undefined,
    laneId: data["laneId"] as string | undefined,
    sortOrder: (data["sortOrder"] as number) ?? 0,
    shotNumber: data["shotNumber"] as string | undefined,
    notes: data["notes"] as string | undefined,
    notesAddendum: data["notesAddendum"] as string | undefined,
    date: normalizeDate(data["date"]),
    heroImage: data["heroImage"] as Shot["heroImage"],
    tags: normalizeTags(data["tags"]),
    deleted: data["deleted"] as boolean | undefined,
    createdAt: data["createdAt"] as Shot["createdAt"],
    updatedAt: data["updatedAt"] as Shot["updatedAt"],
    createdBy: (data["createdBy"] as string) ?? "",
  }
}
