import { getDownloadURL, ref as storageRef } from "firebase/storage";
import { storage } from "../firebase";

type StorageSource = string | { fullPath?: string | null; path?: string | null; src?: string | null } | null | undefined;

export type StorageAdapterResult = {
  url: string;
  /** TTL in milliseconds for client-side caching */
  ttl?: number;
  adapter?: string;
};

export type StorageAdapterResolveOptions = {
  preferredSize?: number;
  signal?: AbortSignal;
};

export interface StorageAdapter {
  readonly name: string;
  matches(source: string): boolean;
  resolve(source: string, options?: StorageAdapterResolveOptions): Promise<StorageAdapterResult>;
}

const DEFAULT_TTL_MS = 60 * 60 * 1000;

const isHttpUrl = (value: string) => /^https?:\/\//i.test(value);
const isDataUrl = (value: string) => /^data:/i.test(value);
const isBlobUrl = (value: string) => /^blob:/i.test(value);

const normaliseSource = (source: StorageSource): string | null => {
  if (typeof source === "string") {
    const trimmed = source.trim();
    return trimmed.length === 0 ? null : trimmed;
  }
  if (source && typeof source === "object") {
    if (typeof source.fullPath === "string" && source.fullPath.length) return source.fullPath;
    if (typeof source.path === "string" && source.path.length) return source.path;
    if (typeof source.src === "string" && source.src.length) return source.src;
  }
  return null;
};

const buildSizedCandidates = (path: string, requestedSize?: number): string[] => {
  if (!requestedSize || requestedSize <= 0) return [path];
  if (isHttpUrl(path) || isDataUrl(path) || isBlobUrl(path)) return [path];

  const candidates = new Set<string>();
  const baseSize = Math.round(requestedSize);
  const height = Math.round(baseSize * 1.25);
  const suffix = `_${baseSize}x${height}`;

  const queryIndex = path.indexOf("?");
  const basePath = queryIndex === -1 ? path : path.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : path.slice(queryIndex);

  const lastSlash = basePath.lastIndexOf("/");
  const lastDot = basePath.lastIndexOf(".");
  const alreadySized = lastDot > lastSlash && basePath.slice(lastDot - suffix.length, lastDot) === suffix;

  if (!alreadySized && lastDot > lastSlash && lastDot !== -1) {
    const sized = `${basePath.slice(0, lastDot)}${suffix}${basePath.slice(lastDot)}${query}`;
    candidates.add(sized);
  }

  candidates.add(path);
  return Array.from(candidates);
};

const firebaseStorageAdapter: StorageAdapter = {
  name: "firebase",
  matches: () => true,
  async resolve(source, options) {
    const preferredSize = options?.preferredSize;
    const candidates = buildSizedCandidates(source, preferredSize);
    let lastError: unknown = null;

    for (const candidate of candidates) {
      try {
        const ref = storageRef(storage, candidate);
        const url = await getDownloadURL(ref);
        return { url, ttl: DEFAULT_TTL_MS, adapter: "firebase" };
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError ?? new Error("Failed to resolve Firebase Storage URL");
  },
};

const s3BaseUrl = import.meta.env.VITE_S3_IMAGE_BASE_URL || import.meta.env.VITE_IMAGE_CDN_BASE_URL || "";
const s3SigningEndpoint = import.meta.env.VITE_S3_SIGN_IMAGES_ENDPOINT || import.meta.env.VITE_IMAGE_SIGN_ENDPOINT || "";

const normalisePath = (path: string) => (path.startsWith("/") ? path.slice(1) : path);

const buildUrlFromBase = (base: string, path: string) => {
  if (!base) return null;
  try {
    const url = new URL(path, base);
    return url.toString();
  } catch (_) {
    return `${base.replace(/\/?$/, "/")}${normalisePath(path)}`;
  }
};

const fetchSignedS3Url = async (path: string, signal?: AbortSignal) => {
  if (!s3SigningEndpoint) return null;
  let requestUrl = s3SigningEndpoint;
  try {
    const base = typeof window !== "undefined" && window.location ? window.location.origin : "http://localhost";
    requestUrl = new URL(s3SigningEndpoint, base).toString();
  } catch (_) {
    requestUrl = s3SigningEndpoint;
  }
  const url = new URL(requestUrl);
  url.searchParams.set("path", path);
  const response = await fetch(url.toString(), {
    method: "GET",
    credentials: "include",
    signal,
  });
  if (!response.ok) {
    const error = new Error(`Signing request failed (${response.status})`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  const payload = await response.json().catch(() => ({}));
  if (typeof payload?.url === "string" && payload.url.length > 0) {
    const ttlSeconds = typeof payload?.expiresIn === "number" ? payload.expiresIn : undefined;
    return { url: payload.url as string, ttl: ttlSeconds ? ttlSeconds * 1000 : DEFAULT_TTL_MS };
  }
  return null;
};

const s3Adapter: StorageAdapter = {
  name: "s3",
  matches: (source) => !isHttpUrl(source) || (s3BaseUrl.length > 0 || s3SigningEndpoint.length > 0),
  async resolve(source, options) {
    if (isHttpUrl(source) || isDataUrl(source) || isBlobUrl(source)) {
      return { url: source, ttl: DEFAULT_TTL_MS, adapter: "s3" };
    }

    const viaBase = buildUrlFromBase(s3BaseUrl, source);
    if (viaBase) {
      return { url: viaBase, ttl: DEFAULT_TTL_MS, adapter: "s3" };
    }

    const signed = await fetchSignedS3Url(normalisePath(source), options?.signal);
    if (signed) {
      return { ...signed, adapter: "s3" };
    }

    throw new Error("Unable to resolve S3 image URL – configure VITE_S3_IMAGE_BASE_URL or VITE_S3_SIGN_IMAGES_ENDPOINT");
  },
};

const passthroughAdapter: StorageAdapter = {
  name: "passthrough",
  matches: (source) => isHttpUrl(source) || isDataUrl(source) || isBlobUrl(source),
  async resolve(source) {
    return { url: source, ttl: DEFAULT_TTL_MS, adapter: "passthrough" };
  },
};

const resolveAdapter = (source: string): StorageAdapter => {
  const preferred = (import.meta.env.VITE_IMAGE_STORAGE || "firebase").toLowerCase();
  if (preferred === "s3") {
    return s3Adapter;
  }
  if (preferred === "passthrough") {
    return passthroughAdapter;
  }
  return firebaseStorageAdapter;
};

export type ResolveImageOptions = StorageAdapterResolveOptions & {
  /** Override cache TTL for this lookup */
  ttl?: number;
};

export async function resolveImageSource(source: StorageSource, options?: ResolveImageOptions): Promise<StorageAdapterResult> {
  const normalised = normaliseSource(source);
  if (!normalised) {
    throw new Error("Missing image source");
  }

  const adapter = resolveAdapter(normalised);

  if (adapter === passthroughAdapter || isHttpUrl(normalised) || isDataUrl(normalised) || isBlobUrl(normalised)) {
    const result = await passthroughAdapter.resolve(normalised, options);
    if (options?.ttl != null) {
      return { ...result, ttl: options.ttl };
    }
    return result;
  }

  const activeAdapter = adapter.matches(normalised) ? adapter : firebaseStorageAdapter;
  const result = await activeAdapter.resolve(normalised, options);
  if (options?.ttl != null) {
    return { ...result, ttl: options.ttl };
  }
  return { ttl: DEFAULT_TTL_MS, ...result };
}

export const storageAdapters = {
  firebase: firebaseStorageAdapter,
  s3: s3Adapter,
  passthrough: passthroughAdapter,
};

export type { StorageSource };
