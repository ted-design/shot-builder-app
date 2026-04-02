import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { storage } from "@/shared/lib/firebase"
import { compressImageToWebp, validateImageFileForUpload } from "@/shared/lib/uploadImage"

/**
 * Upload an image for use in the Export Builder.
 * Validates, compresses to WebP, uploads to Firebase Storage,
 * and returns the public download URL.
 */
export async function uploadExportImage(
  file: File,
  clientId: string,
  projectId: string,
): Promise<string> {
  validateImageFileForUpload(file)

  const blob = await compressImageToWebp(file)
  const timestamp = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
  const path = `clients/${clientId}/export-images/${projectId}/${String(timestamp)}-${safeName}`

  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, blob, { contentType: "image/webp" })
  return getDownloadURL(storageRef)
}
