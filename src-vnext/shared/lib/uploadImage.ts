import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { storage } from "@/shared/lib/firebase"

const MAX_DIMENSION = 1600
const QUALITY = 0.82
const MAX_INPUT_BYTES = 25 * 1024 * 1024
const MAX_STORAGE_BYTES_EXCLUSIVE = 10 * 1024 * 1024

/**
 * Compress an image file to WebP, constraining to MAX_DIMENSION on the longest side.
 * Returns a Blob ready for upload.
 */
function isHeicLike(file: File): boolean {
  const type = (file.type || "").toLowerCase()
  if (type === "image/heic" || type === "image/heif") return true
  const name = (file.name || "").toLowerCase()
  return name.endsWith(".heic") || name.endsWith(".heif")
}

export function validateImageFileForUpload(file: File): void {
  if (!file) throw new Error("No file selected.")
  if (!Number.isFinite(file.size) || file.size <= 0) throw new Error("File is empty.")
  if (file.size > MAX_INPUT_BYTES) throw new Error("Image is too large (max 25MB).")
  if (isHeicLike(file)) {
    throw new Error("HEIC images aren’t supported yet. Please upload a JPG or PNG.")
  }

  const type = (file.type || "").toLowerCase()
  const name = (file.name || "").toLowerCase()
  const allowedTypes = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"])
  const allowedExt = [".jpg", ".jpeg", ".png", ".webp"]

  if (type) {
    if (!allowedTypes.has(type)) {
      throw new Error("Unsupported image type. Please upload a JPG, PNG, or WebP.")
    }
    return
  }

  if (!allowedExt.some((ext) => name.endsWith(ext))) {
    throw new Error("Unsupported image type. Please upload a JPG, PNG, or WebP.")
  }
}

export function compressImageToWebp(file: File): Promise<Blob> {
  validateImageFileForUpload(file)

  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        reject(new Error("Canvas 2D context unavailable"))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Image compression failed"))
            return
          }
          if (blob.size >= MAX_STORAGE_BYTES_EXCLUSIVE) {
            reject(new Error("Image is too large after optimization (max 10MB)."))
            return
          }
          resolve(blob)
        },
        "image/webp",
        QUALITY,
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Failed to load image"))
    }

    img.src = url
  })
}

/**
 * Upload a hero image for a shot.
 * Compresses to WebP, uploads to Firebase Storage, returns { path, downloadURL }.
 */
export async function uploadHeroImage(
  file: File,
  clientId: string,
  shotId: string,
): Promise<{ path: string; downloadURL: string }> {
  const blob = await compressImageToWebp(file)
  const storagePath = `clients/${clientId}/shots/${shotId}/hero.webp`
  const storageRef = ref(storage, storagePath)
  await uploadBytes(storageRef, blob, { contentType: "image/webp" })
  const downloadURL = await getDownloadURL(storageRef)
  return { path: storagePath, downloadURL }
}

/**
 * Upload a reference image for a shot (e.g. per-look references).
 * Compresses to WebP, uploads to Firebase Storage, returns { path, downloadURL }.
 */
export async function uploadShotReferenceImage(
  file: File,
  clientId: string,
  shotId: string,
  referenceId: string,
): Promise<{ path: string; downloadURL: string }> {
  const blob = await compressImageToWebp(file)
  const storagePath = `clients/${clientId}/shots/${shotId}/references/${referenceId}.webp`
  const storageRef = ref(storage, storagePath)
  await uploadBytes(storageRef, blob, { contentType: "image/webp" })
  const downloadURL = await getDownloadURL(storageRef)
  return { path: storagePath, downloadURL }
}
