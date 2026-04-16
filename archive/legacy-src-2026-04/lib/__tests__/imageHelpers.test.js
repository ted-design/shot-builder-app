/**
 * Unit tests for imageHelpers.js
 */

import { describe, test, expect } from 'vitest';
import {
  getCropTransformStyle,
  getCropObjectPosition,
  getCoverSourceType,
  resolveShotCoverImage,
  resolveShotCoverWithCrop,
  COVER_SOURCE,
  getPrimaryAttachment,
  getShotImagePath,
  hasMultipleAttachments,
  getAttachmentCount,
} from '../imageHelpers';

describe('getCropTransformStyle', () => {
  test('returns empty object for null cropData', () => {
    expect(getCropTransformStyle(null)).toEqual({});
  });

  test('returns empty object for undefined cropData', () => {
    expect(getCropTransformStyle(undefined)).toEqual({});
  });

  test('returns empty object for invalid width', () => {
    expect(getCropTransformStyle({ width: 0 })).toEqual({});
    expect(getCropTransformStyle({ width: -10 })).toEqual({});
    expect(getCropTransformStyle({ width: 'invalid' })).toEqual({});
  });

  test('returns empty object for invalid height', () => {
    expect(getCropTransformStyle({ height: 0 })).toEqual({});
    expect(getCropTransformStyle({ height: -10 })).toEqual({});
    expect(getCropTransformStyle({ height: 'invalid' })).toEqual({});
  });

  test('calculates correct focal point for centered crop', () => {
    const result = getCropTransformStyle({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      zoom: 1,
      rotation: 0,
    });
    expect(result.transformOrigin).toBe('50% 50%');
    expect(result.transform).toBe('scale(1) rotate(0deg)');
  });

  test('calculates correct focal point for offset crop', () => {
    const result = getCropTransformStyle({
      x: 20,
      y: 30,
      width: 40,
      height: 60,
      zoom: 1.5,
      rotation: 45,
    });
    // Focal point: x + width/2 = 20 + 20 = 40, y + height/2 = 30 + 30 = 60
    expect(result.transformOrigin).toBe('40% 60%');
    expect(result.transform).toBe('scale(1.5) rotate(45deg)');
  });

  test('uses default values for missing properties', () => {
    const result = getCropTransformStyle({});
    expect(result.transformOrigin).toBe('50% 50%');
    expect(result.transform).toBe('scale(1) rotate(0deg)');
  });
});

describe('getCropObjectPosition', () => {
  test('returns undefined for null cropData', () => {
    expect(getCropObjectPosition(null)).toBeUndefined();
  });

  test('returns undefined for undefined cropData', () => {
    expect(getCropObjectPosition(undefined)).toBeUndefined();
  });

  test('returns undefined for invalid width', () => {
    expect(getCropObjectPosition({ width: 0 })).toBeUndefined();
    expect(getCropObjectPosition({ width: -10 })).toBeUndefined();
    expect(getCropObjectPosition({ width: 'invalid' })).toBeUndefined();
  });

  test('returns undefined for invalid height', () => {
    expect(getCropObjectPosition({ height: 0 })).toBeUndefined();
    expect(getCropObjectPosition({ height: -10 })).toBeUndefined();
    expect(getCropObjectPosition({ height: 'invalid' })).toBeUndefined();
  });

  test('calculates correct position for centered crop', () => {
    const result = getCropObjectPosition({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    expect(result).toBe('50% 50%');
  });

  test('calculates correct position for offset crop', () => {
    const result = getCropObjectPosition({
      x: 20,
      y: 30,
      width: 40,
      height: 60,
    });
    // Focal point: x + width/2 = 20 + 20 = 40, y + height/2 = 30 + 30 = 60
    expect(result).toBe('40% 60%');
  });

  test('uses default values for missing properties', () => {
    const result = getCropObjectPosition({});
    expect(result).toBe('50% 50%');
  });
});

describe('getCoverSourceType', () => {
  test('returns AUTO for null shot', () => {
    expect(getCoverSourceType(null)).toBe(COVER_SOURCE.AUTO);
  });

  test('returns AUTO for shot without looks', () => {
    expect(getCoverSourceType({})).toBe(COVER_SOURCE.AUTO);
    expect(getCoverSourceType({ looks: [] })).toBe(COVER_SOURCE.AUTO);
  });

  test('returns REFERENCE when displayImageId is set with valid reference', () => {
    const shot = {
      looks: [{
        displayImageId: 'ref-1',
        references: [{ id: 'ref-1', path: 'image.jpg' }],
      }],
    };
    expect(getCoverSourceType(shot)).toBe(COVER_SOURCE.REFERENCE);
  });

  test('returns AUTO when displayImageId points to missing reference', () => {
    const shot = {
      looks: [{
        displayImageId: 'ref-missing',
        references: [{ id: 'ref-1', path: 'image.jpg' }],
      }],
    };
    expect(getCoverSourceType(shot)).toBe(COVER_SOURCE.AUTO);
  });

  test('returns HERO_PRODUCT when heroProductId is set with valid product image', () => {
    const shot = {
      looks: [{
        heroProductId: 'prod-1',
        products: [{ productId: 'prod-1', colourImagePath: 'product.jpg' }],
      }],
    };
    expect(getCoverSourceType(shot)).toBe(COVER_SOURCE.HERO_PRODUCT);
  });

  test('returns HERO_PRODUCT when heroProductId uses thumbnailImagePath', () => {
    const shot = {
      looks: [{
        heroProductId: 'prod-1',
        products: [{ productId: 'prod-1', thumbnailImagePath: 'thumb.jpg' }],
      }],
    };
    expect(getCoverSourceType(shot)).toBe(COVER_SOURCE.HERO_PRODUCT);
  });

  test('returns AUTO when heroProductId has no image', () => {
    const shot = {
      looks: [{
        heroProductId: 'prod-1',
        products: [{ productId: 'prod-1' }],
      }],
    };
    expect(getCoverSourceType(shot)).toBe(COVER_SOURCE.AUTO);
  });

  test('REFERENCE takes priority over HERO_PRODUCT', () => {
    const shot = {
      looks: [{
        displayImageId: 'ref-1',
        references: [{ id: 'ref-1', path: 'ref.jpg' }],
        heroProductId: 'prod-1',
        products: [{ productId: 'prod-1', colourImagePath: 'product.jpg' }],
      }],
    };
    expect(getCoverSourceType(shot)).toBe(COVER_SOURCE.REFERENCE);
  });
});

describe('resolveShotCoverImage', () => {
  test('returns null for null shot', () => {
    expect(resolveShotCoverImage(null)).toBeNull();
  });

  test('returns displayImage path from looks (Priority 1)', () => {
    const shot = {
      looks: [{
        displayImageId: 'ref-1',
        references: [{ id: 'ref-1', downloadURL: 'https://example.com/ref.jpg' }],
      }],
    };
    expect(resolveShotCoverImage(shot)).toBe('https://example.com/ref.jpg');
  });

  test('returns displayImage path fallback from looks (Priority 1)', () => {
    const shot = {
      looks: [{
        displayImageId: 'ref-1',
        references: [{ id: 'ref-1', path: '/path/to/ref.jpg' }],
      }],
    };
    expect(resolveShotCoverImage(shot)).toBe('/path/to/ref.jpg');
  });

  test('skips missing displayImage and falls back (Priority 1 edge case)', () => {
    const shot = {
      looks: [{
        displayImageId: 'missing-ref',
        references: [{ id: 'ref-1', path: 'first.jpg' }],
      }],
    };
    // Falls back to Priority 3: first reference
    expect(resolveShotCoverImage(shot)).toBe('first.jpg');
  });

  test('returns hero product image (Priority 2)', () => {
    const shot = {
      looks: [{
        heroProductId: 'prod-1',
        products: [{ productId: 'prod-1', colourImagePath: 'product.jpg' }],
      }],
    };
    expect(resolveShotCoverImage(shot)).toBe('product.jpg');
  });

  test('returns first reference image (Priority 3)', () => {
    const shot = {
      looks: [{
        references: [{ downloadURL: 'first-ref.jpg' }],
      }],
    };
    expect(resolveShotCoverImage(shot)).toBe('first-ref.jpg');
  });

  test('returns primary attachment (Priority 4)', () => {
    const shot = {
      attachments: [
        { isPrimary: false, path: 'second.jpg' },
        { isPrimary: true, downloadURL: 'primary.jpg' },
      ],
    };
    expect(resolveShotCoverImage(shot)).toBe('primary.jpg');
  });

  test('returns first attachment when no primary (Priority 4)', () => {
    const shot = {
      attachments: [{ path: 'first.jpg' }, { path: 'second.jpg' }],
    };
    expect(resolveShotCoverImage(shot)).toBe('first.jpg');
  });

  test('returns referenceImagePath (Priority 5)', () => {
    const shot = { referenceImagePath: 'legacy.jpg' };
    expect(resolveShotCoverImage(shot)).toBe('legacy.jpg');
  });

  test('returns product thumbnailImagePath (Priority 6)', () => {
    const shot = { products: [{ thumbnailImagePath: 'thumb.jpg' }] };
    expect(resolveShotCoverImage(shot)).toBe('thumb.jpg');
  });

  test('returns product from products param (Priority 6)', () => {
    const shot = {};
    const products = [{ thumbnailImagePath: 'external-thumb.jpg' }];
    expect(resolveShotCoverImage(shot, products)).toBe('external-thumb.jpg');
  });

  test('returns null when no images available', () => {
    expect(resolveShotCoverImage({})).toBeNull();
    expect(resolveShotCoverImage({ looks: [] })).toBeNull();
  });
});

describe('resolveShotCoverWithCrop', () => {
  test('returns null path and cropData for null shot', () => {
    expect(resolveShotCoverWithCrop(null)).toEqual({ path: null, cropData: null });
  });

  test('returns cropData for displayImage reference', () => {
    const cropData = { x: 10, y: 20, width: 80, height: 60, zoom: 1.2, rotation: 15 };
    const shot = {
      looks: [{
        displayImageId: 'ref-1',
        references: [{ id: 'ref-1', path: 'ref.jpg', cropData }],
      }],
    };
    const result = resolveShotCoverWithCrop(shot);
    expect(result.path).toBe('ref.jpg');
    expect(result.cropData).toEqual(cropData);
  });

  test('returns null cropData for hero product', () => {
    const shot = {
      looks: [{
        heroProductId: 'prod-1',
        products: [{ productId: 'prod-1', colourImagePath: 'product.jpg' }],
      }],
    };
    const result = resolveShotCoverWithCrop(shot);
    expect(result.path).toBe('product.jpg');
    expect(result.cropData).toBeNull();
  });

  test('returns cropData for first reference', () => {
    const cropData = { x: 5, y: 10, width: 90, height: 80 };
    const shot = {
      looks: [{
        references: [{ path: 'ref.jpg', cropData }],
      }],
    };
    const result = resolveShotCoverWithCrop(shot);
    expect(result.path).toBe('ref.jpg');
    expect(result.cropData).toEqual(cropData);
  });

  test('returns cropData for primary attachment', () => {
    const cropData = { x: 0, y: 0, width: 100, height: 100, zoom: 1.5 };
    const shot = {
      attachments: [{ isPrimary: true, path: 'att.jpg', cropData }],
    };
    const result = resolveShotCoverWithCrop(shot);
    expect(result.path).toBe('att.jpg');
    expect(result.cropData).toEqual(cropData);
  });

  test('returns legacy referenceImageCrop', () => {
    const cropData = { x: 25, y: 25, width: 50, height: 50 };
    const shot = {
      referenceImagePath: 'legacy.jpg',
      referenceImageCrop: cropData,
    };
    const result = resolveShotCoverWithCrop(shot);
    expect(result.path).toBe('legacy.jpg');
    expect(result.cropData).toEqual(cropData);
  });
});

describe('getPrimaryAttachment', () => {
  test('returns null for null/undefined/empty', () => {
    expect(getPrimaryAttachment(null)).toBeNull();
    expect(getPrimaryAttachment(undefined)).toBeNull();
    expect(getPrimaryAttachment([])).toBeNull();
  });

  test('returns attachment marked as primary', () => {
    const attachments = [
      { id: '1', isPrimary: false },
      { id: '2', isPrimary: true },
    ];
    expect(getPrimaryAttachment(attachments)).toEqual({ id: '2', isPrimary: true });
  });

  test('returns first attachment when no primary', () => {
    const attachments = [{ id: '1' }, { id: '2' }];
    expect(getPrimaryAttachment(attachments)).toEqual({ id: '1' });
  });
});

describe('getShotImagePath', () => {
  test('returns null for null shot', () => {
    expect(getShotImagePath(null)).toBeNull();
  });

  test('returns primary attachment path', () => {
    const shot = {
      attachments: [{ isPrimary: true, downloadURL: 'primary.jpg' }],
    };
    expect(getShotImagePath(shot)).toBe('primary.jpg');
  });

  test('returns referenceImagePath when no attachments', () => {
    const shot = { referenceImagePath: 'ref.jpg' };
    expect(getShotImagePath(shot)).toBe('ref.jpg');
  });

  test('returns product image as fallback', () => {
    const shot = {
      products: [{ thumbnailImagePath: 'thumb.jpg' }],
    };
    expect(getShotImagePath(shot)).toBe('thumb.jpg');
  });
});

describe('hasMultipleAttachments', () => {
  test('returns false for shot with 0-1 attachments', () => {
    expect(hasMultipleAttachments(null)).toBe(false);
    expect(hasMultipleAttachments({})).toBe(false);
    expect(hasMultipleAttachments({ attachments: [] })).toBe(false);
    expect(hasMultipleAttachments({ attachments: [{}] })).toBe(false);
  });

  test('returns true for shot with 2+ attachments', () => {
    expect(hasMultipleAttachments({ attachments: [{}, {}] })).toBe(true);
    expect(hasMultipleAttachments({ attachments: [{}, {}, {}] })).toBe(true);
  });
});

describe('getAttachmentCount', () => {
  test('returns 0 for null/undefined shot', () => {
    expect(getAttachmentCount(null)).toBe(0);
    expect(getAttachmentCount(undefined)).toBe(0);
  });

  test('returns 0 for shot without attachments', () => {
    expect(getAttachmentCount({})).toBe(0);
  });

  test('returns correct count', () => {
    expect(getAttachmentCount({ attachments: [] })).toBe(0);
    expect(getAttachmentCount({ attachments: [{}] })).toBe(1);
    expect(getAttachmentCount({ attachments: [{}, {}, {}] })).toBe(3);
  });
});
