/**
 * previewImageStage.js
 *
 * Pure helper for computing preview image stage aspect ratios.
 * Used by LightweightExportPreview to display product images without cropping.
 */

/**
 * Computes the optimal CSS aspect-ratio value for an image stage container.
 *
 * The stage uses contain-fit so the full product is always visible.
 * This function determines a harmonious stage ratio based on image orientation:
 * - Portrait (h > w * 1.1): "4 / 5" (common e-commerce ratio)
 * - Landscape (w > h * 1.1): "16 / 9" (widescreen)
 * - Square-ish: "1 / 1"
 *
 * @param {{ naturalWidth: number, naturalHeight: number }} dimensions
 * @returns {string} CSS aspect-ratio value like "4 / 5"
 */
export function computePreviewImageStageRatio({ naturalWidth, naturalHeight }) {
  // Guard against invalid dimensions
  if (!naturalWidth || !naturalHeight || naturalWidth <= 0 || naturalHeight <= 0) {
    return '4 / 5'; // Default to portrait (most common for e-comm products)
  }

  const ratio = naturalWidth / naturalHeight;

  // Portrait: height > width * 1.1 means ratio < ~0.91
  if (ratio < 0.91) {
    return '4 / 5';
  }

  // Landscape: width > height * 1.1 means ratio > ~1.1
  if (ratio > 1.1) {
    return '16 / 9';
  }

  // Square-ish
  return '1 / 1';
}

/**
 * Default aspect ratio to use before image dimensions are known.
 * Using portrait as e-comm imagery is most commonly portrait.
 */
export const DEFAULT_PREVIEW_STAGE_RATIO = '4 / 5';

/**
 * Minimum number of images required before switching from default ratio.
 * This prevents flip-flop when only 1 image has loaded.
 */
export const MIN_IMAGES_FOR_DOMINANT_BUCKET = 2;

/**
 * Bucket names for image orientation classification.
 * @typedef {'portrait' | 'landscape' | 'square'} OrientationBucket
 */

/**
 * Maps a bucket name to its corresponding CSS aspect-ratio value.
 * @type {Record<OrientationBucket, string>}
 */
const BUCKET_TO_RATIO = {
  portrait: '4 / 5',
  landscape: '16 / 9',
  square: '1 / 1',
};

/**
 * Classifies dimensions into an orientation bucket.
 *
 * @param {{ naturalWidth: number, naturalHeight: number }} dimensions
 * @returns {OrientationBucket}
 */
export function classifyImageBucket({ naturalWidth, naturalHeight }) {
  if (!naturalWidth || !naturalHeight || naturalWidth <= 0 || naturalHeight <= 0) {
    return 'portrait'; // Default bucket for invalid dimensions
  }

  const ratio = naturalWidth / naturalHeight;

  if (ratio < 0.91) {
    return 'portrait';
  }
  if (ratio > 1.1) {
    return 'landscape';
  }
  return 'square';
}

/**
 * Computes the dominant orientation bucket from an array of image dimensions.
 * Returns the CSS aspect-ratio for the bucket with the most images.
 *
 * When there's a tie, priority order: portrait > square > landscape
 * (portrait is most common for e-commerce imagery).
 *
 * @param {Array<{ naturalWidth: number, naturalHeight: number }>} dimensionsArray
 * @returns {{ ratio: string, bucketCounts: Record<OrientationBucket, number>, totalLoaded: number }}
 */
export function computeDominantBucket(dimensionsArray) {
  const counts = { portrait: 0, landscape: 0, square: 0 };

  for (const dims of dimensionsArray) {
    const bucket = classifyImageBucket(dims);
    counts[bucket]++;
  }

  const totalLoaded = counts.portrait + counts.landscape + counts.square;

  // Find dominant bucket (with tie-breaker priority: portrait > square > landscape)
  let dominant = 'portrait';
  let maxCount = counts.portrait;

  if (counts.square > maxCount) {
    dominant = 'square';
    maxCount = counts.square;
  }
  if (counts.landscape > maxCount) {
    dominant = 'landscape';
  }

  return {
    ratio: BUCKET_TO_RATIO[dominant],
    bucketCounts: counts,
    totalLoaded,
  };
}
