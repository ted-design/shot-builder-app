/**
 * Export Image Resolver
 *
 * Provides utilities for resolving image sources (Firebase Storage paths, URLs, etc.)
 * to browser-loadable HTTP(S) URLs for use in export previews and PDF generation.
 *
 * Key responsibilities:
 * 1. Normalize various image source formats (string, object with path/url/src)
 * 2. Validate URLs for browser compatibility
 * 3. Resolve Firebase Storage paths to download URLs via adapters
 * 4. Provide caching to avoid redundant resolutions
 */

import { resolveImageSource, type StorageSource } from "./storage/adapters";

// In-memory cache for resolved URLs (keyed by normalized source)
const resolvedUrlCache = new Map<string, string>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cacheTimestamps = new Map<string, number>();

/**
 * Normalize various image source formats to a string.
 * Handles: strings, objects with path/fullPath/url/src properties.
 * Returns null for empty, placeholder, or invalid sources.
 */
export function normalizeImageSource(source: unknown): string | null {
  if (!source) return null;

  if (typeof source === "string") {
    const trimmed = source.trim();
    // Reject empty strings and placeholder markers
    if (
      trimmed.length === 0 ||
      trimmed === "__PREVIEW_PLACEHOLDER__" ||
      trimmed.startsWith("__")
    ) {
      return null;
    }
    return trimmed;
  }

  if (typeof source === "object" && source !== null) {
    const obj = source as Record<string, unknown>;
    // Try common path properties in order of preference
    const candidates = [obj.path, obj.fullPath, obj.url, obj.src];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.length > 0) {
        return candidate.trim();
      }
    }
  }

  return null;
}

/**
 * Check if a URL is valid for browser image loading.
 * Accepts: http://, https://, data:, blob: URLs
 */
export function isValidBrowserImageUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  return /^(https?:\/\/|data:|blob:)/i.test(trimmed);
}

/**
 * Check if a source is a Firebase Storage path (not a full URL).
 */
function isStoragePath(source: string): boolean {
  // Not a URL scheme we recognize
  if (/^(https?:\/\/|data:|blob:|gs:)/i.test(source)) {
    return false;
  }
  // Looks like a path (contains / and doesn't start with special chars)
  return source.includes("/") || source.includes(".");
}

/**
 * Get cache key for a source
 */
function getCacheKey(source: string): string {
  return source;
}

/**
 * Check if cached entry is still valid
 */
function isCacheValid(key: string): boolean {
  const timestamp = cacheTimestamps.get(key);
  if (!timestamp) return false;
  return Date.now() - timestamp < CACHE_TTL_MS;
}

/**
 * Resolve any image source to a browser-loadable URL.
 *
 * @param source - Image source (string path, URL, or object with path/url)
 * @param options - Optional abort signal
 * @returns HTTP(S) URL string, or null if resolution fails
 */
export async function resolveExportImageUrl(
  source: unknown,
  options?: { signal?: AbortSignal }
): Promise<string | null> {
  const normalized = normalizeImageSource(source);
  if (!normalized) return null;

  // Check cache first
  const cacheKey = getCacheKey(normalized);
  if (resolvedUrlCache.has(cacheKey) && isCacheValid(cacheKey)) {
    return resolvedUrlCache.get(cacheKey) ?? null;
  }

  // Already a valid browser URL - cache and return
  if (isValidBrowserImageUrl(normalized)) {
    resolvedUrlCache.set(cacheKey, normalized);
    cacheTimestamps.set(cacheKey, Date.now());
    return normalized;
  }

  // Reject clearly invalid patterns
  if (/^gs:/i.test(normalized)) {
    // gs:// URLs cannot be loaded directly - they need Firebase SDK
    // The adapter should handle this, but if it's a raw gs:// URL, reject
    console.warn("[exportImageResolver] Rejecting gs:// URL - use storage path instead:", normalized);
    return null;
  }

  // Try to resolve via storage adapter (Firebase, S3, etc.)
  if (isStoragePath(normalized)) {
    try {
      const result = await resolveImageSource(normalized as StorageSource, {
        signal: options?.signal,
      });
      if (result?.url && isValidBrowserImageUrl(result.url)) {
        // Cache the resolved URL
        resolvedUrlCache.set(cacheKey, result.url);
        cacheTimestamps.set(cacheKey, Date.now());
        return result.url;
      }
    } catch (e) {
      // Don't spam console in production for expected failures
      if (process.env.NODE_ENV === "development") {
        console.warn("[exportImageResolver] Failed to resolve:", normalized, e);
      }
    }
  }

  return null;
}

/**
 * Batch resolve multiple image sources with concurrency control.
 * Returns a Map of id → resolved URL (only includes successful resolutions).
 *
 * @param sources - Array of { id, source } objects
 * @param options - Optional abort signal and concurrency limit
 * @returns Map of id → resolved HTTP URL
 */
export async function resolveExportImageUrls(
  sources: Array<{ id: string; source: unknown }>,
  options?: { signal?: AbortSignal; concurrency?: number }
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  const concurrency = options?.concurrency ?? 4;

  // Process in chunks to control concurrency
  for (let i = 0; i < sources.length; i += concurrency) {
    if (options?.signal?.aborted) break;

    const chunk = sources.slice(i, i + concurrency);
    const chunkResults = await Promise.allSettled(
      chunk.map(async ({ id, source }) => {
        const url = await resolveExportImageUrl(source, { signal: options?.signal });
        return { id, url };
      })
    );

    for (const result of chunkResults) {
      if (result.status === "fulfilled" && result.value.url) {
        results.set(result.value.id, result.value.url);
      }
    }
  }

  return results;
}

/**
 * Clear the URL resolution cache.
 * Call this when storage tokens might have expired.
 */
export function clearExportImageCache(): void {
  resolvedUrlCache.clear();
  cacheTimestamps.clear();
}

/**
 * Get the current cache size (for debugging/monitoring).
 */
export function getExportImageCacheSize(): number {
  return resolvedUrlCache.size;
}
