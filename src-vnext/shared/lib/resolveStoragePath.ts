import { ref, getDownloadURL } from "firebase/storage"
import { storage } from "@/shared/lib/firebase"

interface CacheEntry {
  readonly url: string
  readonly expiry: number
}

const TTL = 30 * 60 * 1000 // 30 minutes
const cache = new Map<string, CacheEntry>()
const pending = new Map<string, Promise<string>>()

/**
 * Returns true if the value is already a usable URL (not a storage path).
 */
export function isUrl(value: string): boolean {
  return (
    value.startsWith("https://") ||
    value.startsWith("http://") ||
    value.startsWith("data:") ||
    value.startsWith("blob:")
  )
}

/**
 * Resolve a Firebase Storage path to a download URL.
 * Results are cached in-memory for 30 minutes.
 * Deduplicates in-flight requests for the same path.
 */
export async function resolveStoragePath(path: string): Promise<string> {
  if (isUrl(path)) return path

  const cached = cache.get(path)
  if (cached && cached.expiry > Date.now()) return cached.url

  const inflight = pending.get(path)
  if (inflight) return inflight

  const request = getDownloadURL(ref(storage, path)).then((url) => {
    cache.set(path, { url, expiry: Date.now() + TTL })
    pending.delete(path)
    return url
  }).catch((err) => {
    pending.delete(path)
    throw err
  })

  pending.set(path, request)
  return request
}

/**
 * Synchronously check the cache for a previously resolved URL.
 * Returns undefined if not cached or expired.
 */
export function getCachedUrl(path: string): string | undefined {
  if (isUrl(path)) return path
  const cached = cache.get(path)
  if (cached && cached.expiry > Date.now()) return cached.url
  return undefined
}
