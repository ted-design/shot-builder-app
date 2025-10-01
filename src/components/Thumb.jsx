// src/components/Thumb.jsx
import { useEffect, useState } from "react";
import { getBestImageUrl } from "../lib/images";

export default function Thumb({ path, size = 200, alt = "" }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!path) return setUrl(null);
      const u = await getBestImageUrl(path, size);
      if (alive) setUrl(u);
    })();
    return () => { alive = false; };
  }, [path, size]);

  if (!url) return <div style={{ width: size, height: size, background: "#eee", borderRadius: 8 }} />;
  return (
    <img
      src={url}
      alt={alt}
      width={size}
      height={size}
      style={{ objectFit: "cover", borderRadius: 8 }}
      crossOrigin="anonymous"
    />
  );
}
