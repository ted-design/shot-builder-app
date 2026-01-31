import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { storage } from "@/shared/lib/firebase"

const MAX_DIMENSION = 1600
const QUALITY = 0.82

/**
 * Compress an image file to WebP, constraining to MAX_DIMENSION on the longest side.
 * Returns a Blob ready for upload.
 */
function compressImage(file: File): Promise<Blob> {
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
  const blob = await compressImage(file)
  const storagePath = `clients/${clientId}/shots/${shotId}/hero.webp`
  const storageRef = ref(storage, storagePath)
  await uploadBytes(storageRef, blob, { contentType: "image/webp" })
  const downloadURL = await getDownloadURL(storageRef)
  return { path: storagePath, downloadURL }
}
