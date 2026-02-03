import { useState, useEffect } from "react"
import {
  resolveStoragePath,
  getCachedUrl,
} from "@/shared/lib/resolveStoragePath"

/**
 * Resolve a Firebase Storage path to a download URL.
 * Returns the cached URL synchronously when available, otherwise resolves async.
 * Returns undefined while loading or if the path is undefined/empty.
 */
export function useStorageUrl(path: string | undefined): string | undefined {
  const [url, setUrl] = useState<string | undefined>(() =>
    path ? getCachedUrl(path) : undefined,
  )

  useEffect(() => {
    if (!path) {
      setUrl(undefined)
      return
    }

    const cached = getCachedUrl(path)
    if (cached) {
      setUrl(cached)
      return
    }

    let cancelled = false
    resolveStoragePath(path)
      .then((resolved) => {
        if (!cancelled) setUrl(resolved)
      })
      .catch(() => {
        if (!cancelled) setUrl(undefined)
      })

    return () => {
      cancelled = true
    }
  }, [path])

  return url
}
