/**
 * PDF Image Processor
 *
 * Handles image cropping and optimization for PDF export.
 * Respects user-defined focal points (referenceImageCrop) to ensure
 * important parts of images are visible in the PDF output.
 */

/**
 * Load an image from URL and return an Image element
 *
 * @param {string} url - Image URL or data URL
 * @param {Object} options - Loading options
 * @param {string|null} options.crossOrigin - CORS mode: 'anonymous', 'use-credentials', or null to disable
 * @returns {Promise<HTMLImageElement>} Loaded image element
 */
async function loadImage(url, options = {}) {
  const { crossOrigin = 'anonymous' } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();

    // Only set crossOrigin if provided (null disables CORS)
    if (crossOrigin !== null) {
      img.crossOrigin = crossOrigin;
    }

    img.onload = () => resolve(img);
    img.onerror = (event) => {
      // Provide helpful error message for CORS issues
      const errorMsg = crossOrigin
        ? `Failed to load image with CORS (${crossOrigin}): ${url}. Image may not have proper CORS headers.`
        : `Failed to load image: ${url}`;
      reject(new Error(errorMsg));
    };

    img.src = url;
  });
}

/**
 * Crop an image to a specific aspect ratio centered on a focal point
 *
 * @param {HTMLImageElement} img - Source image element
 * @param {Object} cropPosition - Focal point {x: 0-100, y: 0-100}
 * @param {number} targetWidth - Target width in pixels
 * @param {number} targetHeight - Target height in pixels
 * @param {number} quality - JPEG quality (0.0 - 1.0)
 * @returns {string} Data URL of the cropped image
 */
function cropImageToFocalPoint(img, cropPosition, targetWidth, targetHeight, quality = 0.85) {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');

  // Convert crop position percentages to 0-1 range
  const focalX = (cropPosition?.x ?? 50) / 100;
  const focalY = (cropPosition?.y ?? 50) / 100;

  // Calculate target aspect ratio
  const targetRatio = targetWidth / targetHeight;
  const imgRatio = img.width / img.height;

  let srcW, srcH, srcX, srcY;

  if (imgRatio > targetRatio) {
    // Image is wider than target - crop horizontally
    srcH = img.height;
    srcW = srcH * targetRatio;

    // Center crop area on focal point X
    srcX = (focalX * img.width) - (srcW / 2);

    // Clamp to image boundaries
    srcX = Math.max(0, Math.min(srcX, img.width - srcW));
    srcY = 0;
  } else {
    // Image is taller than target - crop vertically
    srcW = img.width;
    srcH = srcW / targetRatio;

    // Center crop area on focal point Y
    srcY = (focalY * img.height) - (srcH / 2);

    // Clamp to image boundaries
    srcY = Math.max(0, Math.min(srcY, img.height - srcH));
    srcX = 0;
  }

  // Draw the cropped portion
  ctx.drawImage(
    img,
    srcX, srcY, srcW, srcH,  // Source rectangle
    0, 0, targetWidth, targetHeight  // Destination rectangle
  );

  // Convert to data URL
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Process an image for PDF export with proper cropping
 *
 * @param {string} imageUrl - Source image URL or data URL
 * @param {Object} options - Processing options
 * @param {Object} options.cropPosition - Focal point {x: 0-100, y: 0-100}
 * @param {number} options.targetWidth - Target width in pixels
 * @param {number} options.targetHeight - Target height in pixels
 * @param {number} options.quality - JPEG quality (0.0 - 1.0), default 0.85
 * @param {string|null} options.crossOrigin - CORS mode: 'anonymous', 'use-credentials', or null
 * @returns {Promise<string>} Data URL of the processed image
 */
export async function processImageForPDF(imageUrl, options = {}) {
  const {
    cropPosition = { x: 50, y: 50 },
    targetWidth = 600,
    targetHeight = 450,
    quality = 0.85,
    crossOrigin = 'anonymous',
  } = options;

  try {
    // Load the image with CORS configuration
    const img = await loadImage(imageUrl, { crossOrigin });

    // Crop to focal point
    const croppedDataUrl = cropImageToFocalPoint(
      img,
      cropPosition,
      targetWidth,
      targetHeight,
      quality
    );

    return croppedDataUrl;
  } catch (error) {
    console.error('Error processing image for PDF:', error);
    throw error;
  }
}

/**
 * Calculate optimal concurrency for image processing based on device capabilities
 *
 * @returns {number} Optimal concurrency limit (1-10)
 */
function getOptimalConcurrency() {
  // Use half of available CPU cores, bounded between 2 and 10
  const cores = typeof navigator !== 'undefined' && navigator.hardwareConcurrency
    ? navigator.hardwareConcurrency
    : 4; // Default to 4 if not available

  const optimal = Math.ceil(cores / 2);
  return Math.max(2, Math.min(optimal, 10));
}

/**
 * Process multiple images in parallel for PDF export
 *
 * @param {Array} images - Array of image objects with {url, cropPosition}
 * @param {Object} options - Processing options
 * @param {number} options.targetWidth - Target width in pixels
 * @param {number} options.targetHeight - Target height in pixels
 * @param {number} options.quality - JPEG quality (0.0 - 1.0)
 * @param {string|null} options.crossOrigin - CORS mode for all images
 * @param {number} options.concurrency - Max concurrent image processing (default: auto-detected)
 * @param {Function} options.onProgress - Progress callback (processedCount, totalCount)
 * @returns {Promise<Array>} Array of processed data URLs in same order
 */
export async function processBatchImages(images, options = {}) {
  const { onProgress, concurrency } = options;
  const results = new Array(images.length);
  let processedCount = 0;

  // Use provided concurrency or calculate optimal value
  const CONCURRENCY = concurrency ?? getOptimalConcurrency();
  const chunks = [];

  for (let i = 0; i < images.length; i += CONCURRENCY) {
    chunks.push(images.slice(i, i + CONCURRENCY));
  }

  for (const chunk of chunks) {
    const promises = chunk.map(async (image, index) => {
      try {
        const dataUrl = await processImageForPDF(image.url, {
          cropPosition: image.cropPosition,
          targetWidth: options.targetWidth,
          targetHeight: options.targetHeight,
          quality: options.quality,
          crossOrigin: options.crossOrigin,
        });

        const absoluteIndex = images.indexOf(image);
        results[absoluteIndex] = dataUrl;

        processedCount++;
        if (onProgress) {
          onProgress(processedCount, images.length);
        }

        return dataUrl;
      } catch (error) {
        console.error(`Error processing image ${image.url}:`, error);
        const absoluteIndex = images.indexOf(image);
        results[absoluteIndex] = null; // Mark as failed
        return null;
      }
    });

    await Promise.all(promises);
  }

  return results;
}

/**
 * Get optimal image dimensions based on density preset
 *
 * @param {string} densityId - One of: 'compact', 'standard', 'detailed'
 * @returns {Object} {width, height} in pixels
 */
export function getOptimalImageDimensions(densityId = 'standard') {
  const dimensionMap = {
    compact: { width: 400, height: 300 },    // Smaller for compact layouts
    standard: { width: 600, height: 450 },   // Balanced quality/size
    detailed: { width: 800, height: 600 },   // Larger for detailed layouts
  };

  return dimensionMap[densityId] || dimensionMap.standard;
}

/**
 * Estimate processing time for a batch of images
 *
 * @param {number} imageCount - Number of images to process
 * @returns {number} Estimated time in milliseconds
 */
export function estimateProcessingTime(imageCount) {
  // Rough estimate: ~200ms per image
  const timePerImage = 200;
  return imageCount * timePerImage;
}

/**
 * Create a preview thumbnail from an image with crop position
 *
 * @param {string} imageUrl - Source image URL
 * @param {Object} cropPosition - Focal point {x: 0-100, y: 0-100}
 * @param {number} size - Thumbnail size (square)
 * @param {string|null} crossOrigin - CORS mode
 * @returns {Promise<string>} Data URL of the thumbnail
 */
export async function createThumbnail(imageUrl, cropPosition = { x: 50, y: 50 }, size = 100, crossOrigin = 'anonymous') {
  return processImageForPDF(imageUrl, {
    cropPosition,
    targetWidth: size,
    targetHeight: size,
    quality: 0.7,
    crossOrigin,
  });
}
