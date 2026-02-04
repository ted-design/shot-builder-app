import { Timestamp } from "firebase/firestore"
import type { Shot, ProductAssignment, ShotLook, ShotReferenceImage, ShotTag } from "@/shared/types"

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

type LegacyRef = { readonly id?: unknown; readonly path?: unknown; readonly downloadURL?: unknown }
type LegacyLook = {
  readonly id?: unknown
  readonly displayImageId?: unknown
  readonly heroProductId?: unknown
  readonly references?: readonly LegacyRef[]
  readonly products?: readonly Record<string, unknown>[]
}

type LegacyAttachment = {
  readonly path?: unknown
  readonly downloadURL?: unknown
  readonly isPrimary?: unknown
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined
}

function normalizeNullableString(value: unknown): string | null | undefined {
  if (value === null) return null
  return asNonEmptyString(value)
}

function normalizeHeroImage(data: Record<string, unknown>): Shot["heroImage"] | undefined {
  const rawHero = data["heroImage"]
  if (rawHero && typeof rawHero === "object") {
    const obj = rawHero as Record<string, unknown>
    const downloadURL = asNonEmptyString(obj["downloadURL"])
    const path = asNonEmptyString(obj["path"])
    const resolved = downloadURL ?? path
    if (resolved) {
      return {
        path: path ?? resolved,
        downloadURL: resolved,
      }
    }
  }

  const looks = Array.isArray(data["looks"]) ? (data["looks"] as LegacyLook[]) : []
  const activeLookId = normalizeNullableString(data["activeLookId"])

  const resolveFromLook = (look: LegacyLook | null): Shot["heroImage"] | undefined => {
    if (!look) return undefined

    // A) display image from this look (if set)
    const displayId = look.displayImageId
    if (typeof displayId === "string" && displayId.length > 0) {
      const refs = Array.isArray(look.references) ? look.references : []
      const match = refs.find((r) => r?.id === displayId) ?? null
      if (match) {
        const downloadURL = asNonEmptyString(match.downloadURL)
        const path = asNonEmptyString(match.path)
        const resolved = downloadURL ?? path
        if (resolved) return { path: path ?? resolved, downloadURL: resolved }
      }
    }

    // B) hero product from this look (if set)
    const heroId = look.heroProductId
    if (typeof heroId === "string" && heroId.length > 0) {
      const products = Array.isArray(look.products) ? look.products : []
      const match = products.find((p) => {
        const familyId = p["familyId"] ?? p["productId"]
        const skuId = p["skuId"] ?? p["colourId"]
        return (
          (typeof skuId === "string" && skuId === heroId) ||
          (typeof familyId === "string" && familyId === heroId)
        )
      }) ?? null
      if (match) {
        const candidate =
          asNonEmptyString(match["skuImageUrl"]) ??
          asNonEmptyString(match["thumbUrl"]) ??
          asNonEmptyString(match["familyImageUrl"]) ??
          asNonEmptyString(match["colourImagePath"]) ??
          asNonEmptyString(match["thumbnailImagePath"])
        if (candidate) return { path: candidate, downloadURL: candidate }
      }
    }

    // C) first product image fallback (when cover product not explicitly selected)
    const products = Array.isArray(look.products) ? look.products : []
    for (const p of products) {
      const candidate =
        asNonEmptyString(p?.["skuImageUrl"]) ??
        asNonEmptyString(p?.["thumbUrl"]) ??
        asNonEmptyString(p?.["familyImageUrl"]) ??
        asNonEmptyString(p?.["colourImagePath"]) ??
        asNonEmptyString(p?.["thumbnailImagePath"])
      if (candidate) return { path: candidate, downloadURL: candidate }
    }

    // D) first reference fallback (this look)
    const refs = Array.isArray(look.references) ? look.references : []
    if (refs.length > 0) {
      const first = refs[0]
      const downloadURL = asNonEmptyString(first?.downloadURL)
      const path = asNonEmptyString(first?.path)
      const resolved = downloadURL ?? path
      if (resolved) return { path: path ?? resolved, downloadURL: resolved }
    }

    return undefined
  }

  // Priority 1: Active look (if present)
  if (activeLookId) {
    const active = looks.find((l) => asNonEmptyString(l.id) === activeLookId) ?? null
    const fromActive = resolveFromLook(active)
    if (fromActive) return fromActive
  }

  // Priority 2: Designated display image from looks
  for (const look of looks) {
    const displayId = look?.displayImageId
    if (typeof displayId !== "string" || displayId.length === 0) continue
    const refs = Array.isArray(look.references) ? look.references : []
    const match = refs.find((r) => r?.id === displayId) ?? null
    if (!match) continue
    const downloadURL = asNonEmptyString(match.downloadURL)
    const path = asNonEmptyString(match.path)
    const resolved = downloadURL ?? path
    if (resolved) {
      return {
        path: path ?? resolved,
        downloadURL: resolved,
      }
    }
  }

  // Priority 3: Hero product image from looks
  for (const look of looks) {
    const heroId = look?.heroProductId
    if (typeof heroId !== "string" || heroId.length === 0) continue
    const products = Array.isArray(look.products) ? look.products : []
    const match = products.find((p) => {
      const familyId = p["familyId"] ?? p["productId"]
      const skuId = p["skuId"] ?? p["colourId"]
      return (
        (typeof skuId === "string" && skuId === heroId) ||
        (typeof familyId === "string" && familyId === heroId)
      )
    }) ?? null
    if (!match) continue
    const candidate =
      asNonEmptyString(match["skuImageUrl"]) ??
      asNonEmptyString(match["thumbUrl"]) ??
      asNonEmptyString(match["familyImageUrl"]) ??
      asNonEmptyString(match["colourImagePath"]) ??
      asNonEmptyString(match["thumbnailImagePath"])
    if (candidate) {
      return { path: candidate, downloadURL: candidate }
    }
  }

  // Priority 3.5: First product image from looks (when no hero product is chosen)
  for (const look of looks) {
    const products = Array.isArray(look.products) ? look.products : []
    for (const p of products) {
      const candidate =
        asNonEmptyString(p?.["skuImageUrl"]) ??
        asNonEmptyString(p?.["thumbUrl"]) ??
        asNonEmptyString(p?.["familyImageUrl"]) ??
        asNonEmptyString(p?.["colourImagePath"]) ??
        asNonEmptyString(p?.["thumbnailImagePath"])
      if (candidate) return { path: candidate, downloadURL: candidate }
    }
  }

  // Priority 4: First reference from first look with references
  for (const look of looks) {
    const refs = Array.isArray(look.references) ? look.references : []
    if (refs.length === 0) continue
    const first = refs[0]
    const downloadURL = asNonEmptyString(first?.downloadURL)
    const path = asNonEmptyString(first?.path)
    const resolved = downloadURL ?? path
    if (resolved) return { path: path ?? resolved, downloadURL: resolved }
  }

  // Priority 5: Primary attachment (legacy multi-image system)
  const attachments = Array.isArray(data["attachments"])
    ? (data["attachments"] as LegacyAttachment[])
    : []
  if (attachments.length > 0) {
    const primary = attachments.find((a) => a?.isPrimary === true) ?? attachments[0]!
    const downloadURL = asNonEmptyString(primary.downloadURL)
    const path = asNonEmptyString(primary.path)
    const resolved = downloadURL ?? path
    if (resolved) {
      return {
        path: path ?? resolved,
        downloadURL: resolved,
      }
    }
  }

  // Priority 5.5: legacy shot-level products fallback (when looks aren't used)
  const rootProducts = Array.isArray(data["products"])
    ? (data["products"] as Record<string, unknown>[])
    : []
  for (const p of rootProducts) {
    const candidate =
      asNonEmptyString(p?.["skuImageUrl"]) ??
      asNonEmptyString(p?.["thumbUrl"]) ??
      asNonEmptyString(p?.["familyImageUrl"]) ??
      asNonEmptyString(p?.["colourImagePath"]) ??
      asNonEmptyString(p?.["thumbnailImagePath"])
    if (candidate) return { path: candidate, downloadURL: candidate }
  }

  // Priority 6: Legacy single image fields
  const referenceImagePath = data["referenceImagePath"]
  const refPath = asNonEmptyString(referenceImagePath)
  if (refPath) return { path: refPath, downloadURL: refPath }

  return undefined
}

function normalizeReferences(raw: unknown): ReadonlyArray<ShotReferenceImage> {
  if (!Array.isArray(raw)) return []
  return raw
    .map((r): ShotReferenceImage | null => {
      if (!r || typeof r !== "object") return null
      const obj = r as Record<string, unknown>
      const id = asNonEmptyString(obj["id"])
      const path = asNonEmptyString(obj["path"])
      const downloadURL = asNonEmptyString(obj["downloadURL"])
      const resolvedPath = path ?? downloadURL
      if (!id || !resolvedPath) return null
      return {
        id,
        path: resolvedPath,
        downloadURL: downloadURL ?? (path ? undefined : resolvedPath),
        uploadedAt: obj["uploadedAt"],
        uploadedBy: asNonEmptyString(obj["uploadedBy"]),
        cropData: obj["cropData"],
      }
    })
    .filter((r): r is ShotReferenceImage => r !== null)
}

function normalizeLooks(raw: unknown): ReadonlyArray<ShotLook> {
  if (!Array.isArray(raw)) return []
  return raw
    .map((l, index): ShotLook | null => {
      if (!l || typeof l !== "object") return null
      const obj = l as Record<string, unknown>
      const id = asNonEmptyString(obj["id"]) ?? `look-${index}`
      const label = asNonEmptyString(obj["label"])
      const order = typeof obj["order"] === "number" ? (obj["order"] as number) : index
      const heroProductId =
        obj["heroProductId"] === null
          ? null
          : asNonEmptyString(obj["heroProductId"])
      const displayImageId =
        obj["displayImageId"] === null
          ? null
          : asNonEmptyString(obj["displayImageId"])

      return {
        id,
        label,
        order,
        products: normalizeProducts(obj["products"]),
        heroProductId,
        references: normalizeReferences(obj["references"]),
        displayImageId,
      }
    })
    .filter((l): l is ShotLook => l !== null)
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
    looks: normalizeLooks(data["looks"]),
    activeLookId: normalizeNullableString(data["activeLookId"]),
    tags: normalizeTags(data["tags"]),
    deleted: data["deleted"] as boolean | undefined,
    createdAt: data["createdAt"] as Shot["createdAt"],
    updatedAt: data["updatedAt"] as Shot["updatedAt"],
    createdBy: (data["createdBy"] as string) ?? "",
  }
}
