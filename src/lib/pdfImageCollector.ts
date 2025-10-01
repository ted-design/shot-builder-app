import { resolveImageSource, type StorageSource } from "./storage/adapters";
import { getAppImageSource } from "../components/common/AppImage";
import { withRetry } from "./imageLoader";

type PdfImage = {
  element: HTMLImageElement;
  owner?: {
    shotId?: string;
    productId?: string;
    talentId?: string;
    locationId?: string;
    key?: string;
  };
  source: StorageSource;
  resolvedUrl: string;
  dataUrl: string;
  adapter?: string;
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to convert blob to data URL"));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read blob"));
    reader.readAsDataURL(blob);
  });

const fetchAsDataUrl = async (url: string, signal?: AbortSignal): Promise<string> => {
  const response = await fetch(url, {
    mode: "cors",
    credentials: "omit",
    cache: "force-cache",
    signal,
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch image (${response.status})`);
  }
  const blob = await response.blob();
  return blobToDataUrl(blob);
};

const toKey = (source: StorageSource): string => {
  if (typeof source === "string") return source;
  try {
    return JSON.stringify(source);
  } catch (_) {
    return String(source);
  }
};

const resolveOwner = (img: HTMLImageElement): PdfImage["owner"] => {
  const shotNode = img.closest<HTMLElement>("[data-shot-id]");
  const productNode = img.closest<HTMLElement>("[data-product-id]");
  const talentNode = img.closest<HTMLElement>("[data-talent-id]");
  const locationNode = img.closest<HTMLElement>("[data-location-id]");
  const ownerKeyNode = img.closest<HTMLElement>("[data-image-owner]");
  const owner: PdfImage["owner"] = {};
  if (shotNode?.dataset.shotId) owner.shotId = shotNode.dataset.shotId;
  if (productNode?.dataset.productId) owner.productId = productNode.dataset.productId;
  if (talentNode?.dataset.talentId) owner.talentId = talentNode.dataset.talentId;
  if (locationNode?.dataset.locationId) owner.locationId = locationNode.dataset.locationId;
  if (ownerKeyNode?.dataset.imageOwner) owner.key = ownerKeyNode.dataset.imageOwner;
  return owner;
};

const defaultNodes = () =>
  typeof document === "undefined"
    ? []
    : Array.from(document.querySelectorAll<HTMLElement>("img"));

export type CollectImagesForPdfOptions = {
  signal?: AbortSignal;
  retries?: number;
};

export async function collectImagesForPdf(
  nodes: Iterable<HTMLElement> = defaultNodes(),
  { signal, retries = 2 }: CollectImagesForPdfOptions = {},
): Promise<PdfImage[]> {
  const images = new Set<HTMLImageElement>();
  for (const node of nodes) {
    if (!node) continue;
    if (node instanceof HTMLImageElement) {
      images.add(node);
    } else {
      node.querySelectorAll("img").forEach((img) => images.add(img));
    }
  }

  const seen = new Map<string, Promise<PdfImage | null>>();
  const resolveImage = async (img: HTMLImageElement): Promise<PdfImage | null> => {
    const source = (getAppImageSource(img) ?? img.getAttribute("data-src") ?? img.src) as StorageSource;
    if (!source) return null;
    const key = toKey(source);
    if (!seen.has(key)) {
      seen.set(
        key,
        withRetry(async () => {
          const resolved = await resolveImageSource(source);
          const dataUrl = await fetchAsDataUrl(resolved.url, signal);
          return {
            element: img,
            source,
            resolvedUrl: resolved.url,
            dataUrl,
            adapter: resolved.adapter,
          } satisfies PdfImage;
        }, { retries }).catch((error) => {
          if (process.env.NODE_ENV !== "test") {
            console.warn("[collectImagesForPdf] Failed to load image", { source, error });
          }
          return null;
        }),
      );
    }
    return seen.get(key) ?? null;
  };

  const results: PdfImage[] = [];
  for (const image of images) {
    const entry = await resolveImage(image);
    if (entry) {
      const owner = resolveOwner(image);
      results.push({ ...entry, element: image, owner });
    }
  }

  return results;
}

export async function resolveImageSourceToDataUrl(
  source: StorageSource,
  { signal }: { signal?: AbortSignal } = {},
): Promise<{ dataUrl: string; resolvedUrl: string; adapter?: string }> {
  const resolved = await resolveImageSource(source);
  const dataUrl = await fetchAsDataUrl(resolved.url, signal);
  return { dataUrl, resolvedUrl: resolved.url, adapter: resolved.adapter };
}

export type { PdfImage };
