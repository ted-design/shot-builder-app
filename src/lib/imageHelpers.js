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
    return primary?.path || null;
  }

  // Fall back to legacy format
  return shot.referenceImagePath || null;
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
 * @returns {Object} - Object with path and style properties
 */
export function getPrimaryAttachmentWithStyle(shot) {
  if (!shot) return { path: null, style: {} };

  const attachment = shot.attachments && shot.attachments.length > 0
    ? getPrimaryAttachment(shot.attachments)
    : null;

  if (!attachment) {
    // Legacy format
    return {
      path: shot.referenceImagePath || null,
      style: { objectFit: "cover", width: "100%", height: "100%" },
    };
  }

  return {
    path: attachment.path,
    style: getAttachmentImageStyle(attachment),
  };
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
