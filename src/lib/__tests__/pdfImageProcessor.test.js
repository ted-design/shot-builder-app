// src/lib/__tests__/pdfImageProcessor.test.js
//
// Unit tests for PDF image processing utilities

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  processImageForPDF,
  processBatchImages,
  getOptimalImageDimensions,
  estimateProcessingTime,
  createThumbnail,
} from '../pdfImageProcessor';

// Mock canvas and image APIs
class MockImage {
  constructor() {
    this.width = 800;
    this.height = 600;
    this.src = '';
    this.crossOrigin = null;
    this.onload = null;
    this.onerror = null;
  }

  // Simulate successful image load
  load() {
    if (this.onload) {
      setTimeout(() => this.onload(), 0);
    }
  }

  // Simulate image load error
  fail(error = new Error('Failed to load')) {
    if (this.onerror) {
      setTimeout(() => this.onerror(error), 0);
    }
  }
}

class MockCanvasRenderingContext2D {
  constructor() {
    this.drawnImages = [];
  }

  drawImage(...args) {
    this.drawnImages.push(args);
  }
}

class MockCanvas {
  constructor() {
    this.width = 0;
    this.height = 0;
    this._context = new MockCanvasRenderingContext2D();
  }

  getContext(type) {
    if (type === '2d') {
      return this._context;
    }
    return null;
  }

  toDataURL(type = 'image/png', quality = 1.0) {
    return `data:${type};base64,mock-image-data-${this.width}x${this.height}-q${quality}`;
  }
}

describe('pdfImageProcessor', () => {
  let originalImage;
  let originalCreateElement;
  let mockImages = [];
  let mockCanvases = [];
  let hardwareConcurrencyDescriptor;

  beforeEach(() => {
    // Save original constructors
    originalImage = global.Image;
    originalCreateElement = global.document?.createElement;

    // Mock Image constructor
    global.Image = class extends MockImage {
      constructor() {
        super();
        mockImages.push(this);
      }
    };

    // Mock document.createElement
    global.document = global.document || {};
    global.document.createElement = (tag) => {
      if (tag === 'canvas') {
        const canvas = new MockCanvas();
        mockCanvases.push(canvas);
        return canvas;
      }
      return originalCreateElement?.call(document, tag) || {};
    };

    // Mock navigator.hardwareConcurrency (read-only property)
    global.navigator = global.navigator || {};
    hardwareConcurrencyDescriptor = Object.getOwnPropertyDescriptor(global.navigator, 'hardwareConcurrency');
    Object.defineProperty(global.navigator, 'hardwareConcurrency', {
      value: 8,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // Restore originals
    if (originalImage) {
      global.Image = originalImage;
    }
    if (originalCreateElement) {
      global.document.createElement = originalCreateElement;
    }

    // Restore navigator.hardwareConcurrency
    if (hardwareConcurrencyDescriptor) {
      Object.defineProperty(global.navigator, 'hardwareConcurrency', hardwareConcurrencyDescriptor);
    } else {
      delete global.navigator.hardwareConcurrency;
    }

    // Clear mocks
    mockImages = [];
    mockCanvases = [];
  });

  describe('getOptimalImageDimensions', () => {
    it('should return compact dimensions', () => {
      const dims = getOptimalImageDimensions('compact');
      expect(dims).toEqual({ width: 400, height: 300 });
    });

    it('should return standard dimensions', () => {
      const dims = getOptimalImageDimensions('standard');
      expect(dims).toEqual({ width: 600, height: 450 });
    });

    it('should return detailed dimensions', () => {
      const dims = getOptimalImageDimensions('detailed');
      expect(dims).toEqual({ width: 800, height: 600 });
    });

    it('should default to standard for invalid density', () => {
      const dims = getOptimalImageDimensions('invalid');
      expect(dims).toEqual({ width: 600, height: 450 });
    });

    it('should default to standard when no density provided', () => {
      const dims = getOptimalImageDimensions();
      expect(dims).toEqual({ width: 600, height: 450 });
    });
  });

  describe('estimateProcessingTime', () => {
    it('should estimate time for single image', () => {
      const time = estimateProcessingTime(1);
      expect(time).toBe(200); // 200ms per image
    });

    it('should estimate time for multiple images', () => {
      const time = estimateProcessingTime(10);
      expect(time).toBe(2000); // 200ms * 10
    });

    it('should return zero for zero images', () => {
      const time = estimateProcessingTime(0);
      expect(time).toBe(0);
    });

    it('should scale linearly', () => {
      const time5 = estimateProcessingTime(5);
      const time10 = estimateProcessingTime(10);
      expect(time10).toBe(time5 * 2);
    });
  });

  describe('processImageForPDF', () => {
    it('should process image with default options', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const promise = processImageForPDF(imageUrl);

      // Simulate image load
      mockImages[0].load();

      const result = await promise;

      // Should return a data URL
      expect(result).toMatch(/^data:image\/jpeg;base64,/);

      // Should have set crossOrigin
      expect(mockImages[0].crossOrigin).toBe('anonymous');

      // Should have created a canvas
      expect(mockCanvases.length).toBe(1);

      // Canvas should have default dimensions
      expect(mockCanvases[0].width).toBe(600); // default targetWidth
      expect(mockCanvases[0].height).toBe(450); // default targetHeight
    });

    it('should process image with custom dimensions', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const promise = processImageForPDF(imageUrl, {
        targetWidth: 800,
        targetHeight: 600,
      });

      mockImages[0].load();
      const result = await promise;

      expect(mockCanvases[0].width).toBe(800);
      expect(mockCanvases[0].height).toBe(600);
      expect(result).toBeTruthy();
    });

    it('should process image with custom crop position', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const promise = processImageForPDF(imageUrl, {
        cropPosition: { x: 75, y: 25 }, // Top-right focal point
      });

      mockImages[0].load();
      const result = await promise;

      // Should have drawn the image (crop logic in cropImageToFocalPoint)
      expect(mockCanvases[0]._context.drawnImages.length).toBe(1);
      expect(result).toBeTruthy();
    });

    it('should use custom quality setting', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const promise = processImageForPDF(imageUrl, {
        quality: 0.5,
      });

      mockImages[0].load();
      const result = await promise;

      // Data URL should include quality parameter
      expect(result).toContain('-q0.5');
    });

    it('should handle crossOrigin null (disable CORS)', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const promise = processImageForPDF(imageUrl, {
        crossOrigin: null,
      });

      mockImages[0].load();
      await promise;

      expect(mockImages[0].crossOrigin).toBe(null);
    });

    it('should reject on image load error', async () => {
      const imageUrl = 'https://example.com/bad-image.jpg';
      const promise = processImageForPDF(imageUrl);

      // Simulate image load failure
      mockImages[0].fail();

      await expect(promise).rejects.toThrow();
    });

    it('should handle data URLs', async () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KG...';
      const promise = processImageForPDF(dataUrl);

      mockImages[0].load();
      const result = await promise;

      expect(result).toBeTruthy();
      expect(mockImages[0].src).toBe(dataUrl);
    });
  });

  describe('processBatchImages', () => {
    it('should process multiple images', async () => {
      const images = [
        { url: 'https://example.com/image1.jpg', cropPosition: { x: 50, y: 50 } },
        { url: 'https://example.com/image2.jpg', cropPosition: { x: 50, y: 50 } },
        { url: 'https://example.com/image3.jpg', cropPosition: { x: 50, y: 50 } },
      ];

      const promise = processBatchImages(images, {
        targetWidth: 600,
        targetHeight: 450,
      });

      // Load all images
      mockImages.forEach(img => img.load());

      const results = await promise;

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toMatch(/^data:image\/jpeg;base64,/);
      });
    });

    it('should call progress callback', async () => {
      const images = [
        { url: 'https://example.com/image1.jpg', cropPosition: { x: 50, y: 50 } },
        { url: 'https://example.com/image2.jpg', cropPosition: { x: 50, y: 50 } },
        { url: 'https://example.com/image3.jpg', cropPosition: { x: 50, y: 50 } },
      ];

      const progressCalls = [];
      const onProgress = (processed, total) => {
        progressCalls.push({ processed, total });
      };

      const promise = processBatchImages(images, {
        onProgress,
      });

      // Load all images
      mockImages.forEach(img => img.load());

      await promise;

      // Should have called progress callback for each image
      expect(progressCalls.length).toBe(3);
      expect(progressCalls[0]).toEqual({ processed: 1, total: 3 });
      expect(progressCalls[1]).toEqual({ processed: 2, total: 3 });
      expect(progressCalls[2]).toEqual({ processed: 3, total: 3 });
    });

    it('should handle individual image failures gracefully', async () => {
      const images = [
        { url: 'https://example.com/image1.jpg', cropPosition: { x: 50, y: 50 } },
        { url: 'https://example.com/bad-image.jpg', cropPosition: { x: 50, y: 50 } },
        { url: 'https://example.com/image3.jpg', cropPosition: { x: 50, y: 50 } },
      ];

      const promise = processBatchImages(images);

      // Load first and third, fail second
      mockImages[0].load();
      mockImages[1].fail();
      mockImages[2].load();

      const results = await promise;

      expect(results).toHaveLength(3);
      expect(results[0]).toBeTruthy(); // Success
      expect(results[1]).toBe(null); // Failed
      expect(results[2]).toBeTruthy(); // Success
    });

    it('should respect concurrency limit', async () => {
      const images = Array.from({ length: 20 }, (_, i) => ({
        url: `https://example.com/image${i}.jpg`,
        cropPosition: { x: 50, y: 50 },
      }));

      const promise = processBatchImages(images, {
        concurrency: 5, // Process 5 at a time
      });

      // At first, should only have 5 images loading
      expect(mockImages.length).toBeLessThanOrEqual(5);

      // Load all images progressively
      let loadedCount = 0;
      const loadNext = () => {
        if (loadedCount < mockImages.length) {
          mockImages[loadedCount].load();
          loadedCount++;
          setTimeout(loadNext, 0);
        }
      };
      loadNext();

      const results = await promise;

      expect(results).toHaveLength(20);
    });

    it('should handle empty image array', async () => {
      const results = await processBatchImages([]);
      expect(results).toEqual([]);
    });

    it('should maintain order of results', async () => {
      const images = [
        { url: 'https://example.com/image1.jpg', cropPosition: { x: 50, y: 50 } },
        { url: 'https://example.com/image2.jpg', cropPosition: { x: 50, y: 50 } },
        { url: 'https://example.com/image3.jpg', cropPosition: { x: 50, y: 50 } },
      ];

      const promise = processBatchImages(images);

      // Load in reverse order to test ordering
      mockImages[2].load();
      mockImages[1].load();
      mockImages[0].load();

      const results = await promise;

      // Results should still be in original order
      expect(results[0]).toContain('600x450'); // First image result
      expect(results[1]).toContain('600x450'); // Second image result
      expect(results[2]).toContain('600x450'); // Third image result
    });
  });

  describe('createThumbnail', () => {
    it('should create square thumbnail with default size', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const promise = createThumbnail(imageUrl);

      mockImages[0].load();
      const result = await promise;

      expect(result).toBeTruthy();
      expect(mockCanvases[0].width).toBe(100); // default size
      expect(mockCanvases[0].height).toBe(100); // square
    });

    it('should create thumbnail with custom size', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const promise = createThumbnail(imageUrl, { x: 50, y: 50 }, 200);

      mockImages[0].load();
      const result = await promise;

      expect(mockCanvases[0].width).toBe(200);
      expect(mockCanvases[0].height).toBe(200);
      expect(result).toBeTruthy();
    });

    it('should use custom crop position', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const cropPosition = { x: 75, y: 25 };
      const promise = createThumbnail(imageUrl, cropPosition, 150);

      mockImages[0].load();
      const result = await promise;

      // Should have created canvas and drawn image
      expect(mockCanvases.length).toBe(1);
      expect(mockCanvases[0]._context.drawnImages.length).toBe(1);
      expect(result).toBeTruthy();
    });

    it('should use lower quality for thumbnails', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const promise = createThumbnail(imageUrl);

      mockImages[0].load();
      const result = await promise;

      // Should use quality 0.7 for thumbnails
      expect(result).toContain('-q0.7');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle very small target dimensions', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const promise = processImageForPDF(imageUrl, {
        targetWidth: 10,
        targetHeight: 10,
      });

      mockImages[0].load();
      const result = await promise;

      expect(mockCanvases[0].width).toBe(10);
      expect(mockCanvases[0].height).toBe(10);
      expect(result).toBeTruthy();
    });

    it('should handle very large target dimensions', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const promise = processImageForPDF(imageUrl, {
        targetWidth: 4000,
        targetHeight: 3000,
      });

      mockImages[0].load();
      const result = await promise;

      expect(mockCanvases[0].width).toBe(4000);
      expect(mockCanvases[0].height).toBe(3000);
      expect(result).toBeTruthy();
    });

    it('should handle extreme crop positions', async () => {
      const imageUrl = 'https://example.com/image.jpg';

      // Top-left corner
      const promise1 = processImageForPDF(imageUrl, {
        cropPosition: { x: 0, y: 0 },
      });
      mockImages[0].load();
      const result1 = await promise1;
      expect(result1).toBeTruthy();

      // Bottom-right corner
      const promise2 = processImageForPDF(imageUrl, {
        cropPosition: { x: 100, y: 100 },
      });
      mockImages[1].load();
      const result2 = await promise2;
      expect(result2).toBeTruthy();
    });

    it('should handle invalid crop positions gracefully', async () => {
      const imageUrl = 'https://example.com/image.jpg';

      // Out of bounds values should be clamped
      const promise = processImageForPDF(imageUrl, {
        cropPosition: { x: 150, y: -50 }, // Invalid values
      });

      mockImages[0].load();
      const result = await promise;

      // Should still succeed (values clamped internally)
      expect(result).toBeTruthy();
    });
  });

  describe('Integration: Full Workflow', () => {
    it('should process batch of images with different configurations', async () => {
      const images = [
        {
          url: 'https://example.com/compact.jpg',
          cropPosition: { x: 50, y: 50 },
        },
        {
          url: 'https://example.com/standard.jpg',
          cropPosition: { x: 30, y: 70 },
        },
        {
          url: 'https://example.com/detailed.jpg',
          cropPosition: { x: 80, y: 20 },
        },
      ];

      const dims = getOptimalImageDimensions('standard');
      const estimatedTime = estimateProcessingTime(images.length);

      expect(estimatedTime).toBe(600); // 200ms * 3

      const promise = processBatchImages(images, {
        targetWidth: dims.width,
        targetHeight: dims.height,
        quality: 0.85,
      });

      mockImages.forEach(img => img.load());

      const results = await promise;

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeTruthy();
        expect(result).toMatch(/^data:image\/jpeg;base64,/);
      });
    });
  });
});
