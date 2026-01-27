/**
 * Image Helpers - Utilities for handling image display with crop data
 */

/**
 * Get the primary attachment from a shot's attachments array
 * @param {Array} attachments - Array of attachment objects
 * @returns {Object|null} - Primary attachment or null if none found
 */
export function getPrimaryAttachment(attachments) {
  if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
    return null;
  }

  // Find the attachment marked as primary
  const primary = attachments.find((att) => att.isPrimary);

  // If no primary found, return the first attachment
  return primary || attachments[0];
}

/**
 * Get the image path for a shot, supporting both new multi-image and legacy formats
 * @param {Object} shot - Shot object with attachments or referenceImagePath
 * @returns {string|null} - Image path or null
 */
export function getShotImagePath(shot) {
  if (!shot) return null;

  // Try new multi-image format first
  if (shot.attachments && Array.isArray(shot.attachments) && shot.attachments.length > 0) {
    const primary = getPrimaryAttachment(shot.attachments);
    return primary?.downloadURL || primary?.path || null;
  }

  // Fall back to legacy format
  if (shot.referenceImagePath) return shot.referenceImagePath;
  if (shot.downloadURL) return shot.downloadURL;

  // Fall back to product images (useful when shots don't have a dedicated image)
  const products = Array.isArray(shot.products) ? shot.products : [];
  for (const product of products) {
    if (!product) continue;
    if (product.thumbnailImagePath) return product.thumbnailImagePath;
    if (Array.isArray(product.images)) {
      const candidate = product.images.find(Boolean);
      if (candidate) return candidate;
    }
    if (product.colourImagePath) return product.colourImagePath;
  }

  return null;
}

/**
 * Calculate CSS transform style from cropData for zoom/rotation.
 * S.4: The crop data contains x/y/width/height (crop rectangle as % of image),
 * plus zoom and rotation. For correct rendering:
 * - We scale by zoom
 * - We rotate by rotation degrees
 * - We use transformOrigin at the focal point (center of crop area)
 *
 * @param {Object} cropData - Crop data object with x, y, width, height, zoom, rotation
 * @returns {Object} - CSS style object with transform and transformOrigin
 */
export function getCropTransformStyle(cropData) {
  if (!cropData) return {};

  const { x = 0, y = 0, width = 100, height = 100, zoom = 1, rotation = 0 } = cropData;

  // Calculate the focal point (center of crop area)
  const focalX = x + width / 2;
  const focalY = y + height / 2;

  return {
    transform: `scale(${zoom}) rotate(${rotation}deg)`,
    transformOrigin: `${focalX}% ${focalY}%`,
  };
}

/**
 * Convert crop data to CSS objectPosition value for focal point positioning.
 * This is the preferred method for positioning images within containers
 * as it works correctly with objectFit: "cover".
 *
 * S.4: The cropData x/y/width/height describe the crop rectangle as percentages of the image.
 * The focal point is the CENTER of the crop area, which is what object-position should use.
 *
 * @param {Object} cropData - Crop data object with x, y, width, height (0-100 range)
 * @returns {string|undefined} - CSS objectPosition value (e.g., "35% 50%") or undefined if no crop data
 */
export function getCropObjectPosition(cropData) {
  if (!cropData) return undefined;

  // x, y are the top-left corner of the crop rectangle as percentages
  // width, height are the dimensions of the crop rectangle as percentages
  // The focal point is the CENTER of the crop area
  const { x = 0, y = 0, width = 100, height = 100 } = cropData;

  // Calculate the center of the crop area (focal point)
  const focalX = x + width / 2;
  const focalY = y + height / 2;

  return `${focalX}% ${focalY}%`;
}

/**
 * Get image style for display with crop data applied
 * @param {Object} attachment - Attachment object with optional cropData
 * @returns {Object} - Complete style object for image display
 */
export function getAttachmentImageStyle(attachment) {
  if (!attachment) return {};

  const baseStyle = {
    objectFit: "cover",
    width: "100%",
    height: "100%",
  };

  if (!attachment.cropData) return baseStyle;

  return {
    ...baseStyle,
    ...getCropTransformStyle(attachment.cropData),
  };
}

/**
 * Get primary attachment with its display-ready style
 * @param {Object} shot - Shot object
 * @returns {Object} - Object with path, style, and objectPosition properties
 */
export function getPrimaryAttachmentWithStyle(shot) {
  if (!shot) return { path: null, style: {}, objectPosition: undefined };

  const attachment = shot.attachments && shot.attachments.length > 0
    ? getPrimaryAttachment(shot.attachments)
    : null;

  if (!attachment) {
    // Legacy format - no crop data available
    return {
      path: shot.referenceImagePath || null,
      style: { objectFit: "cover", width: "100%", height: "100%" },
      objectPosition: undefined,
    };
  }

  return {
    path: attachment.path || attachment.downloadURL,
    style: getAttachmentImageStyle(attachment),
    objectPosition: getCropObjectPosition(attachment.cropData),
  };
}

/**
 * Cover source types for shot cover image indicator (S.3)
 * @type {Object.<string, string>}
 */
export const COVER_SOURCE = {
  /** Cover is a manually designated reference image (displayImageId) */
  REFERENCE: "ref",
  /** Cover is from hero product (heroProductId) */
  HERO_PRODUCT: "hero",
  /** Cover is auto-selected from fallback chain */
  AUTO: "auto",
};

/**
 * Cover source labels for display (S.3)
 * Maps source type to short display label
 * @type {Object.<string, string>}
 */
export const COVER_SOURCE_LABELS = {
  [COVER_SOURCE.REFERENCE]: "REF",
  [COVER_SOURCE.HERO_PRODUCT]: "HERO",
  [COVER_SOURCE.AUTO]: "AUTO",
};

/**
 * Determine the cover source type for a shot.
 * Used to display small indicator badges showing where the cover image comes from.
 *
 * @param {Object} shot - Shot object with optional looks array
 * @returns {string} - One of COVER_SOURCE values: "ref", "hero", or "auto"
 */
export function getCoverSourceType(shot) {
  if (!shot) return COVER_SOURCE.AUTO;

  const looks = shot.looks || [];

  // Check for displayImageId with valid reference (Priority 1)
  for (const look of looks) {
    if (look.displayImageId && Array.isArray(look.references)) {
      const displayRef = look.references.find((ref) => ref.id === look.displayImageId);
      if (displayRef) {
        return COVER_SOURCE.REFERENCE;
      }
    }
  }

  // Check for heroProductId (Priority 2)
  for (const look of looks) {
    if (look.heroProductId && Array.isArray(look.products)) {
      const heroProduct = look.products.find((p) => p.productId === look.heroProductId);
      if (heroProduct?.colourImagePath || heroProduct?.thumbnailImagePath) {
        return COVER_SOURCE.HERO_PRODUCT;
      }
    }
  }

  // Everything else is auto/fallback
  return COVER_SOURCE.AUTO;
}

/**
 * Unified shot cover image resolver - single source of truth for all views.
 *
 * Priority order (matches V3 Look-aware gallery behavior):
 *  1) look.displayImageId → designated reference from any Look
 *  2) Hero product image (heroProductId) from first Look with hero
 *  3) First reference image from first Look with references
 *  4) Primary attachment from shot.attachments[] (legacy multi-image)
 *  5) shot.referenceImagePath (legacy single image)
 *  6) Product images from shot.products[] or products param (legacy fallback)
 *
 * @param {Object} shot - Shot object with optional looks, attachments, products
 * @param {Array} products - Normalised product entries for fallback
 * @returns {string|null} - Image URL/path or null if no image found
 */
export function resolveShotCoverImage(shot, products = []) {
  if (!shot) return null;

  const looks = shot.looks || [];

  // Priority 1: Designated display image from looks (F.5)
  // Defensive: if displayImageId points to a missing reference, treat as unset and continue fallback
  for (const look of looks) {
    if (look.displayImageId && Array.isArray(look.references)) {
      const displayRef = look.references.find((ref) => ref.id === look.displayImageId);
      // Only return if reference actually exists (handles deleted reference edge case)
      if (displayRef) {
        if (displayRef.downloadURL) return displayRef.downloadURL;
        if (displayRef.path) return displayRef.path;
      }
      // displayImageId set but reference not found - continue to next look/priority
    }
  }

  // Priority 2: Hero product image from first look with a hero
  for (const look of looks) {
    if (look.heroProductId && Array.isArray(look.products)) {
      const heroProduct = look.products.find((p) => p.productId === look.heroProductId);
      if (heroProduct?.colourImagePath) return heroProduct.colourImagePath;
      if (heroProduct?.thumbnailImagePath) return heroProduct.thumbnailImagePath;
    }
  }

  // Priority 3: First reference image from first look with references
  for (const look of looks) {
    if (Array.isArray(look.references) && look.references.length > 0) {
      const firstRef = look.references[0];
      if (firstRef?.downloadURL) return firstRef.downloadURL;
      if (firstRef?.path) return firstRef.path;
    }
  }

  // Priority 4: Primary attachment from new multi-image system (legacy)
  if (shot.attachments && Array.isArray(shot.attachments) && shot.attachments.length > 0) {
    const primary = shot.attachments.find((att) => att.isPrimary) || shot.attachments[0];
    if (primary?.downloadURL) return primary.downloadURL;
    if (primary?.path) return primary.path;
  }

  // Priority 5: Legacy reference/storyboard image
  if (shot.referenceImagePath) {
    return shot.referenceImagePath;
  }

  // Priority 6: Product images (fallback from shot.products or products param)
  const productList = Array.isArray(products) && products.length > 0
    ? products
    : Array.isArray(shot.products)
    ? shot.products
    : [];

  for (const product of productList) {
    if (!product) continue;
    if (product.thumbnailImagePath) return product.thumbnailImagePath;
    if (Array.isArray(product.images)) {
      const candidate = product.images.find(Boolean);
      if (candidate) return candidate;
    }
    if (product.colourImagePath) return product.colourImagePath;
  }

  return null;
}

/**
 * Get best-available image for a shot with product fallback.
 * Returns the image path along with style information for display.
 *
 * Uses resolveShotCoverImage() internally for consistent cover image selection
 * across all views (Gallery, Table, Planner).
 *
 * @param {Object} shot
 * @param {Array} products - Normalised product entries for the shot
 * @returns {{ path: string|null, style: Object }}
 */
export function getImageWithFallback(shot, products = []) {
  const defaultStyle = { objectFit: "cover", width: "100%", height: "100%" };

  // Use unified resolver for consistent cover image selection
  const imagePath = resolveShotCoverImage(shot, products);

  if (!imagePath) {
    return { path: null, style: {} };
  }

  return { path: imagePath, style: defaultStyle };
}

/**
 * Get attachment count for a shot
 * @param {Object} shot - Shot object
 * @returns {number} - Number of attachments
 */
export function getAttachmentCount(shot) {
  if (!shot) return 0;
  return shot.attachments?.length || 0;
}

/**
 * Check if shot has multiple attachments
 * @param {Object} shot - Shot object
 * @returns {boolean} - True if shot has more than one attachment
 */
export function hasMultipleAttachments(shot) {
  return getAttachmentCount(shot) > 1;
}

/**
 * Unified shot cover image resolver with crop data - single source of truth for all views.
 * Returns both the image path and associated crop data for consistent rendering.
 *
 * Priority order (mirrors resolveShotCoverImage S.2):
 *  1) look.displayImageId → designated reference from any Look (includes reference.cropData)
 *  2) Hero product image (heroProductId) from first Look with hero (cropData: null)
 *  3) First reference image from first Look with references (includes reference.cropData)
 *  4) Primary attachment from shot.attachments[] (includes attachment.cropData)
 *  5) shot.referenceImagePath with shot.referenceImageCrop (legacy single image)
 *  6) Product images from shot.products[] or products param (cropData: null)
 *
 * @param {Object} shot - Shot object with optional looks, attachments, products
 * @param {Array} products - Normalised product entries for fallback
 * @returns {{ path: string|null, cropData: Object|null }} - Image URL/path and cropData or nulls
 */
export function resolveShotCoverWithCrop(shot, products = []) {
  if (!shot) return { path: null, cropData: null };

  const looks = shot.looks || [];

  // Priority 1: Designated display image from looks (F.5)
  for (const look of looks) {
    if (look.displayImageId && Array.isArray(look.references)) {
      const displayRef = look.references.find((ref) => ref.id === look.displayImageId);
      if (displayRef) {
        const path = displayRef.downloadURL || displayRef.path || null;
        if (path) {
          return { path, cropData: displayRef.cropData || null };
        }
      }
    }
  }

  // Priority 2: Hero product image from first look with a hero (no crop data for products)
  for (const look of looks) {
    if (look.heroProductId && Array.isArray(look.products)) {
      const heroProduct = look.products.find((p) => p.productId === look.heroProductId);
      if (heroProduct?.colourImagePath) {
        return { path: heroProduct.colourImagePath, cropData: null };
      }
      if (heroProduct?.thumbnailImagePath) {
        return { path: heroProduct.thumbnailImagePath, cropData: null };
      }
    }
  }

  // Priority 3: First reference image from first look with references
  for (const look of looks) {
    if (Array.isArray(look.references) && look.references.length > 0) {
      const firstRef = look.references[0];
      const path = firstRef?.downloadURL || firstRef?.path || null;
      if (path) {
        return { path, cropData: firstRef.cropData || null };
      }
    }
  }

  // Priority 4: Primary attachment from new multi-image system (legacy)
  if (shot.attachments && Array.isArray(shot.attachments) && shot.attachments.length > 0) {
    const primary = shot.attachments.find((att) => att.isPrimary) || shot.attachments[0];
    const path = primary?.downloadURL || primary?.path || null;
    if (path) {
      return { path, cropData: primary.cropData || null };
    }
  }

  // Priority 5: Legacy reference/storyboard image with legacy crop
  if (shot.referenceImagePath) {
    return {
      path: shot.referenceImagePath,
      cropData: shot.referenceImageCrop || null,
    };
  }

  // Priority 6: Product images (fallback from shot.products or products param) - no crop data
  const productList = Array.isArray(products) && products.length > 0
    ? products
    : Array.isArray(shot.products)
    ? shot.products
    : [];

  for (const product of productList) {
    if (!product) continue;
    if (product.thumbnailImagePath) {
      return { path: product.thumbnailImagePath, cropData: null };
    }
    if (Array.isArray(product.images)) {
      const candidate = product.images.find(Boolean);
      if (candidate) {
        return { path: candidate, cropData: null };
      }
    }
    if (product.colourImagePath) {
      return { path: product.colourImagePath, cropData: null };
    }
  }

  return { path: null, cropData: null };
}
