// src/lib/deleteImage.js
import { uploadImageFile, deleteImageByPath } from "./firebase";

/**
 * Upload a new image, update the Firestore doc with its path,
 * and delete the previous image from Storage (if it existed).
 */
export async function replaceImageField({
  file,
  folder,
  id,
  prevPath,
  setPathFn
}) {
  // Upload new file
  const { path } = await uploadImageFile(file, { folder, id });

  // Update Firestore with the new path
  await setPathFn(path);

  // Delete the old file (optional cleanup)
  if (prevPath) {
    try {
      await deleteImageByPath(prevPath);
    } catch (err) {
      console.warn("Failed to delete previous image:", err);
    }
  }
}
