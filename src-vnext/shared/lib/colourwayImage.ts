import type { ProductAssignment } from "@/shared/types"

/**
 * Colourway images never fall back to the family image. The family thumbnail
 * is set to the first colourway's photo on save (productWrites), so a fallback
 * to it shows a sibling colour with no indication. A colourway with no photo of
 * its own resolves to `src: null` + `colourwayPhotoMissing: true`, and the
 * surface shows a placeholder. Display only — stored fields are untouched.
 */

export const NO_COLOURWAY_PHOTO_LABEL = "No photo for this colour"

interface SkuImageSource {
  readonly imagePath?: string | null
}

interface FamilyImageSource {
  readonly thumbnailImagePath?: string | null
  readonly headerImagePath?: string | null
}

export interface ResolvedProductImage {
  /** Storage path or URL to render; null when there is nothing honest to show. */
  readonly src: string | null
  /** True when a colourway was chosen but it has no photo of its own. */
  readonly colourwayPhotoMissing: boolean
}

function nonEmpty(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null
}

/** Image for a colourway (SKU) card or row: its own photo or nothing. */
export function resolveSkuImage(sku: SkuImageSource | null | undefined): ResolvedProductImage {
  const src = nonEmpty(sku?.imagePath)
  return { src, colourwayPhotoMissing: src === null }
}

/** Key for a live colourway photo looked up by family + SKU doc id. */
export function colourwaySkuKey(familyId: string, skuId: string): string {
  return `${familyId}/${skuId}`
}

/** The SKU doc id an assignment points at (legacy assignments carry it in `colourId`). */
export function assignmentColourwayId(
  assignment: Pick<ProductAssignment, "skuId" | "colourId">,
): string | null {
  return nonEmpty(assignment.skuId) ?? nonEmpty(assignment.colourId)
}

/**
 * Image for a product assigned to a shot/look.
 *
 * - No colourway chosen: a family-level assignment, so the family image is right.
 * - Colourway chosen, live SKU doc loaded: it is authoritative — its photo or
 *   nothing. Stored fields can be stale (removing a photo deletes the file;
 *   editing an assignment to another colourway keeps the old one's URLs).
 *   Callers pass `sku` only once it is loaded for THIS colourway's id.
 * - Colourway chosen, no live doc (loading, missing, or the PDF report): the
 *   photo frozen at pick time. Every writer stores `thumbUrl` as the colourway
 *   photo or else the family image (picker: `skuImageUrl ?? familyImageUrl`;
 *   imports: `sku.imagePath ?? family thumb`), so `thumbUrl` counts unless it
 *   equals the frozen `familyImageUrl`.
 */
export function resolveAssignmentImage(
  assignment: ProductAssignment,
  live: {
    readonly sku?: SkuImageSource | null
    readonly family?: FamilyImageSource | null
  } = {},
): ResolvedProductImage {
  const colourwayId = assignmentColourwayId(assignment)

  if (!colourwayId) {
    const src =
      nonEmpty(assignment.thumbUrl) ??
      nonEmpty(assignment.skuImageUrl) ??
      nonEmpty(assignment.familyImageUrl) ??
      nonEmpty(live.family?.thumbnailImagePath) ??
      nonEmpty(live.family?.headerImagePath)
    return { src, colourwayPhotoMissing: false }
  }

  if (live.sku) return resolveSkuImage(live.sku)

  const frozenThumb = nonEmpty(assignment.thumbUrl)
  const frozenFamily = nonEmpty(assignment.familyImageUrl)
  const colourwayThumb = frozenThumb && frozenThumb !== frozenFamily ? frozenThumb : null

  const src = nonEmpty(assignment.skuImageUrl) ?? colourwayThumb
  return { src, colourwayPhotoMissing: src === null }
}
