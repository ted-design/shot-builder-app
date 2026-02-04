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

  const asString = (value: unknown): string | undefined =>
    typeof value === "string" && value.length > 0 ? value : undefined

  return raw.map((p: Record<string, unknown>) => {
    // Legacy shots store image *paths* on the assignment:
    // - thumbnailImagePath (derived thumb)
    // - colourImagePath (colorway-specific image)
    // vNext stores denormalized URLs in thumbUrl/skuImageUrl/familyImageUrl.
    const legacyThumbPath =
      asString(p["thumbnailImagePath"]) ?? asString(p["colourImagePath"])

    return {
      familyId: ((p["familyId"] ?? p["productId"]) as string) ?? "",
      familyName: asString(p["familyName"] ?? p["productName"]),
      skuId: asString(p["skuId"]),
      skuName: asString(p["skuName"]),
      colourId: asString(p["colourId"]),
      colourName: asString(p["colourName"]),
      size: asString(p["size"]),
      sizeScope: (p["sizeScope"] as ProductAssignment["sizeScope"]) ?? "pending",
      quantity: typeof p["quantity"] === "number" ? (p["quantity"] as number) : undefined,
      // Prefer vNext denormalized URLs, fall back to legacy storage paths.
      thumbUrl: asString(p["thumbUrl"]) ?? legacyThumbPath,
      skuImageUrl: asString(p["skuImageUrl"]) ?? asString(p["colourImagePath"]),
      familyImageUrl: asString(p["familyImageUrl"]) ?? asString(p["thumbnailImagePath"]),
    }
  })
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

function isHttpUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (value.startsWith("https://") || value.startsWith("http://"))
  )
}

type LegacyRef = { readonly id?: unknown; readonly path?: unknown; readonly downloadURL?: unknown }
type LegacyLook = {
  readonly displayImageId?: unknown
  readonly references?: readonly LegacyRef[]
}

type LegacyAttachment = {
  readonly path?: unknown
  readonly downloadURL?: unknown
  readonly isPrimary?: unknown
}

function normalizeHeroImage(data: Record<string, unknown>): Shot["heroImage"] | undefined {
  const rawHero = data["heroImage"]
  if (rawHero && typeof rawHero === "object") {
    const obj = rawHero as Record<string, unknown>
    const downloadURL = obj["downloadURL"]
    const path = obj["path"]
    if (isHttpUrl(downloadURL)) {
      return {
        path: typeof path === "string" && path.length > 0 ? path : downloadURL,
        downloadURL,
      }
    }
  }

  const looks = Array.isArray(data["looks"]) ? (data["looks"] as LegacyLook[]) : []

  // Priority 1: Designated display image from looks
  for (const look of looks) {
    const displayId = look?.displayImageId
    if (typeof displayId !== "string" || displayId.length === 0) continue
    const refs = Array.isArray(look.references) ? look.references : []
    const match = refs.find((r) => r?.id === displayId) ?? null
    if (!match) continue
    const downloadURL = match.downloadURL
    const path = match.path
    if (isHttpUrl(downloadURL)) {
      return {
        path: typeof path === "string" && path.length > 0 ? path : downloadURL,
        downloadURL,
      }
    }
    if (isHttpUrl(path)) {
      return { path, downloadURL: path }
    }
  }

  // Priority 2: First reference from first look with references
  for (const look of looks) {
    const refs = Array.isArray(look.references) ? look.references : []
    if (refs.length === 0) continue
    const first = refs[0]
    const downloadURL = first?.downloadURL
    const path = first?.path
    if (isHttpUrl(downloadURL)) {
      return {
        path: typeof path === "string" && path.length > 0 ? path : downloadURL,
        downloadURL,
      }
    }
    if (isHttpUrl(path)) {
      return { path, downloadURL: path }
    }
  }

  // Priority 3: Primary attachment (legacy multi-image system)
  const attachments = Array.isArray(data["attachments"])
    ? (data["attachments"] as LegacyAttachment[])
    : []
  if (attachments.length > 0) {
    const primary = attachments.find((a) => a?.isPrimary === true) ?? attachments[0]!
    const downloadURL = primary.downloadURL
    const path = primary.path
    if (isHttpUrl(downloadURL)) {
      return {
        path: typeof path === "string" && path.length > 0 ? path : downloadURL,
        downloadURL,
      }
    }
    if (isHttpUrl(path)) {
      return { path, downloadURL: path }
    }
  }

  // Priority 4: Legacy single image fields
  const referenceImagePath = data["referenceImagePath"]
  if (isHttpUrl(referenceImagePath)) {
    return { path: referenceImagePath, downloadURL: referenceImagePath }
  }

  return undefined
}

/**
 * Maps a raw Firestore document to a typed Shot.
 * Handles legacy field naming, date format variations, and sizeScope defaults.
 */
export function mapShot(id: string, data: Record<string, unknown>): Shot {
  const titleRaw =
    (data["title"] as string | null | undefined) ??
    (data["name"] as string | null | undefined) ??
    ""
  const title = typeof titleRaw === "string" ? titleRaw.trim() : ""

  return {
    id,
    title,
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
    heroImage: normalizeHeroImage(data),
    tags: normalizeTags(data["tags"]),
    deleted: data["deleted"] as boolean | undefined,
    createdAt: data["createdAt"] as Shot["createdAt"],
    updatedAt: data["updatedAt"] as Shot["updatedAt"],
    createdBy: (data["createdBy"] as string) ?? "",
  }
}
