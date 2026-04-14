// src/lib/images.js
//
// Image compression and optimization utilities
//
// AUTOMATIC WEBP CONVERSION:
// All images uploaded through compressImageFile are automatically converted to WebP format
// for better compression and smaller file sizes. This happens transparently - JPG, PNG, and
// other formats are converted during the compression process.
//
// Benefits:
// - 25-35% smaller file sizes compared to JPEG (same quality)
// - 25-50% smaller than PNG for most images
// - Reduced storage costs
// - Faster page loads
// - Better user experience
//
// Browser support: All modern browsers (Chrome, Firefox, Safari 14+, Edge)

import { storage } from "./firebase";
import { ref, getDownloadURL } from "firebase/storage";
export { compressImageFile, formatFileSize } from "./imageCompression";

/** Build the path for a resized copy created by the Resize Images extension */
export const resizedPath = (originalPath, size = 200) =>
  originalPath.replace(/(\.[^./]+)$/, `_${size}x${size}$1`);

/** Prefer resized URL; if not generated yet, fall back to original */
export async function getBestImageUrl(originalPath, size = 200) {
  if (!originalPath) return null;
  try {
    const url200 = await getDownloadURL(ref(storage, resizedPath(originalPath, size)));
    return url200;
  } catch (_) {
    // resized not ready (or disabled) – fall back to original
    return await getDownloadURL(ref(storage, originalPath));
  }
}

// Note: compression helpers are re-exported from ./imageCompression to avoid circular deps with firebase
