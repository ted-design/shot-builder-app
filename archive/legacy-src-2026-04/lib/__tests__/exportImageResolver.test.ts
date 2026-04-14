import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  normalizeImageSource,
  isValidBrowserImageUrl,
  resolveExportImageUrl,
  resolveExportImageUrls,
  clearExportImageCache,
} from '../exportImageResolver';

// Mock the storage adapters
vi.mock('../storage/adapters', () => ({
  resolveImageSource: vi.fn(),
}));

import { resolveImageSource } from '../storage/adapters';

describe('exportImageResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearExportImageCache();
  });

  afterEach(() => {
    clearExportImageCache();
  });

  describe('normalizeImageSource', () => {
    it('returns null for falsy values', () => {
      expect(normalizeImageSource(null)).toBe(null);
      expect(normalizeImageSource(undefined)).toBe(null);
      expect(normalizeImageSource('')).toBe(null);
      expect(normalizeImageSource('   ')).toBe(null);
    });

    it('returns null for placeholder markers', () => {
      expect(normalizeImageSource('__PREVIEW_PLACEHOLDER__')).toBe(null);
      expect(normalizeImageSource('__ANYTHING__')).toBe(null);
    });

    it('returns trimmed string for valid strings', () => {
      expect(normalizeImageSource('  images/test.jpg  ')).toBe('images/test.jpg');
      expect(normalizeImageSource('https://example.com/img.png')).toBe('https://example.com/img.png');
    });

    it('extracts path from object with path property', () => {
      expect(normalizeImageSource({ path: 'images/test.jpg' })).toBe('images/test.jpg');
      expect(normalizeImageSource({ path: '  images/test.jpg  ' })).toBe('images/test.jpg');
    });

    it('extracts fullPath from object', () => {
      expect(normalizeImageSource({ fullPath: 'images/full/test.jpg' })).toBe('images/full/test.jpg');
    });

    it('extracts url from object', () => {
      expect(normalizeImageSource({ url: 'https://example.com/img.png' })).toBe('https://example.com/img.png');
    });

    it('extracts src from object', () => {
      expect(normalizeImageSource({ src: 'https://cdn.example.com/img.png' })).toBe('https://cdn.example.com/img.png');
    });

    it('prefers path over url and src', () => {
      expect(normalizeImageSource({
        path: 'images/test.jpg',
        url: 'https://example.com/other.png',
        src: 'https://cdn.example.com/another.png',
      })).toBe('images/test.jpg');
    });

    it('returns null for objects with no valid properties', () => {
      expect(normalizeImageSource({})).toBe(null);
      expect(normalizeImageSource({ invalid: 'test' })).toBe(null);
      expect(normalizeImageSource({ path: '', url: '' })).toBe(null);
    });
  });

  describe('isValidBrowserImageUrl', () => {
    it('returns true for http URLs', () => {
      expect(isValidBrowserImageUrl('http://example.com/img.png')).toBe(true);
    });

    it('returns true for https URLs', () => {
      expect(isValidBrowserImageUrl('https://example.com/img.png')).toBe(true);
    });

    it('returns true for data URLs', () => {
      expect(isValidBrowserImageUrl('data:image/png;base64,abc123')).toBe(true);
    });

    it('returns true for blob URLs', () => {
      expect(isValidBrowserImageUrl('blob:http://localhost/uuid-here')).toBe(true);
    });

    it('returns false for storage paths', () => {
      expect(isValidBrowserImageUrl('images/test.jpg')).toBe(false);
      expect(isValidBrowserImageUrl('/images/test.jpg')).toBe(false);
    });

    it('returns false for gs:// URLs', () => {
      expect(isValidBrowserImageUrl('gs://bucket/path/image.jpg')).toBe(false);
    });

    it('returns false for falsy values', () => {
      expect(isValidBrowserImageUrl('')).toBe(false);
      expect(isValidBrowserImageUrl(null as unknown as string)).toBe(false);
      expect(isValidBrowserImageUrl(undefined as unknown as string)).toBe(false);
    });
  });

  describe('resolveExportImageUrl', () => {
    it('returns null for null/empty source', async () => {
      expect(await resolveExportImageUrl(null)).toBe(null);
      expect(await resolveExportImageUrl('')).toBe(null);
      expect(await resolveExportImageUrl('__PREVIEW_PLACEHOLDER__')).toBe(null);
    });

    it('returns URL directly if already valid browser URL', async () => {
      const url = 'https://example.com/image.jpg';
      const result = await resolveExportImageUrl(url);
      expect(result).toBe(url);
      // Should not call adapter
      expect(resolveImageSource).not.toHaveBeenCalled();
    });

    it('returns data URL directly if already data URL', async () => {
      const dataUrl = 'data:image/png;base64,abc123';
      const result = await resolveExportImageUrl(dataUrl);
      expect(result).toBe(dataUrl);
      expect(resolveImageSource).not.toHaveBeenCalled();
    });

    it('resolves Firebase Storage path via adapter', async () => {
      const mockResolvedUrl = 'https://firebasestorage.googleapis.com/v0/b/bucket/o/image.jpg';
      vi.mocked(resolveImageSource).mockResolvedValueOnce({
        url: mockResolvedUrl,
        adapter: 'firebase',
      });

      const result = await resolveExportImageUrl('images/shots/test.jpg');
      expect(result).toBe(mockResolvedUrl);
      expect(resolveImageSource).toHaveBeenCalledWith('images/shots/test.jpg', expect.any(Object));
    });

    it('returns null for gs:// URLs', async () => {
      const result = await resolveExportImageUrl('gs://bucket/path/image.jpg');
      expect(result).toBe(null);
      // Should not call adapter for gs:// URLs
      expect(resolveImageSource).not.toHaveBeenCalled();
    });

    it('returns null if adapter fails', async () => {
      vi.mocked(resolveImageSource).mockRejectedValueOnce(new Error('Network error'));

      const result = await resolveExportImageUrl('images/failing.jpg');
      expect(result).toBe(null);
    });

    it('returns null if adapter returns invalid URL', async () => {
      vi.mocked(resolveImageSource).mockResolvedValueOnce({
        url: '', // empty URL
        adapter: 'firebase',
      });

      const result = await resolveExportImageUrl('images/test.jpg');
      expect(result).toBe(null);
    });

    it('caches resolved URLs', async () => {
      const mockResolvedUrl = 'https://firebasestorage.googleapis.com/v0/b/bucket/o/image.jpg';
      vi.mocked(resolveImageSource).mockResolvedValue({
        url: mockResolvedUrl,
        adapter: 'firebase',
      });

      // First call
      const result1 = await resolveExportImageUrl('images/cached.jpg');
      expect(result1).toBe(mockResolvedUrl);
      expect(resolveImageSource).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await resolveExportImageUrl('images/cached.jpg');
      expect(result2).toBe(mockResolvedUrl);
      // Should not call adapter again
      expect(resolveImageSource).toHaveBeenCalledTimes(1);
    });

    it('handles object source with path property', async () => {
      const mockResolvedUrl = 'https://firebasestorage.googleapis.com/v0/b/bucket/o/image.jpg';
      vi.mocked(resolveImageSource).mockResolvedValueOnce({
        url: mockResolvedUrl,
        adapter: 'firebase',
      });

      const result = await resolveExportImageUrl({ path: 'images/object-source.jpg' });
      expect(result).toBe(mockResolvedUrl);
    });
  });

  describe('resolveExportImageUrls', () => {
    it('resolves multiple sources in parallel', async () => {
      const mockResolve = vi.mocked(resolveImageSource);
      mockResolve.mockImplementation((source) => {
        if (typeof source === 'string' && source.includes('img1')) {
          return Promise.resolve({ url: 'https://example.com/img1.jpg', adapter: 'firebase' });
        }
        if (typeof source === 'string' && source.includes('img2')) {
          return Promise.resolve({ url: 'https://example.com/img2.jpg', adapter: 'firebase' });
        }
        return Promise.reject(new Error('Unknown'));
      });

      const sources = [
        { id: 'shot1', source: 'images/img1.jpg' },
        { id: 'shot2', source: 'images/img2.jpg' },
        { id: 'shot3', source: 'https://direct.com/img3.jpg' }, // Already valid URL
      ];

      const results = await resolveExportImageUrls(sources);

      expect(results.get('shot1')).toBe('https://example.com/img1.jpg');
      expect(results.get('shot2')).toBe('https://example.com/img2.jpg');
      expect(results.get('shot3')).toBe('https://direct.com/img3.jpg');
    });

    it('handles failures gracefully', async () => {
      vi.mocked(resolveImageSource).mockRejectedValue(new Error('Failed'));

      const sources = [
        { id: 'shot1', source: 'images/failing.jpg' },
        { id: 'shot2', source: 'https://direct.com/working.jpg' }, // Already valid URL
      ];

      const results = await resolveExportImageUrls(sources);

      // Failing one should not be in results
      expect(results.has('shot1')).toBe(false);
      // Direct URL should work
      expect(results.get('shot2')).toBe('https://direct.com/working.jpg');
    });

    it('returns empty map for empty sources', async () => {
      const results = await resolveExportImageUrls([]);
      expect(results.size).toBe(0);
    });
  });
});
