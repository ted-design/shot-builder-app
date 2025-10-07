// src/components/Thumb.jsx
import AppImage from "./common/AppImage";

const DEFAULT_FALLBACK_CLASS =
  "flex h-full w-full items-center justify-center bg-slate-100 text-xs font-medium uppercase tracking-wide text-slate-500";

export default function Thumb({
  path,
  size = 200,
  alt = "",
  className = "",
  imageClassName = "h-full w-full object-cover",
  fallback,
  loading = "lazy",
}) {
  const fallbackNode =
    fallback !== undefined ? (
      fallback
    ) : (
      <div className={DEFAULT_FALLBACK_CLASS} aria-hidden="true">
        No image
      </div>
    );

  return (
    <AppImage
      src={path}
      alt={alt}
      preferredSize={size}
      loading={loading}
      className={className || undefined}
      imageClassName={imageClassName}
      placeholder={fallbackNode}
      fallback={fallbackNode}
    />
  );
}
