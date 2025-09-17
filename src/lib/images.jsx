// src/lib/images.js
import { storage } from "../firebase";
import { ref, getDownloadURL } from "firebase/storage";

const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_QUALITY = 0.82;
const DEFAULT_MAX_SIZE = 2.5 * 1024 * 1024; // 2.5 MB

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.onload = () => {
      const img = new Image();
      img.onload = () =>
        resolve({
          image: img,
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
          url: reader.result,
        });
      img.onerror = () => reject(new Error("Failed to load image preview"));
      img.src = typeof reader.result === "string" ? reader.result : "";
    };
    reader.readAsDataURL(file);
  });
}

function canvasToFile(canvas, originalFile, quality) {
  return new Promise((resolve, reject) => {
    const type = originalFile.type === "image/png" ? "image/png" : "image/jpeg";
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to compress image"));
          return;
        }
        const output = new File([blob], originalFile.name, {
          type: blob.type,
          lastModified: Date.now(),
        });
        resolve(output);
      },
      type,
      quality
    );
  });
}

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

export async function compressImageFile(file, options = {}) {
  if (typeof window === "undefined" || !file || !file.type?.startsWith("image/")) {
    return file;
  }

  const maxDimension = options.maxDimension || DEFAULT_MAX_DIMENSION;
  const maxWidth = options.maxWidth || maxDimension;
  const maxHeight = options.maxHeight || maxDimension;
  const quality = options.quality == null ? DEFAULT_QUALITY : options.quality;
  const targetSize = options.maxSizeBytes || DEFAULT_MAX_SIZE;

  const { image, width, height } = await loadImageFromFile(file);

  if (file.size <= targetSize && width <= maxWidth && height <= maxHeight) {
    return file;
  }

  const ratio = Math.min(1, maxWidth / width, maxHeight / height);

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const compressed = await canvasToFile(canvas, file, quality);
  return compressed.size < file.size ? compressed : file;
}

export function formatFileSize(bytes) {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
