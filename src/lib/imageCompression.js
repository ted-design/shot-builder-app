// Image compression and optimization helpers without Firebase dependencies
//
// AUTOMATIC WEBP CONVERSION:
// All images passed through compressImageFile are converted to WebP for better compression.

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
    // Always convert to WebP for better compression and smaller file sizes
    const type = "image/webp";

    // Generate new filename with .webp extension
    const originalName = originalFile.name || "image";
    const baseName = originalName.replace(/\.[^.]+$/, ""); // Remove existing extension
    const newName = `${baseName}.webp`;

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to compress image"));
          return;
        }
        const output = new File([blob], newName, {
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

export async function compressImageFile(file, options = {}) {
  if (typeof window === "undefined" || !file || !file.type?.startsWith("image/")) {
    return file;
  }

  const maxDimension = options.maxDimension || DEFAULT_MAX_DIMENSION;
  const maxWidth = options.maxWidth || maxDimension;
  const maxHeight = options.maxHeight || maxDimension;
  const quality = options.quality == null ? DEFAULT_QUALITY : options.quality;
  const targetSize = options.maxSizeBytes || DEFAULT_MAX_SIZE;
  const convertToWebP = options.convertToWebP !== false; // default true

  const { image, width, height } = await loadImageFromFile(file);

  if (!convertToWebP && file.size <= targetSize && width <= maxWidth && height <= maxHeight) {
    return file;
  }

  const ratio = Math.min(1, maxWidth / width, maxHeight / height);

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  try {
    const compressed = await canvasToFile(canvas, file, quality);
    return compressed.size < file.size ? compressed : file;
  } catch (error) {
    console.warn("Image compression/conversion failed, using original file:", error);
    return file;
  }
}

export function formatFileSize(bytes) {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
