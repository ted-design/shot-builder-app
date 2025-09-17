import { useEffect, useState } from "react";
import { getDownloadURL, ref as storageRef } from "firebase/storage";
import { storage } from "../firebase";

export const buildSizedPath = (path, size = 480) =>
  path.replace(/(\.[^./]+)$/, `_${size}x${Math.round(size * 1.25)}$1`);

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
