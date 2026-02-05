import { getBlob, ref } from "firebase/storage"
import { isUrl } from "@/shared/lib/resolveStoragePath"
import { storage } from "@/shared/lib/firebase"

const cache = new Map<string, string | null>()
const pending = new Map<string, Promise<string | null>>()

const MAX_DIMENSION_PX = 1000
const JPEG_QUALITY = 0.86

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("Failed to read image data"))
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(blob)
  })
}

function parseFirebaseDownloadUrlToStoragePath(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.hostname !== "firebasestorage.googleapis.com") return null
    const marker = "/o/"
    const idx = parsed.pathname.indexOf(marker)
    if (idx === -1) return null
    const encoded = parsed.pathname.slice(idx + marker.length)
    return decodeURIComponent(encoded)
  } catch {
    return null
  }
}

async function fetchBlobFromUrl(url: string): Promise<Blob> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch image (${response.status})`)
  }
  return await response.blob()
}

async function convertBlobToJpegDataUrl(blob: Blob): Promise<string> {
  if (typeof document === "undefined") {
    throw new Error("PDF image conversion requires a browser environment")
  }
  if (typeof createImageBitmap !== "function") {
    throw new Error("PDF image conversion requires createImageBitmap support")
  }

  const bitmap = await createImageBitmap(blob)
  const scale = Math.min(1, MAX_DIMENSION_PX / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Missing canvas 2d context")

  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  return canvas.toDataURL("image/jpeg", JPEG_QUALITY)
}

/**
 * Resolve an image reference (storage path or URL) into a data URL that
 * @react-pdf/renderer can embed reliably (supports PNG/JPEG; converts WebP/etc).
 */
export async function resolvePdfImageSrc(candidate: string): Promise<string | null> {
  const cached = cache.get(candidate)
  if (cached !== undefined) return cached

  const inflight = pending.get(candidate)
  if (inflight) return inflight

  const request = (async () => {
    try {
      let blob: Blob | null = null

      if (isUrl(candidate)) {
        try {
          blob = await fetchBlobFromUrl(candidate)
        } catch (err) {
          const asPath = parseFirebaseDownloadUrlToStoragePath(candidate)
          if (!asPath) throw err
          blob = await getBlob(ref(storage, asPath))
        }
      } else {
        blob = await getBlob(ref(storage, candidate))
      }

      const type = (blob.type || "").toLowerCase()
      if (type === "image/png" || type === "image/jpeg" || type === "image/jpg") {
        return await blobToDataUrl(blob)
      }
      if (type.startsWith("image/")) {
        return await convertBlobToJpegDataUrl(blob)
      }

      // Unknown content type: try converting anyway (will throw if not decodable).
      return await convertBlobToJpegDataUrl(blob)
    } catch (err) {
      console.warn("[resolvePdfImageSrc] Failed to embed image:", err)
      return null
    }
  })()

  pending.set(candidate, request)
  return request.finally(() => {
    pending.delete(candidate)
  }).then((src) => {
    cache.set(candidate, src)
    return src
  })
}

