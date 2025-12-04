/**
 * useImagePreloader - Pre-loads and validates images for PDF export
 *
 * This hook ensures all images are loaded and validated BEFORE export is allowed.
 * It provides:
 * - Per-image status tracking (loading, ready, failed, skipped)
 * - Progress reporting
 * - Retry functionality for failed images
 * - Skip functionality to proceed without specific images
 * - Export readiness gating
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { resolveImageSource } from '../lib/storage/adapters';
import { processImageForPDF, getOptimalImageDimensions } from '../lib/pdfImageProcessor';
import { getPrimaryAttachment } from '../lib/imageHelpers';

export type ImageStatus = 'pending' | 'loading' | 'ready' | 'failed' | 'skipped';

export interface ImageEntry {
  shotId: string;
  shotName: string;
  source: string;
  status: ImageStatus;
  dataUrl: string | null;
  error: string | null;
  retryCount: number;
}

export interface SkippedShot {
  shotId: string;
  shotName: string;
  reason: 'no_image' | 'no_product_images' | 'fallback_disabled';
}

export interface ImagePreloaderState {
  images: Map<string, ImageEntry>;
  isLoading: boolean;
  progress: { loaded: number; total: number; failed: number };
  isReadyForExport: boolean;
}

export interface UseImagePreloaderOptions {
  density?: 'compact' | 'standard' | 'detailed';
  maxRetries?: number;
  enabled?: boolean;
}

interface Shot {
  id: string;
  name?: string;
  image?: string;
  attachments?: Array<{ cropData?: { x?: number; y?: number } }>;
  referenceImageCrop?: { x: number; y: number };
  productImages?: string[];
}

interface Lane {
  id: string;
  name?: string;
  shots?: Shot[];
}

/**
 * Load and process a single image using canvas-based approach
 *
 * This bypasses CORS restrictions by:
 * 1. Resolving the storage path to a download URL (Firebase getDownloadURL)
 * 2. Passing the URL directly to processImageForPDF which uses <img crossOrigin="anonymous">
 * 3. Canvas drawing + toDataURL() to get the data URL
 *
 * The fetch()-based approach in resolveImageSourceToDataUrl fails due to CORS,
 * but the <img> element with crossOrigin="anonymous" works with Firebase Storage.
 */
const loadImage = async (
  source: string,
  cropPosition: { x: number; y: number },
  dimensions: { width: number; height: number },
  signal?: AbortSignal
): Promise<string> => {
  // Step 1: Resolve storage path to URL (this doesn't fetch, just gets the URL)
  let imageUrl: string;
  try {
    const result = await resolveImageSource(source, {
      signal,
    });
    imageUrl = result.url;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to resolve image URL: ${message}`);
  }

  if (!imageUrl) {
    throw new Error('Image source returned empty URL');
  }

  // Step 2: Use processImageForPDF which loads via <img crossOrigin="anonymous">
  // This bypasses CORS issues that affect fetch()
  try {
    const dataUrl = await processImageForPDF(imageUrl, {
      cropPosition,
      targetWidth: dimensions.width,
      targetHeight: dimensions.height,
      crossOrigin: 'anonymous', // Important: enables canvas access
    });
    return dataUrl;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to process image: ${message}`);
  }
};

export function useImagePreloader(
  lanes: Lane[],
  includeImages: boolean,
  fallbackToProductImages: boolean,
  options: UseImagePreloaderOptions = {}
) {
  const {
    density = 'standard',
    maxRetries = 2,
    enabled = true
  } = options;

  const [images, setImages] = useState<Map<string, ImageEntry>>(new Map());
  const [skippedShots, setSkippedShots] = useState<SkippedShot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasInitializedRef = useRef(false);
  const lastLanesKeyRef = useRef<string>('');
  // Track previous values to detect actual changes
  const lastDensityRef = useRef<string>(density);
  const lastFallbackRef = useRef<boolean>(fallbackToProductImages);
  // Track if a preload is in progress (for avoiding concurrent preloads)
  const isPreloadingRef = useRef(false);
  // Ref to store the latest startPreloading function - prevents effect dependency loops
  const startPreloadingRef = useRef<(() => Promise<void>) | null>(null);

  // Get optimal dimensions for density
  const dimensions = getOptimalImageDimensions(density);

  // Create a stable key to detect when lanes data fundamentally changes
  // This ensures we re-preload when new images become available
  const lanesKey = useMemo(() => {
    if (!Array.isArray(lanes)) return '';
    const shotImages: string[] = [];
    lanes.forEach((lane) => {
      const laneShots = Array.isArray(lane.shots) ? lane.shots : [];
      laneShots.forEach((shot) => {
        if (shot?.id) {
          // Include image sources in the key so we detect when images change
          const imageSrc = shot.image || '';
          const productImgs = Array.isArray(shot.productImages) ? shot.productImages.join(',') : '';
          shotImages.push(`${shot.id}:${imageSrc}:${productImgs}`);
        }
      });
    });
    return shotImages.join('|');
  }, [lanes]);

  // Collect all shots that need images and track skipped ones
  const collectShotsData = useCallback(() => {
    if (!includeImages || !Array.isArray(lanes)) {
      return { shots: [], skipped: [] };
    }

    const shots: Array<{
      shotId: string;
      shotName: string;
      source: string;
      cropPosition: { x: number; y: number };
    }> = [];

    const skipped: SkippedShot[] = [];

    lanes.forEach((lane) => {
      const laneShots = Array.isArray(lane.shots) ? lane.shots : [];
      laneShots.forEach((shot) => {
        if (!shot?.id) return;

        const shotId = String(shot.id);
        const shotName = shot.name || `Shot ${shot.id}`;

        // Get image source with fallback
        let imageSource = shot.image;
        if (!imageSource && fallbackToProductImages) {
          const hasProductImages = Array.isArray(shot.productImages) && shot.productImages.length > 0;
          if (hasProductImages) {
            imageSource = shot.productImages.find(Boolean);
          }
        }

        // Track why shot was skipped
        if (!imageSource) {
          if (!shot.image && !fallbackToProductImages) {
            skipped.push({ shotId, shotName, reason: 'fallback_disabled' });
          } else if (!shot.image && fallbackToProductImages) {
            const hasProductImages = Array.isArray(shot.productImages) && shot.productImages.length > 0;
            skipped.push({
              shotId,
              shotName,
              reason: hasProductImages ? 'no_image' : 'no_product_images',
            });
          } else {
            skipped.push({ shotId, shotName, reason: 'no_image' });
          }
          return;
        }

        // Get crop position
        let cropPosition = { x: 50, y: 50 };
        const primaryAttachment = getPrimaryAttachment(shot.attachments);
        if (primaryAttachment?.cropData) {
          cropPosition = {
            x: primaryAttachment.cropData.x || 50,
            y: primaryAttachment.cropData.y || 50,
          };
        } else if (shot.referenceImageCrop) {
          cropPosition = shot.referenceImageCrop;
        }

        shots.push({
          shotId,
          shotName,
          source: imageSource,
          cropPosition,
        });
      });
    });

    return { shots, skipped };
  }, [lanes, includeImages, fallbackToProductImages]);

  // Load a single image
  const loadSingleImage = useCallback(async (
    shotId: string,
    source: string,
    cropPosition: { x: number; y: number },
    existingRetryCount: number = 0,
    signal?: AbortSignal
  ): Promise<{ success: boolean; dataUrl: string | null; error: string | null }> => {
    try {
      const dataUrl = await loadImage(source, cropPosition, dimensions, signal);
      return { success: true, dataUrl, error: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, dataUrl: null, error: errorMessage };
    }
  }, [dimensions]);

  // Initialize and load all images
  const startPreloading = useCallback(async () => {
    if (!enabled || !includeImages) {
      setImages(new Map());
      setSkippedShots([]);
      return;
    }

    // Prevent concurrent preloads - if already loading, skip
    if (isPreloadingRef.current) {
      return;
    }

    const { shots, skipped } = collectShotsData();
    setSkippedShots(skipped);

    if (shots.length === 0) {
      setImages(new Map());
      return;
    }

    // Mark as preloading
    isPreloadingRef.current = true;

    // Cancel any existing loading
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);

    // Initialize all images as pending
    const initialImages = new Map<string, ImageEntry>();
    shots.forEach((shot) => {
      initialImages.set(shot.shotId, {
        shotId: shot.shotId,
        shotName: shot.shotName,
        source: shot.source,
        status: 'loading',
        dataUrl: null,
        error: null,
        retryCount: 0,
      });
    });
    setImages(initialImages);

    // Load images with concurrency control
    // IMPORTANT: We batch updates to prevent multiple PDF regenerations
    const CONCURRENCY = 4;
    const queue = [...shots];
    const batchedResults = new Map<string, { success: boolean; dataUrl: string | null; error: string | null }>();
    let processedCount = 0;
    const totalImages = shots.length;
    const BATCH_SIZE = Math.max(1, Math.floor(totalImages / 4)); // Update every ~25%

    const processNext = async () => {
      while (queue.length > 0) {
        const shot = queue.shift();
        if (!shot) break;

        if (abortControllerRef.current?.signal.aborted) break;

        const signal = abortControllerRef.current?.signal;
        const result = await loadSingleImage(
          shot.shotId,
          shot.source,
          shot.cropPosition,
          0,
          signal
        );

        // Accumulate results instead of updating state per-image
        batchedResults.set(shot.shotId, result);
        processedCount++;

        // Only update state at batch intervals to reduce re-renders
        // This prevents PDF regeneration during image loading
        if (processedCount % BATCH_SIZE === 0 || processedCount === totalImages) {
          setImages((prev) => {
            const updated = new Map(prev);
            batchedResults.forEach((batchResult, shotId) => {
              const entry = updated.get(shotId);
              if (entry) {
                updated.set(shotId, {
                  ...entry,
                  status: batchResult.success ? 'ready' : 'failed',
                  dataUrl: batchResult.dataUrl,
                  error: batchResult.error,
                });
              }
            });
            return updated;
          });
          batchedResults.clear();
        }
      }
    };

    // Start concurrent workers
    const workers = Array(Math.min(CONCURRENCY, shots.length))
      .fill(null)
      .map(() => processNext());

    await Promise.all(workers);

    // Final batch update for any remaining results
    if (batchedResults.size > 0) {
      setImages((prev) => {
        const updated = new Map(prev);
        batchedResults.forEach((batchResult, shotId) => {
          const entry = updated.get(shotId);
          if (entry) {
            updated.set(shotId, {
              ...entry,
              status: batchResult.success ? 'ready' : 'failed',
              dataUrl: batchResult.dataUrl,
              error: batchResult.error,
            });
          }
        });
        return updated;
      });
    }

    setIsLoading(false);
    isPreloadingRef.current = false;
  }, [enabled, includeImages, collectShotsData, loadSingleImage]);

  // Retry a specific failed image
  const retryImage = useCallback(async (shotId: string) => {
    const entry = images.get(shotId);
    if (!entry || entry.status !== 'failed') return;

    if (entry.retryCount >= maxRetries) {
      return; // Max retries reached
    }

    // Find the shot info
    const { shots } = collectShotsData();
    const shot = shots.find((s) => s.shotId === shotId);
    if (!shot) return;

    // Mark as loading
    setImages((prev) => {
      const updated = new Map(prev);
      updated.set(shotId, {
        ...entry,
        status: 'loading',
        error: null,
      });
      return updated;
    });

    const result = await loadSingleImage(
      shotId,
      shot.source,
      shot.cropPosition,
      entry.retryCount,
      abortControllerRef.current?.signal || undefined
    );

    setImages((prev) => {
      const updated = new Map(prev);
      const currentEntry = updated.get(shotId);
      if (currentEntry) {
        updated.set(shotId, {
          ...currentEntry,
          status: result.success ? 'ready' : 'failed',
          dataUrl: result.dataUrl,
          error: result.error,
          retryCount: currentEntry.retryCount + 1,
        });
      }
      return updated;
    });
  }, [images, maxRetries, collectShotsData, loadSingleImage]);

  // Skip a failed image (allow export without it)
  const skipImage = useCallback((shotId: string) => {
    setImages((prev) => {
      const updated = new Map(prev);
      const entry = updated.get(shotId);
      if (entry && entry.status === 'failed') {
        updated.set(shotId, {
          ...entry,
          status: 'skipped',
        });
      }
      return updated;
    });
  }, []);

  // Skip all failed images
  const skipAllFailed = useCallback(() => {
    setImages((prev) => {
      const updated = new Map(prev);
      updated.forEach((entry, key) => {
        if (entry.status === 'failed') {
          updated.set(key, {
            ...entry,
            status: 'skipped',
          });
        }
      });
      return updated;
    });
  }, []);

  // Retry all failed images
  const retryAllFailed = useCallback(async () => {
    const failedEntries = Array.from(images.entries())
      .filter(([, entry]) => entry.status === 'failed');

    for (const [shotId] of failedEntries) {
      await retryImage(shotId);
    }
  }, [images, retryImage]);

  // Calculate progress
  const progress = {
    total: images.size,
    loaded: Array.from(images.values()).filter(
      (e) => e.status === 'ready' || e.status === 'skipped'
    ).length,
    failed: Array.from(images.values()).filter((e) => e.status === 'failed').length,
  };

  // Check if ready for export
  const isReadyForExport = !includeImages || (
    !isLoading &&
    progress.failed === 0 &&
    (progress.total === 0 || progress.loaded === progress.total)
  );

  // Get prepared image data for export
  const getImageDataMap = useCallback(() => {
    const map = new Map<string, string>();
    images.forEach((entry, shotId) => {
      if (entry.status === 'ready' && entry.dataUrl) {
        map.set(shotId, entry.dataUrl);
      }
    });
    return map;
  }, [images]);

  // Get failed images for display
  const failedImages = Array.from(images.values()).filter(
    (e) => e.status === 'failed'
  );

  // Keep the ref updated with the latest startPreloading function
  // This allows effects to call the function without having it in dependencies
  useEffect(() => {
    startPreloadingRef.current = startPreloading;
  }, [startPreloading]);

  // Auto-start preloading when modal opens
  useEffect(() => {
    if (enabled && includeImages && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      lastLanesKeyRef.current = lanesKey;
      startPreloadingRef.current?.();
    }
  }, [enabled, includeImages, lanesKey]);

  // Re-preload when lanes data changes (new images become available)
  // This catches the case where modal opens before lanes are fully loaded
  useEffect(() => {
    if (enabled && includeImages && hasInitializedRef.current) {
      // Only re-preload if the lanes key actually changed
      if (lanesKey !== lastLanesKeyRef.current && lanesKey.length > 0) {
        lastLanesKeyRef.current = lanesKey;
        startPreloadingRef.current?.();
      }
    }
  }, [enabled, includeImages, lanesKey]);

  // Re-preload when density or fallback settings change
  useEffect(() => {
    if (enabled && includeImages && hasInitializedRef.current) {
      // Only re-preload if density or fallback actually changed
      const densityChanged = density !== lastDensityRef.current;
      const fallbackChanged = fallbackToProductImages !== lastFallbackRef.current;

      if (densityChanged || fallbackChanged) {
        lastDensityRef.current = density;
        lastFallbackRef.current = fallbackToProductImages;
        startPreloadingRef.current?.();
      }
    }
  }, [density, fallbackToProductImages, enabled, includeImages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    images,
    isLoading,
    progress,
    isReadyForExport,
    failedImages,
    skippedShots,
    retryImage,
    skipImage,
    skipAllFailed,
    retryAllFailed,
    startPreloading,
    getImageDataMap,
  };
}

export default useImagePreloader;
