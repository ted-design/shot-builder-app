/**
 * Export Image Options — Canonical normalization
 *
 * `options.fields.image` is the ONLY canonical image flag.
 * All other image-related booleans (includeImages, inlineImages,
 * fallbackToProductImages) are DERIVED from it and must never diverge.
 *
 * Every export surface (Lightweight preview, PDF preview, PDF export)
 * must pass options through normalizeExportImageFlags() before use.
 */

export interface ExportImageFlags {
  fields?: { image?: boolean; [key: string]: unknown };
  includeImages?: boolean;
  fallbackToProductImages?: boolean;
  inlineImages?: boolean;
  [key: string]: unknown;
}

/**
 * Normalize an export options object so that all image-related booleans
 * are consistent with the single canonical flag: `fields.image`.
 *
 * Returns a new object (shallow copy) with overwritten image flags.
 * After this function runs, `fields.image` and `includeImages` always match.
 */
export function normalizeExportImageFlags<T extends ExportImageFlags>(options: T): T {
  const canonical = Boolean(
    options?.fields?.image ?? options?.includeImages ?? false
  );

  return {
    ...options,
    fields: {
      ...(options?.fields ?? {}),
      image: canonical,
    },
    includeImages: canonical,
    fallbackToProductImages: canonical
      ? Boolean(options?.fallbackToProductImages ?? true)
      : false,
    inlineImages: canonical
      ? Boolean(options?.inlineImages ?? true)
      : false,
  };
}

/**
 * Pure decision function: should the PDF renderer display an image for a shot?
 *
 * This is the single gating function that the PDF renderer should use.
 * It checks ONLY `options.fields.image` (the canonical flag) and the
 * presence of image data on the shot.
 *
 * @param options  - Normalized export options (must have fields.image)
 * @param shot     - Shot object with optional image and productImages
 * @param hasProductFallback - Whether a product image fallback is available
 * @returns true if the renderer should attempt to render an image
 */
export function shouldRenderExportImage(
  options: { fields?: { image?: boolean }; fallbackToProductImages?: boolean },
  shot: { image?: string | null; productImages?: (string | null)[] } | null | undefined,
  hasProductFallback = false
): boolean {
  // Canonical gate: if fields.image is false, never render images
  if (!options?.fields?.image) return false;

  // Shot has a direct image (and it's not a placeholder)
  if (shot?.image && shot.image !== '__PREVIEW_PLACEHOLDER__') return true;

  // Fallback to product images if enabled
  if (options.fallbackToProductImages && hasProductFallback) return true;

  return false;
}
