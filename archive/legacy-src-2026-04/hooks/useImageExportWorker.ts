/**
 * useImageExportWorker - Manages Web Worker for PDF image processing
 *
 * This hook processes images OFF the main thread during PDF export.
 * Unlike useImagePreloader, this does NOT run during preview - only when export is triggered.
 *
 * Benefits:
 * - Main thread stays responsive during image processing
 * - Progress reporting with accurate percentage
 * - Cancellation support
 * - Memory efficient - processes images in batches
 */

import { useCallback, useRef, useState } from 'react';
import { resolveImageSource } from '../lib/storage/adapters';
import { getPrimaryAttachment } from '../lib/imageHelpers';

// Import worker using Vite's worker syntax
import ImageWorker from '../workers/imageProcessor.worker.js?worker';

export interface ExportProgress {
  current: number;
  total: number;
  percentage: number;
  stage: 'idle' | 'resolving' | 'processing' | 'complete' | 'error';
  message: string;
}

export interface ImageExportResult {
  imageDataMap: Map<string, string>;
  failedCount: number;
  successCount: number;
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

export function useImageExportWorker() {
  const [progress, setProgress] = useState<ExportProgress>({
    current: 0,
    total: 0,
    percentage: 0,
    stage: 'idle',
    message: '',
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const abortRef = useRef(false);

  /**
   * Process all images for export using Web Worker
   * This is called ONLY when user clicks Download PDF
   */
  const processImagesForExport = useCallback(async (
    lanes: Lane[],
    density: 'compact' | 'standard' | 'detailed' = 'standard',
    fallbackToProductImages: boolean = false
  ): Promise<ImageExportResult> => {
    // Reset state
    abortRef.current = false;
    setIsProcessing(true);

    // Collect all images that need processing
    const imagesToProcess: Array<{
      shotId: string;
      shotName: string;
      source: string;
      cropPosition: { x: number; y: number };
    }> = [];

    setProgress({
      current: 0,
      total: 0,
      percentage: 0,
      stage: 'resolving',
      message: 'Collecting images...',
    });

    // Collect shots with images
    for (const lane of lanes) {
      const laneShots = Array.isArray(lane.shots) ? lane.shots : [];
      for (const shot of laneShots) {
        if (!shot?.id) continue;

        let imageSource = shot.image;
        if (!imageSource && fallbackToProductImages) {
          const hasProductImages = Array.isArray(shot.productImages) && shot.productImages.length > 0;
          if (hasProductImages) {
            imageSource = shot.productImages.find(Boolean);
          }
        }

        if (!imageSource) continue;

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

        imagesToProcess.push({
          shotId: String(shot.id),
          shotName: shot.name || `Shot ${shot.id}`,
          source: imageSource,
          cropPosition,
        });
      }
    }

    if (imagesToProcess.length === 0) {
      setProgress({
        current: 0,
        total: 0,
        percentage: 100,
        stage: 'complete',
        message: 'No images to process',
      });
      setIsProcessing(false);
      return { imageDataMap: new Map(), failedCount: 0, successCount: 0 };
    }

    setProgress({
      current: 0,
      total: imagesToProcess.length,
      percentage: 0,
      stage: 'resolving',
      message: `Resolving ${imagesToProcess.length} image URLs...`,
    });

    // Step 1: Resolve all image URLs (Firebase Storage paths → download URLs)
    // This must happen on main thread because it uses Firebase SDK
    const resolvedImages: Array<{
      shotId: string;
      url: string;
      cropPosition: { x: number; y: number };
    }> = [];

    let resolveCount = 0;
    for (const img of imagesToProcess) {
      if (abortRef.current) break;

      try {
        const result = await resolveImageSource(img.source);
        resolvedImages.push({
          shotId: img.shotId,
          url: result.url,
          cropPosition: img.cropPosition,
        });
      } catch (error) {
        console.warn(`[useImageExportWorker] Failed to resolve image for ${img.shotId}:`, error);
        // Continue with other images
      }

      resolveCount++;
      const resolvePercentage = Math.round((resolveCount / imagesToProcess.length) * 30); // First 30%
      setProgress({
        current: resolveCount,
        total: imagesToProcess.length,
        percentage: resolvePercentage,
        stage: 'resolving',
        message: `Resolving URLs: ${resolveCount}/${imagesToProcess.length}`,
      });
    }

    if (abortRef.current) {
      setIsProcessing(false);
      return { imageDataMap: new Map(), failedCount: imagesToProcess.length, successCount: 0 };
    }

    if (resolvedImages.length === 0) {
      setProgress({
        current: 0,
        total: 0,
        percentage: 100,
        stage: 'error',
        message: 'Failed to resolve any image URLs',
      });
      setIsProcessing(false);
      return { imageDataMap: new Map(), failedCount: imagesToProcess.length, successCount: 0 };
    }

    // Step 2: Process images in Web Worker
    setProgress({
      current: 0,
      total: resolvedImages.length,
      percentage: 30,
      stage: 'processing',
      message: 'Processing images...',
    });

    return new Promise((resolve) => {
      // Create worker
      const worker = new ImageWorker();
      workerRef.current = worker;

      let successCount = 0;
      let failedCount = 0;

      worker.onmessage = (event) => {
        const { type, current, total, success, results, error } = event.data;

        if (type === 'progress') {
          if (success) {
            successCount++;
          } else {
            failedCount++;
          }
          const processingPercentage = 30 + Math.round((current / total) * 70); // 30-100%
          setProgress({
            current,
            total,
            percentage: processingPercentage,
            stage: 'processing',
            message: `Processing: ${current}/${total} images`,
          });
        } else if (type === 'complete') {
          // Convert results array back to Map
          const imageDataMap = new Map<string, string>(results);

          setProgress({
            current: resolvedImages.length,
            total: resolvedImages.length,
            percentage: 100,
            stage: 'complete',
            message: `Processed ${successCount} images`,
          });

          worker.terminate();
          workerRef.current = null;
          setIsProcessing(false);

          resolve({
            imageDataMap,
            failedCount: resolvedImages.length - imageDataMap.size,
            successCount: imageDataMap.size,
          });
        } else if (type === 'error') {
          console.error('[useImageExportWorker] Worker error:', error);
          setProgress({
            current: 0,
            total: resolvedImages.length,
            percentage: 0,
            stage: 'error',
            message: `Error: ${error}`,
          });

          worker.terminate();
          workerRef.current = null;
          setIsProcessing(false);

          resolve({
            imageDataMap: new Map(),
            failedCount: resolvedImages.length,
            successCount: 0,
          });
        }
      };

      worker.onerror = (error) => {
        console.error('[useImageExportWorker] Worker error:', error);
        setProgress({
          current: 0,
          total: resolvedImages.length,
          percentage: 0,
          stage: 'error',
          message: 'Worker failed unexpectedly',
        });

        worker.terminate();
        workerRef.current = null;
        setIsProcessing(false);

        resolve({
          imageDataMap: new Map(),
          failedCount: resolvedImages.length,
          successCount: 0,
        });
      };

      // Send images to worker for processing
      worker.postMessage({
        type: 'process',
        images: resolvedImages,
        density,
        concurrency: 3,
      });
    });
  }, []);

  /**
   * Cancel ongoing processing
   */
  const cancelProcessing = useCallback(() => {
    abortRef.current = true;
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setIsProcessing(false);
    setProgress({
      current: 0,
      total: 0,
      percentage: 0,
      stage: 'idle',
      message: 'Cancelled',
    });
  }, []);

  /**
   * Reset progress state
   */
  const resetProgress = useCallback(() => {
    setProgress({
      current: 0,
      total: 0,
      percentage: 0,
      stage: 'idle',
      message: '',
    });
  }, []);

  return {
    processImagesForExport,
    cancelProcessing,
    resetProgress,
    progress,
    isProcessing,
  };
}

export default useImageExportWorker;
