import { describe, it, expect } from 'vitest';
import {
  normalizeExportImageFlags,
  shouldRenderExportImage,
} from '../exportImageOptions';

// =============================================================================
// normalizeExportImageFlags
// =============================================================================

describe('normalizeExportImageFlags', () => {
  it('fields.image=true → all image flags enabled', () => {
    const result = normalizeExportImageFlags({
      fields: { image: true, shotNumber: true },
      includeImages: false, // legacy disagrees — must be overridden
    });

    expect(result.fields.image).toBe(true);
    expect(result.includeImages).toBe(true);
    expect(result.fallbackToProductImages).toBe(true);
    expect(result.inlineImages).toBe(true);
    // Non-image fields preserved
    expect(result.fields.shotNumber).toBe(true);
  });

  it('fields.image=false → all image flags disabled', () => {
    const result = normalizeExportImageFlags({
      fields: { image: false },
      includeImages: true, // legacy disagrees — must be overridden
      fallbackToProductImages: true,
      inlineImages: true,
    });

    expect(result.fields.image).toBe(false);
    expect(result.includeImages).toBe(false);
    expect(result.fallbackToProductImages).toBe(false);
    expect(result.inlineImages).toBe(false);
  });

  it('fields.image takes precedence over includeImages', () => {
    const onCase = normalizeExportImageFlags({
      fields: { image: true },
      includeImages: false,
    });
    expect(onCase.includeImages).toBe(true);

    const offCase = normalizeExportImageFlags({
      fields: { image: false },
      includeImages: true,
    });
    expect(offCase.includeImages).toBe(false);
  });

  it('falls back to includeImages when fields.image is undefined', () => {
    const result = normalizeExportImageFlags({
      includeImages: true,
    });
    expect(result.fields.image).toBe(true);
    expect(result.includeImages).toBe(true);
  });

  it('defaults to false when no image flags provided', () => {
    const result = normalizeExportImageFlags({});
    expect(result.fields.image).toBe(false);
    expect(result.includeImages).toBe(false);
    expect(result.fallbackToProductImages).toBe(false);
    expect(result.inlineImages).toBe(false);
  });

  it('preserves non-image fields in the returned object', () => {
    const result = normalizeExportImageFlags({
      title: 'My Export',
      density: 'compact',
      fields: { image: true, notes: true, talent: false },
    } as any);

    expect(result.title).toBe('My Export');
    expect(result.density).toBe('compact');
    expect(result.fields.notes).toBe(true);
    expect(result.fields.talent).toBe(false);
  });

  it('respects explicit fallbackToProductImages=false when images ON', () => {
    const result = normalizeExportImageFlags({
      fields: { image: true },
      fallbackToProductImages: false,
    });
    expect(result.fallbackToProductImages).toBe(false);
  });

  it('respects explicit inlineImages=false when images ON', () => {
    const result = normalizeExportImageFlags({
      fields: { image: true },
      inlineImages: false,
    });
    expect(result.inlineImages).toBe(false);
  });
});

// =============================================================================
// shouldRenderExportImage — PDF path regression tests
// =============================================================================

describe('shouldRenderExportImage', () => {
  const ON = { fields: { image: true }, fallbackToProductImages: true };
  const OFF = { fields: { image: false }, fallbackToProductImages: true };

  it('fields.image=true + shot has image → true', () => {
    expect(
      shouldRenderExportImage(ON, { image: 'https://example.com/img.jpg' })
    ).toBe(true);
  });

  it('fields.image=false → false (even if shot has image)', () => {
    expect(
      shouldRenderExportImage(OFF, { image: 'https://example.com/img.jpg' })
    ).toBe(false);
  });

  it('fields.image=false + legacy includeImages was true → still false', () => {
    // This simulates the old bug: includeImages=true but fields.image=false
    const badLegacy = { fields: { image: false }, includeImages: true } as any;
    expect(
      shouldRenderExportImage(badLegacy, { image: 'https://example.com/img.jpg' })
    ).toBe(false);
  });

  it('fields.image=true + shot missing image + fallback available → true', () => {
    expect(
      shouldRenderExportImage(ON, { image: null }, true)
    ).toBe(true);
  });

  it('fields.image=true + shot missing image + fallback NOT available → false', () => {
    expect(
      shouldRenderExportImage(ON, { image: null }, false)
    ).toBe(false);
  });

  it('fields.image=true + shot missing image + fallback disabled → false', () => {
    const noFallback = { fields: { image: true }, fallbackToProductImages: false };
    expect(
      shouldRenderExportImage(noFallback, { image: null }, true)
    ).toBe(false);
  });

  it('rejects __PREVIEW_PLACEHOLDER__ as a real image', () => {
    expect(
      shouldRenderExportImage(ON, { image: '__PREVIEW_PLACEHOLDER__' })
    ).toBe(false);
  });

  it('handles null/undefined shot gracefully', () => {
    expect(shouldRenderExportImage(ON, null)).toBe(false);
    expect(shouldRenderExportImage(ON, undefined)).toBe(false);
  });

  it('handles missing options gracefully', () => {
    expect(shouldRenderExportImage({}, { image: 'test.jpg' })).toBe(false);
    expect(shouldRenderExportImage(null as any, { image: 'test.jpg' })).toBe(false);
  });
});
