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
 * Calculate CSS transform style from cropData
 * @param {Object} cropData - Crop data object with x, y, zoom, rotation
 * @returns {Object} - CSS style object with transform property
 */
export function getCropTransformStyle(cropData) {
  if (!cropData) return {};

  const { x = 0, y = 0, zoom = 1, rotation = 0 } = cropData;

  return {
    transform: `translate(-${x}%, -${y}%) scale(${zoom}) rotate(${rotation}deg)`,
    transformOrigin: "center",
  };
}

/**
 * Convert crop data to CSS objectPosition value for focal point positioning.
 * This is the preferred method for positioning images within containers
 * as it works correctly with objectFit: "cover".
 *
 * @param {Object} cropData - Crop data object with x, y coordinates (0-100 range)
 * @returns {string|undefined} - CSS objectPosition value (e.g., "30% 20%") or undefined if no crop data
 */
export function getCropObjectPosition(cropData) {
  if (!cropData) return undefined;

  // x, y represent the focal point as percentages (0-100)
  // Default to center (50%, 50%) if not specified
  const { x = 50, y = 50 } = cropData;

  return `${x}% ${y}%`;
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
 * Get best-available image for a shot with product fallback.
 * Order of precedence:
 *  1) Primary attachment (with crop style)
 *  2) Legacy referenceImagePath
 *  3) First available product image (thumbnailImagePath, images[0], or colourImagePath)
 *
 * @param {Object} shot
 * @param {Array} products - Normalised product entries for the shot
 * @returns {{ path: string|null, style: Object }}
 */
export function getImageWithFallback(shot, products = []) {
  const defaultStyle = { objectFit: "cover", width: "100%", height: "100%" };

  // Prefer primary attachment or legacy reference image
  const primary = getPrimaryAttachmentWithStyle(shot);
  if (primary?.path) return primary;

  // Legacy single-image fields on the shot itself
  const legacyCandidates = [
    shot?.referenceImagePath,
    shot?.previewImageUrl,
    shot?.thumbnailUrl,
    shot?.thumbnailImagePath,
    shot?.imageUrl,
  ];
  const legacyPath = legacyCandidates.find((value) => typeof value === "string" && value.trim().length);
  if (legacyPath) {
    return { path: legacyPath, style: defaultStyle };
  }

  // Fallback to product imagery
  const list = Array.isArray(products) ? products : [];
  for (const product of list) {
    if (!product) continue;
    if (product.thumbnailImagePath) {
      return { path: product.thumbnailImagePath, style: defaultStyle };
    }
    if (Array.isArray(product.images) && product.images.length) {
      const candidate = product.images.find(Boolean);
      if (candidate) return { path: candidate, style: defaultStyle };
    }
    if (product.colourImagePath) {
      return { path: product.colourImagePath, style: defaultStyle };
    }
  }
  return { path: null, style: {} };
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
