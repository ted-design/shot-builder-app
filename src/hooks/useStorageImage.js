import { useEffect, useState } from "react";
import { getDownloadURL, ref as storageRef } from "firebase/storage";
import { storage } from "../lib/firebase";

export const buildSizedPath = (path, size = 480) => {
  if (typeof path !== "string" || path.length === 0) {
    return path;
  }
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const suffix = `_${size}x${Math.round(size * 1.25)}`;
  const [base, ...rest] = path.split("?");
  const query = rest.length ? `?${rest.join("?")}` : "";
  const lastSlash = base.lastIndexOf("/");
  const lastDot = base.lastIndexOf(".");
  if (lastDot === -1 || lastDot < lastSlash) {
    return path;
  }
  const sliceStart = Math.max(lastDot - suffix.length, 0);
  if (base.slice(sliceStart, lastDot) === suffix) {
    return path;
  }
  const sizedBase = `${base.slice(0, lastDot)}${suffix}${base.slice(lastDot)}`;
  return `${sizedBase}${query}`;
};

export function useStorageImage(path, { preferredSize = 480 } = {}) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!path) {
      setUrl(null);
      return () => {
        cancelled = true;
      };
    }

    if (typeof path === "string" && /^https?:\/\//i.test(path)) {
      setUrl(path);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const sized = buildSizedPath(path, preferredSize);
        const preferred = await getDownloadURL(storageRef(storage, sized));
        if (!cancelled) setUrl(preferred);
      } catch (err) {
        try {
          const original = await getDownloadURL(storageRef(storage, path));
          if (!cancelled) setUrl(original);
        } catch {
          if (!cancelled) setUrl(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [path, preferredSize]);

  return url;
}
