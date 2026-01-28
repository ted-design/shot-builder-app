/**
 * Unit tests for previewImageStage.js
 */

import { describe, test, expect } from 'vitest';
import {
  computePreviewImageStageRatio,
  DEFAULT_PREVIEW_STAGE_RATIO,
  MIN_IMAGES_FOR_DOMINANT_BUCKET,
  classifyImageBucket,
  computeDominantBucket,
} from '../previewImageStage';

describe('computePreviewImageStageRatio', () => {
  test('returns "4 / 5" for portrait dimensions (height > width * 1.1)', () => {
    // Tall portrait image
    expect(computePreviewImageStageRatio({ naturalWidth: 800, naturalHeight: 1200 })).toBe('4 / 5');
    // Classic 4:5 portrait
    expect(computePreviewImageStageRatio({ naturalWidth: 800, naturalHeight: 1000 })).toBe('4 / 5');
    // Extreme portrait
    expect(computePreviewImageStageRatio({ naturalWidth: 600, naturalHeight: 1800 })).toBe('4 / 5');
  });

  test('returns "16 / 9" for landscape dimensions (width > height * 1.1)', () => {
    // Wide landscape image
    expect(computePreviewImageStageRatio({ naturalWidth: 1920, naturalHeight: 1080 })).toBe('16 / 9');
    // Moderate landscape
    expect(computePreviewImageStageRatio({ naturalWidth: 1200, naturalHeight: 800 })).toBe('16 / 9');
    // Extreme landscape
    expect(computePreviewImageStageRatio({ naturalWidth: 2000, naturalHeight: 500 })).toBe('16 / 9');
  });

  test('returns "1 / 1" for square-ish dimensions', () => {
    // Perfect square
    expect(computePreviewImageStageRatio({ naturalWidth: 1000, naturalHeight: 1000 })).toBe('1 / 1');
    // Near-square (within 10% tolerance)
    expect(computePreviewImageStageRatio({ naturalWidth: 1000, naturalHeight: 1050 })).toBe('1 / 1');
    expect(computePreviewImageStageRatio({ naturalWidth: 1050, naturalHeight: 1000 })).toBe('1 / 1');
  });

  test('returns default "4 / 5" for invalid dimensions', () => {
    expect(computePreviewImageStageRatio({ naturalWidth: 0, naturalHeight: 100 })).toBe('4 / 5');
    expect(computePreviewImageStageRatio({ naturalWidth: 100, naturalHeight: 0 })).toBe('4 / 5');
    expect(computePreviewImageStageRatio({ naturalWidth: -100, naturalHeight: 100 })).toBe('4 / 5');
    expect(computePreviewImageStageRatio({ naturalWidth: null, naturalHeight: 100 })).toBe('4 / 5');
    expect(computePreviewImageStageRatio({ naturalWidth: undefined, naturalHeight: 100 })).toBe('4 / 5');
    expect(computePreviewImageStageRatio({})).toBe('4 / 5');
  });

  test('handles edge cases at ratio boundaries', () => {
    // Exactly at portrait boundary (ratio ~0.91)
    expect(computePreviewImageStageRatio({ naturalWidth: 910, naturalHeight: 1000 })).toBe('1 / 1');
    // Just below portrait boundary
    expect(computePreviewImageStageRatio({ naturalWidth: 900, naturalHeight: 1000 })).toBe('4 / 5');
    // Exactly at landscape boundary (ratio ~1.1)
    expect(computePreviewImageStageRatio({ naturalWidth: 1100, naturalHeight: 1000 })).toBe('1 / 1');
    // Just above landscape boundary
    expect(computePreviewImageStageRatio({ naturalWidth: 1110, naturalHeight: 1000 })).toBe('16 / 9');
  });
});

describe('DEFAULT_PREVIEW_STAGE_RATIO', () => {
  test('is "4 / 5" (portrait default for e-comm imagery)', () => {
    expect(DEFAULT_PREVIEW_STAGE_RATIO).toBe('4 / 5');
  });
});

describe('MIN_IMAGES_FOR_DOMINANT_BUCKET', () => {
  test('is 2 (requires at least 2 images before switching from default)', () => {
    expect(MIN_IMAGES_FOR_DOMINANT_BUCKET).toBe(2);
  });
});

describe('classifyImageBucket', () => {
  test('returns "portrait" for tall images (ratio < 0.91)', () => {
    expect(classifyImageBucket({ naturalWidth: 800, naturalHeight: 1200 })).toBe('portrait');
    expect(classifyImageBucket({ naturalWidth: 600, naturalHeight: 1800 })).toBe('portrait');
  });

  test('returns "landscape" for wide images (ratio > 1.1)', () => {
    expect(classifyImageBucket({ naturalWidth: 1920, naturalHeight: 1080 })).toBe('landscape');
    expect(classifyImageBucket({ naturalWidth: 2000, naturalHeight: 500 })).toBe('landscape');
  });

  test('returns "square" for square-ish images', () => {
    expect(classifyImageBucket({ naturalWidth: 1000, naturalHeight: 1000 })).toBe('square');
    expect(classifyImageBucket({ naturalWidth: 1000, naturalHeight: 1050 })).toBe('square');
  });

  test('returns "portrait" as default for invalid dimensions', () => {
    expect(classifyImageBucket({ naturalWidth: 0, naturalHeight: 100 })).toBe('portrait');
    expect(classifyImageBucket({ naturalWidth: null, naturalHeight: 100 })).toBe('portrait');
    expect(classifyImageBucket({})).toBe('portrait');
  });
});

describe('computeDominantBucket', () => {
  test('returns portrait ratio when portrait images are dominant', () => {
    const dimensions = [
      { naturalWidth: 800, naturalHeight: 1200 }, // portrait
      { naturalWidth: 700, naturalHeight: 1000 }, // portrait
      { naturalWidth: 1920, naturalHeight: 1080 }, // landscape
    ];
    const result = computeDominantBucket(dimensions);
    expect(result.ratio).toBe('4 / 5');
    expect(result.bucketCounts).toEqual({ portrait: 2, landscape: 1, square: 0 });
    expect(result.totalLoaded).toBe(3);
  });

  test('returns landscape ratio when landscape images are dominant', () => {
    const dimensions = [
      { naturalWidth: 1920, naturalHeight: 1080 }, // landscape
      { naturalWidth: 1600, naturalHeight: 900 },  // landscape
      { naturalWidth: 800, naturalHeight: 1200 },  // portrait
    ];
    const result = computeDominantBucket(dimensions);
    expect(result.ratio).toBe('16 / 9');
    expect(result.bucketCounts).toEqual({ portrait: 1, landscape: 2, square: 0 });
  });

  test('returns square ratio when square images are dominant', () => {
    const dimensions = [
      { naturalWidth: 1000, naturalHeight: 1000 }, // square
      { naturalWidth: 1050, naturalHeight: 1000 }, // square
      { naturalWidth: 800, naturalHeight: 1200 },  // portrait
    ];
    const result = computeDominantBucket(dimensions);
    expect(result.ratio).toBe('1 / 1');
    expect(result.bucketCounts).toEqual({ portrait: 1, landscape: 0, square: 2 });
  });

  test('uses tie-breaker priority: portrait > square > landscape', () => {
    // All buckets equal: portrait wins
    const equalDims = [
      { naturalWidth: 800, naturalHeight: 1200 },  // portrait
      { naturalWidth: 1000, naturalHeight: 1000 }, // square
      { naturalWidth: 1920, naturalHeight: 1080 }, // landscape
    ];
    expect(computeDominantBucket(equalDims).ratio).toBe('4 / 5');

    // Portrait vs square tie: portrait wins
    const portraitSquareTie = [
      { naturalWidth: 800, naturalHeight: 1200 },  // portrait
      { naturalWidth: 1000, naturalHeight: 1000 }, // square
    ];
    expect(computeDominantBucket(portraitSquareTie).ratio).toBe('4 / 5');

    // Square vs landscape tie: square wins
    const squareLandscapeTie = [
      { naturalWidth: 1000, naturalHeight: 1000 }, // square
      { naturalWidth: 1920, naturalHeight: 1080 }, // landscape
    ];
    expect(computeDominantBucket(squareLandscapeTie).ratio).toBe('1 / 1');
  });

  test('handles empty array gracefully', () => {
    const result = computeDominantBucket([]);
    expect(result.ratio).toBe('4 / 5'); // portrait is tie-breaker default
    expect(result.totalLoaded).toBe(0);
    expect(result.bucketCounts).toEqual({ portrait: 0, landscape: 0, square: 0 });
  });

  test('handles single image', () => {
    const result = computeDominantBucket([
      { naturalWidth: 1920, naturalHeight: 1080 }, // landscape
    ]);
    expect(result.ratio).toBe('16 / 9');
    expect(result.totalLoaded).toBe(1);
  });

  test('handles mixed valid and invalid dimensions', () => {
    const dimensions = [
      { naturalWidth: 1920, naturalHeight: 1080 }, // landscape
      { naturalWidth: 0, naturalHeight: 100 },     // invalid -> portrait
      { naturalWidth: 1920, naturalHeight: 1080 }, // landscape
    ];
    const result = computeDominantBucket(dimensions);
    expect(result.ratio).toBe('16 / 9'); // landscape is 2, portrait is 1
    expect(result.bucketCounts).toEqual({ portrait: 1, landscape: 2, square: 0 });
  });
});
