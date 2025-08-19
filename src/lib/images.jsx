// src/lib/images.js
import { storage } from "../firebase";
import { ref, getDownloadURL } from "firebase/storage";

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
