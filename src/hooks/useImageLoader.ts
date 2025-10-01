import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resolveImageSource, type StorageAdapterResult, type StorageSource } from "../lib/storage/adapters";
import { readStorage, removeStorage, writeStorage } from "../lib/safeStorage";
import { withRetry } from "../lib/imageLoader";

type Status = "idle" | "loading" | "loaded" | "error";

type CacheEntry = {
  url: string;
  expiresAt: number;
  adapter?: string;
};

export type UseImageLoaderOptions = {
  preferredSize?: number;
  retries?: number;
  cacheTtlMs?: number;
  crossOrigin?: "" | "anonymous" | "use-credentials";
  onError?: (error: Error, context: { source: string | null; adapter?: string }) => void;
  enabled?: boolean;
  decode?: boolean;
  timeoutMs?: number;
};

export type UseImageLoaderState = {
  status: Status;
  url: string | null;
  error: Error | null;
  adapter?: string;
  reload: () => void;
  isLoading: boolean;
};

const DEFAULT_RETRIES = 2;
const DEFAULT_CACHE_TTL = 60 * 60 * 1000; // 60 minutes
const CACHE_PREFIX = "app:image-cache:v1:";
const memoryCache = new Map<string, CacheEntry>();

const isBrowser = typeof window !== "undefined";

const normaliseSource = (value: StorageSource): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (value && typeof value === "object") {
    if (typeof value.fullPath === "string" && value.fullPath.length) return value.fullPath;
    if (typeof value.path === "string" && value.path.length) return value.path;
    if (typeof value.src === "string" && value.src.length) return value.src;
  }
  return null;
};

const buildCacheKey = (source: string, preferredSize?: number) => `${source}::${preferredSize ?? "auto"}`;
const storageKeyFor = (key: string) => `${CACHE_PREFIX}${encodeURIComponent(key)}`;

const getCachedEntry = (key: string): CacheEntry | null => {
  const now = Date.now();
  const cached = memoryCache.get(key);
  if (cached) {
    if (cached.expiresAt > now) return cached;
    memoryCache.delete(key);
  }

  const storageKey = storageKeyFor(key);
  const raw = readStorage(storageKey, null);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as CacheEntry | null;
    if (!parsed || typeof parsed.url !== "string") {
      removeStorage(storageKey);
      return null;
    }
    if (typeof parsed.expiresAt === "number" && parsed.expiresAt > now) {
      memoryCache.set(key, parsed);
      return parsed;
    }
    removeStorage(storageKey);
    return null;
  } catch (_) {
    removeStorage(storageKey);
    return null;
  }
};

const storeCacheEntry = (key: string, entry: CacheEntry) => {
  memoryCache.set(key, entry);
  writeStorage(storageKeyFor(key), JSON.stringify(entry));
};

const clearCacheEntry = (key: string) => {
  memoryCache.delete(key);
  removeStorage(storageKeyFor(key));
};

const loadImageElement = (
  url: string,
  {
    crossOrigin = "anonymous",
    timeoutMs = 12000,
    signal,
  }: {
    crossOrigin?: "" | "anonymous" | "use-credentials";
    timeoutMs?: number;
    signal?: AbortSignal;
  },
): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (disposed) return;
      disposed = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (signal) {
        signal.removeEventListener("abort", handleAbort);
      }
      img.onload = null;
      img.onerror = null;
    };

    const handleAbort = () => {
      cleanup();
      reject(new DOMException("Image load aborted", "AbortError"));
    };

    const handleError = (error?: unknown) => {
      cleanup();
      reject(error instanceof Error ? error : new Error(`Failed to load image: ${url}`));
    };

    if (signal) {
      if (signal.aborted) {
        handleAbort();
        return;
      }
      signal.addEventListener("abort", handleAbort);
    }

    if (crossOrigin) {
      img.crossOrigin = crossOrigin;
    }
    img.decoding = "async";

    img.onload = () => {
      cleanup();
      resolve(img);
    };

    img.onerror = () => {
      handleError();
    };

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        handleError(new Error(`Image timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }

    img.src = url;

    if (img.complete && img.naturalWidth > 0) {
      cleanup();
      resolve(img);
    }
  });

const decodeImage = async (img: HTMLImageElement) => {
  if (typeof img.decode === "function") {
    try {
      await img.decode();
    } catch (_) {
      // Browsers can throw for cross-origin images; ignore.
    }
  }
};

const logFailure = (message: string, payload: Record<string, unknown>) => {
  if (process.env.NODE_ENV === "test") return;
  console.warn(message, payload);
};

export function useImageLoader(source: StorageSource, options: UseImageLoaderOptions = {}): UseImageLoaderState {
  const {
    preferredSize,
    retries = DEFAULT_RETRIES,
    cacheTtlMs = DEFAULT_CACHE_TTL,
    crossOrigin = "anonymous",
    onError,
    enabled = true,
    decode = true,
    timeoutMs = 12000,
  } = options;

  const normalisedSource = useMemo(() => normaliseSource(source), [source]);
  const cacheKey = useMemo(
    () => (normalisedSource ? buildCacheKey(normalisedSource, preferredSize) : null),
    [normalisedSource, preferredSize],
  );

  const abortRef = useRef<AbortController | null>(null);
  const [version, setVersion] = useState(0);

  const [state, setState] = useState<Omit<UseImageLoaderState, "reload" | "isLoading">>({
    status: normalisedSource ? "idle" : "idle",
    url: null,
    error: null,
    adapter: undefined,
  });
  const adapterRef = useRef<string | undefined>(state.adapter);

  useEffect(() => {
    adapterRef.current = state.adapter;
  }, [state.adapter]);

  const reload = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      setState((prev) => ({ ...prev, status: "idle", url: null, error: null, adapter: undefined }));
      return;
    }

    if (!normalisedSource || !cacheKey) {
      setState((prev) => ({ ...prev, status: "idle", url: null, error: null, adapter: undefined }));
      return;
    }

    const cached = getCachedEntry(cacheKey);
    if (cached) {
      setState({ status: "loaded", url: cached.url, error: null, adapter: cached.adapter });
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    setState((prev) => ({ ...prev, status: "loading", error: null }));

    const attemptLoad = async (): Promise<StorageAdapterResult> => {
      const resolved = await resolveImageSource(normalisedSource, {
        preferredSize,
        signal: controller.signal,
      });
      const img = await loadImageElement(resolved.url, {
        crossOrigin,
        timeoutMs,
        signal: controller.signal,
      });
      if (decode) {
        await decodeImage(img);
      }
      return resolved;
    };

    withRetry(attemptLoad, { retries })
      .then((result) => {
        if (cancelled || controller.signal.aborted) return;
        const ttl = Math.max(1000, result.ttl ?? cacheTtlMs ?? DEFAULT_CACHE_TTL);
        const entry: CacheEntry = {
          url: result.url,
          expiresAt: Date.now() + ttl,
          adapter: result.adapter,
        };
        if (isBrowser) {
          storeCacheEntry(cacheKey, entry);
        } else {
          memoryCache.set(cacheKey, entry);
        }
        setState({ status: "loaded", url: result.url, error: null, adapter: result.adapter });
      })
      .catch((error) => {
        if (cancelled || controller.signal.aborted) return;
        const err = error instanceof Error ? error : new Error(String(error));
        logFailure("[useImageLoader] Failed to load image", {
          source: normalisedSource,
          adapter: adapterRef.current,
          cacheKey,
          error: err,
        });
        clearCacheEntry(cacheKey);
        onError?.(err, { source: normalisedSource, adapter: adapterRef.current });
        setState({ status: "error", url: null, error: err, adapter: adapterRef.current });
      })
      .finally(() => {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [cacheKey, cacheTtlMs, crossOrigin, decode, enabled, normalisedSource, onError, preferredSize, retries, timeoutMs, version]);

  const isLoading = state.status === "loading";

  return useMemo(
    () => ({
      ...state,
      reload,
      isLoading,
    }),
    [isLoading, reload, state],
  );
}

export const __imageCache = {
  clear(source?: string, preferredSize?: number) {
    if (!source) {
      memoryCache.clear();
      if (isBrowser) {
        try {
          const keys = Object.keys(window.localStorage).filter((key) => key.startsWith(CACHE_PREFIX));
          keys.forEach((key) => window.localStorage.removeItem(key));
        } catch (error) {
          logFailure("[useImageLoader] Failed to clear localStorage cache", { error });
        }
      }
      return;
    }
    const key = buildCacheKey(source, preferredSize);
    clearCacheEntry(key);
  },
};
