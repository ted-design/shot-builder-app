// src/components/Thumb.jsx
import { useEffect, useMemo, useState } from "react";
import { getBestImageUrl } from "../lib/images";

const DEFAULT_FALLBACK_CLASS =
  "flex h-full w-full items-center justify-center bg-slate-100 text-xs font-medium uppercase tracking-wide text-slate-400";

export default function Thumb({
  path,
  size = 200,
  alt = "",
  className = "",
  imageClassName = "h-full w-full object-cover",
  fallback,
  loading = "lazy",
}) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!path) {
        if (alive) setUrl(null);
        return;
      }

      if (typeof path === "string" && (/^https?:\/\//i.test(path) || path.startsWith("data:"))) {
        if (alive) setUrl(path);
        return;
      }

      try {
        const resolved = await getBestImageUrl(path, size);
        if (alive) setUrl(resolved);
      } catch (error) {
        if (process.env.NODE_ENV !== "test") {
          console.warn("[Thumb] Failed to load image", { path, error });
        }
        if (alive) setUrl(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [path, size]);

  const fallbackNode = useMemo(() => {
    if (fallback !== undefined) return fallback;
    return (
      <div className={DEFAULT_FALLBACK_CLASS} aria-hidden="true">
        No image
      </div>
    );
  }, [fallback]);

  return (
    <div className={className || undefined}>
      {url ? (
        <img
          src={url}
          alt={alt}
          loading={loading}
          className={imageClassName}
          crossOrigin="anonymous"
        />
      ) : (
        fallbackNode
      )}
    </div>
  );
}
