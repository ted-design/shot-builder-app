import { useEffect, useState } from "react";
import { getDownloadURL, ref as storageRef } from "firebase/storage";
import { storage } from "../lib/firebase";
import { loadImageWithRetry, withRetry } from "../lib/imageLoader";

export const resolveStoragePath = (candidate) => {
  if (typeof candidate === "string") {
    return candidate;
  }
  if (candidate && typeof candidate === "object") {
    if (typeof candidate.fullPath === "string") {
      return candidate.fullPath;
    }
    if (typeof candidate.path === "string") {
      return candidate.path;
    }
  }
  return null;
};

export const buildSizedPath = (path, size = 480) => {
  const resolvedPath = resolveStoragePath(path);
  if (typeof resolvedPath !== "string" || resolvedPath.length === 0) {
    return resolvedPath;
  }
  if (/^https?:\/\//i.test(resolvedPath)) {
    return resolvedPath;
  }
  const suffix = `_${size}x${Math.round(size * 1.25)}`;
  const queryIndex = resolvedPath.indexOf("?");
  const base = queryIndex === -1 ? resolvedPath : resolvedPath.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : resolvedPath.slice(queryIndex);
  const lastSlash = base.lastIndexOf("/");
  const lastDot = base.lastIndexOf(".");
  if (lastDot === -1 || lastDot < lastSlash) {
    return resolvedPath;
  }
  const sliceStart = Math.max(lastDot - suffix.length, 0);
  if (base.slice(sliceStart, lastDot) === suffix) {
    return resolvedPath;
  }
  const sizedBase = `${base.slice(0, lastDot)}${suffix}${base.slice(lastDot)}`;
  return `${sizedBase}${query}`;
};

export function useStorageImage(path, { preferredSize = 480, retries = 2 } = {}) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const resolvedPath = resolveStoragePath(path);

    if (!resolvedPath) {
      setUrl(null);
      return () => {
        cancelled = true;
      };
    }

    const candidates = (() => {
      if (/^https?:\/\//i.test(resolvedPath)) {
        return [resolvedPath];
      }
      const sized = buildSizedPath(resolvedPath, preferredSize);
      const list = [];
      if (sized && sized !== resolvedPath) list.push(sized);
      list.push(resolvedPath);
      return Array.from(new Set(list.filter(Boolean)));
    })();

    setUrl((current) => (candidates.includes(current) ? current : null));

    const resolveDownloadUrl = async (candidate) => {
      if (/^https?:\/\//i.test(candidate)) {
        return candidate;
      }
      return withRetry(
        () => getDownloadURL(storageRef(storage, candidate)),
        { retries }
      );
    };

    (async () => {
      for (const candidate of candidates) {
        try {
          const downloadUrl = await resolveDownloadUrl(candidate);
          await loadImageWithRetry(downloadUrl, { retries, crossOrigin: "anonymous" });
          if (!cancelled) {
            setUrl(downloadUrl);
          }
          return;
        } catch (error) {
          const isLastCandidate = candidate === candidates[candidates.length - 1];
          if (isLastCandidate && process.env.NODE_ENV !== "test") {
            console.warn("[useStorageImage] Failed to resolve image", {
              path: candidate,
              error,
            });
          }
        }
      }
      if (!cancelled) {
        setUrl(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [path, preferredSize, retries]);

  return url;
}
