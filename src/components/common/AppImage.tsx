import { useEffect, useMemo, useRef, type CSSProperties, type ImgHTMLAttributes, type ReactNode } from "react";
import { useImageLoader, type UseImageLoaderOptions } from "../../hooks/useImageLoader";

export type AppImageFit = CSSProperties["objectFit"];
export type AppImagePosition = CSSProperties["objectPosition"];

export interface AppImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "crossOrigin" | "onError" | "style" | "className">,
    Pick<UseImageLoaderOptions, "preferredSize" | "retries" | "cacheTtlMs" | "timeoutMs"> {
  src: Parameters<typeof useImageLoader>[0];
  fit?: AppImageFit;
  position?: AppImagePosition;
  placeholder?: ReactNode;
  fallback?: ReactNode;
  crossOrigin?: "" | "anonymous" | "use-credentials";
  onImageError?: UseImageLoaderOptions["onError"];
  decode?: boolean;
  className?: string;
  style?: CSSProperties;
  imageClassName?: string;
  imageStyle?: CSSProperties;
}

const DEFAULT_PLACEHOLDER_CLASS =
  "flex h-full w-full items-center justify-center rounded-md bg-slate-100 text-xs font-medium uppercase tracking-wide text-slate-500";

const DEFAULT_FALLBACK_CLASS =
  "flex h-full w-full flex-col items-center justify-center gap-2 rounded-md bg-slate-100 px-3 text-center text-xs font-medium uppercase tracking-wide text-slate-500";

export function PlaceholderImage({ children }: { children?: ReactNode }) {
  return <div className={DEFAULT_PLACEHOLDER_CLASS}>{children ?? "Loading"}</div>;
}

export function FallbackImage({ children }: { children?: ReactNode }) {
  return (
    <div className={DEFAULT_FALLBACK_CLASS} role="img" aria-label="Image unavailable">
      {children ?? "Image unavailable"}
    </div>
  );
}

const appImageSourceRegistry = new WeakMap<HTMLElement, AppImageProps["src"]>();

export const getAppImageSource = (element: Element | null) => {
  if (!element) return undefined;
  if (element instanceof HTMLElement) {
    if (appImageSourceRegistry.has(element)) {
      return appImageSourceRegistry.get(element);
    }
    const parent = element.closest("[data-app-image]") as HTMLElement | null;
    if (parent && appImageSourceRegistry.has(parent)) {
      return appImageSourceRegistry.get(parent);
    }
  }
  return undefined;
};

export function AppImage({
  src,
  alt = "",
  fit = "cover",
  position,
  placeholder,
  fallback,
  loading = "lazy",
  preferredSize,
  retries,
  cacheTtlMs,
  timeoutMs,
  crossOrigin = "anonymous",
  onImageError,
  decode,
  className,
  style,
  imageClassName,
  imageStyle,
  onError,
  ...imgProps
}: AppImageProps) {
  const { status, url, error, adapter, reload } = useImageLoader(src, {
    preferredSize,
    retries,
    cacheTtlMs,
    crossOrigin,
    onError: onImageError,
    decode,
    timeoutMs,
  });

  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    if (src != null) {
      appImageSourceRegistry.set(node, src);
    } else {
      appImageSourceRegistry.delete(node);
    }
    return () => {
      appImageSourceRegistry.delete(node);
    };
  }, [src]);

  const combinedImageStyle = useMemo(() => ({
    ...imageStyle,
    objectFit: fit,
    ...(position && { objectPosition: position })
  }), [fit, position, imageStyle]);

  const handleImageError: ImgHTMLAttributes<HTMLImageElement>["onError"] = (event) => {
    onError?.(event);
    if (event?.currentTarget) {
      event.currentTarget.src = "";
    }
    reload();
  };

  return (
    <div ref={containerRef} className={className} style={style} data-app-image>
      {status === "loading" || status === "idle" ? (
        placeholder ?? <PlaceholderImage />
      ) : status === "error" || !url ? (
        fallback ?? (
          <FallbackImage>
            <span>Image unavailable</span>
            {error ? (
              <span className="text-[10px] normal-case text-slate-500">{error.message}</span>
            ) : adapter ? (
              <span className="text-[10px] normal-case text-slate-500">Adapter: {adapter}</span>
            ) : null}
          </FallbackImage>
        )
      ) : (
        <img
          {...imgProps}
          src={url}
          alt={alt}
          loading={loading}
          decoding="async"
          crossOrigin={crossOrigin || undefined}
          className={imageClassName}
          style={combinedImageStyle}
          onError={handleImageError}
        />
      )}
    </div>
  );
}

AppImage.Placeholder = PlaceholderImage;
AppImage.Fallback = FallbackImage;

export default AppImage;
