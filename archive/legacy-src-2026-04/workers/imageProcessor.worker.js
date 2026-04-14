/**
 * Image Processing Web Worker
 *
 * Handles image loading and canvas-based cropping off the main thread.
 * This prevents UI freezing during PDF export with many images.
 *
 * Communication Protocol:
 * - Main thread sends: { type: 'process', images: [...], density: string }
 * - Worker responds: { type: 'progress', current, total, shotId }
 * - Worker responds: { type: 'complete', results: Map<shotId, dataUrl> }
 * - Worker responds: { type: 'error', error: string }
 */

// Process a single image using OffscreenCanvas (if available) or regular canvas simulation
async function processImage(imageData, dimensions) {
  const { shotId, url, cropPosition = { x: 50, y: 50 } } = imageData;
  const { width: targetWidth, height: targetHeight } = dimensions;

  try {
    // Fetch the image as a blob
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
      cache: 'force-cache',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch image (${response.status})`);
    }

    const blob = await response.blob();

    // Create ImageBitmap from blob (works in workers)
    const imageBitmap = await createImageBitmap(blob);

    // Use OffscreenCanvas for processing
    const canvas = new OffscreenCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext('2d');

    // Calculate crop area based on focal point
    const focalX = (cropPosition.x ?? 50) / 100;
    const focalY = (cropPosition.y ?? 50) / 100;
    const targetRatio = targetWidth / targetHeight;
    const imgRatio = imageBitmap.width / imageBitmap.height;

    let srcW, srcH, srcX, srcY;

    if (imgRatio > targetRatio) {
      // Image is wider than target - crop horizontally
      srcH = imageBitmap.height;
      srcW = srcH * targetRatio;
      srcX = (focalX * imageBitmap.width) - (srcW / 2);
      srcX = Math.max(0, Math.min(srcX, imageBitmap.width - srcW));
      srcY = 0;
    } else {
      // Image is taller than target - crop vertically
      srcW = imageBitmap.width;
      srcH = srcW / targetRatio;
      srcY = (focalY * imageBitmap.height) - (srcH / 2);
      srcY = Math.max(0, Math.min(srcY, imageBitmap.height - srcH));
      srcX = 0;
    }

    // Draw the cropped portion
    ctx.drawImage(
      imageBitmap,
      srcX, srcY, srcW, srcH,
      0, 0, targetWidth, targetHeight
    );

    // Convert to blob then to data URL
    const outputBlob = await canvas.convertToBlob({
      type: 'image/jpeg',
      quality: 0.85,
    });

    // Convert blob to data URL
    const dataUrl = await blobToDataUrl(outputBlob);

    // Clean up
    imageBitmap.close();

    return { shotId, dataUrl, success: true };
  } catch (error) {
    return {
      shotId,
      dataUrl: null,
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

// Convert blob to data URL
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to data URL'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}

// Get dimensions based on density
function getDimensions(density) {
  const dimensionMap = {
    compact: { width: 400, height: 300 },
    standard: { width: 600, height: 450 },
    detailed: { width: 800, height: 600 },
  };
  return dimensionMap[density] || dimensionMap.standard;
}

// Process images with concurrency control
async function processImages(images, density, concurrency = 3) {
  const dimensions = getDimensions(density);
  const results = new Map();
  const total = images.length;
  let processed = 0;

  // Process in batches for concurrency control
  for (let i = 0; i < images.length; i += concurrency) {
    const batch = images.slice(i, i + concurrency);
    const batchPromises = batch.map(img => processImage(img, dimensions));
    const batchResults = await Promise.allSettled(batchPromises);

    for (const result of batchResults) {
      processed++;
      if (result.status === 'fulfilled' && result.value.success) {
        results.set(result.value.shotId, result.value.dataUrl);
      }
      // Report progress after each image
      self.postMessage({
        type: 'progress',
        current: processed,
        total,
        shotId: result.status === 'fulfilled' ? result.value.shotId : null,
        success: result.status === 'fulfilled' && result.value.success,
      });
    }
  }

  return results;
}

// Handle messages from main thread
self.onmessage = async (event) => {
  const { type, images, density, concurrency } = event.data;

  if (type === 'process') {
    try {
      if (!images || images.length === 0) {
        self.postMessage({ type: 'complete', results: new Map() });
        return;
      }

      const results = await processImages(images, density, concurrency || 3);

      // Convert Map to array of entries for postMessage (Map doesn't serialize well)
      const resultsArray = Array.from(results.entries());
      self.postMessage({ type: 'complete', results: resultsArray });
    } catch (error) {
      self.postMessage({
        type: 'error',
        error: error.message || 'Worker processing failed',
      });
    }
  } else if (type === 'abort') {
    // Handle abort - currently just acknowledges
    self.postMessage({ type: 'aborted' });
  }
};

// Signal that worker is ready
self.postMessage({ type: 'ready' });
