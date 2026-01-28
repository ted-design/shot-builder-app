/**
 * Tests for LightweightExportPreview pagination estimator
 *
 * These tests ensure the pagination logic is deterministic - given the same
 * inputs, it should always produce the same page assignments.
 */

import { describe, it, expect } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// Constants (mirrored from LightweightExportPreview.jsx)
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_CAPACITY_UNITS = {
  portrait: 100,
  landscape: 75,
};

const CARD_HEIGHT_UNITS = {
  compact: { withImage: 18, withoutImage: 10 },
  standard: { withImage: 24, withoutImage: 12 },
  detailed: { withImage: 32, withoutImage: 16 },
};

const ROW_HEIGHT_UNITS = {
  compact: { withImage: 8, withoutImage: 4 },
  standard: { withImage: 10, withoutImage: 5 },
  detailed: { withImage: 14, withoutImage: 7 },
};

// ─────────────────────────────────────────────────────────────────────────────
// Pagination Estimator (extracted for testing)
// ─────────────────────────────────────────────────────────────────────────────

function estimatePagination(options, shots) {
  if (!shots || shots.length === 0) {
    return { pages: [], totalPages: 0, shotsPerPage: 0 };
  }

  const {
    layout = 'gallery',
    density = 'standard',
    orientation = 'portrait',
    includeImages = true,
    galleryColumns = 3,
  } = options;

  const pageCapacity = PAGE_CAPACITY_UNITS[orientation] || PAGE_CAPACITY_UNITS.portrait;
  const hasImages = includeImages || options.fields?.image;

  let itemHeight;
  let itemsPerRow;

  if (layout === 'table' || layout === 'shotblock') {
    const heights = ROW_HEIGHT_UNITS[density] || ROW_HEIGHT_UNITS.standard;
    itemHeight = hasImages ? heights.withImage : heights.withoutImage;
    itemsPerRow = 1;
  } else {
    const heights = CARD_HEIGHT_UNITS[density] || CARD_HEIGHT_UNITS.standard;
    itemHeight = hasImages ? heights.withImage : heights.withoutImage;
    itemsPerRow = Math.min(Number(galleryColumns) || 3, 4);
  }

  const rowHeight = itemHeight;
  const rowsPerPage = Math.max(1, Math.floor(pageCapacity / rowHeight));
  const itemsPerPage = rowsPerPage * itemsPerRow;

  const pages = [];
  for (let i = 0; i < shots.length; i += itemsPerPage) {
    pages.push(shots.slice(i, i + itemsPerPage));
  }

  return {
    pages,
    totalPages: pages.length,
    shotsPerPage: itemsPerPage,
    rowsPerPage,
    itemsPerRow,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Helpers
// ─────────────────────────────────────────────────────────────────────────────

function createMockShots(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `shot-${i + 1}`,
    name: `Shot ${i + 1}`,
    description: `Description for shot ${i + 1}`,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('estimatePagination', () => {
  describe('empty/null inputs', () => {
    it('returns empty pagination for null shots', () => {
      const result = estimatePagination({}, null);
      expect(result.totalPages).toBe(0);
      expect(result.pages).toEqual([]);
      expect(result.shotsPerPage).toBe(0);
    });

    it('returns empty pagination for empty shots array', () => {
      const result = estimatePagination({}, []);
      expect(result.totalPages).toBe(0);
      expect(result.pages).toEqual([]);
      expect(result.shotsPerPage).toBe(0);
    });
  });

  describe('gallery layout', () => {
    it('calculates correct pages for standard density with images', () => {
      const options = { layout: 'gallery', density: 'standard', includeImages: true, galleryColumns: 3 };
      const shots = createMockShots(12);
      const result = estimatePagination(options, shots);

      // Standard density, portrait, with images: 24 units/card, 100 units/page
      // rows per page = floor(100/24) = 4
      // items per page = 4 * 3 = 12
      expect(result.shotsPerPage).toBe(12);
      expect(result.totalPages).toBe(1);
      expect(result.pages[0].length).toBe(12);
    });

    it('calculates correct pages for compact density without images', () => {
      const options = { layout: 'gallery', density: 'compact', includeImages: false, galleryColumns: 3 };
      const shots = createMockShots(20);
      const result = estimatePagination(options, shots);

      // Compact density, no images: 10 units/card, 100 units/page
      // rows per page = floor(100/10) = 10
      // items per page = 10 * 3 = 30
      expect(result.shotsPerPage).toBe(30);
      expect(result.totalPages).toBe(1);
    });

    it('handles landscape orientation correctly', () => {
      const options = { layout: 'gallery', density: 'standard', orientation: 'landscape', includeImages: true, galleryColumns: 3 };
      const shots = createMockShots(12);
      const result = estimatePagination(options, shots);

      // Landscape has 75 units capacity instead of 100
      // rows per page = floor(75/24) = 3
      // items per page = 3 * 3 = 9
      expect(result.shotsPerPage).toBe(9);
      expect(result.totalPages).toBe(2);
    });

    it('limits columns to 4 maximum', () => {
      const options = { layout: 'gallery', density: 'standard', includeImages: true, galleryColumns: 6 };
      const shots = createMockShots(12);
      const result = estimatePagination(options, shots);

      expect(result.itemsPerRow).toBe(4);
    });
  });

  describe('table layout', () => {
    it('calculates correct pages for table layout with images', () => {
      const options = { layout: 'table', density: 'standard', includeImages: true };
      const shots = createMockShots(20);
      const result = estimatePagination(options, shots);

      // Table mode, standard density, with images: 10 units/row, 100 units/page
      // rows per page = floor(100/10) = 10
      expect(result.shotsPerPage).toBe(10);
      expect(result.totalPages).toBe(2);
      expect(result.itemsPerRow).toBe(1);
    });

    it('calculates correct pages for shotblock layout without images', () => {
      const options = { layout: 'shotblock', density: 'standard', includeImages: false };
      const shots = createMockShots(30);
      const result = estimatePagination(options, shots);

      // ShotBlock mode, standard density, no images: 5 units/row, 100 units/page
      // rows per page = floor(100/5) = 20
      expect(result.shotsPerPage).toBe(20);
      expect(result.totalPages).toBe(2);
    });
  });

  describe('determinism', () => {
    it('returns identical results for identical inputs', () => {
      const options = { layout: 'gallery', density: 'standard', includeImages: true, galleryColumns: 3 };
      const shots = createMockShots(15);

      const result1 = estimatePagination(options, shots);
      const result2 = estimatePagination(options, shots);
      const result3 = estimatePagination(options, shots);

      expect(result1.totalPages).toBe(result2.totalPages);
      expect(result2.totalPages).toBe(result3.totalPages);
      expect(result1.shotsPerPage).toBe(result2.shotsPerPage);
      expect(result2.shotsPerPage).toBe(result3.shotsPerPage);
    });

    it('produces consistent page assignments across multiple runs', () => {
      const options = { layout: 'gallery', density: 'detailed', includeImages: true, galleryColumns: 2 };
      const shots = createMockShots(10);

      // Run 10 times to ensure determinism
      const results = Array.from({ length: 10 }, () => estimatePagination(options, shots));

      const firstResult = results[0];
      results.forEach((result, i) => {
        expect(result.totalPages).toBe(firstResult.totalPages);
        expect(result.shotsPerPage).toBe(firstResult.shotsPerPage);
        expect(result.pages.length).toBe(firstResult.pages.length);
        result.pages.forEach((page, pageIndex) => {
          expect(page.length).toBe(firstResult.pages[pageIndex].length);
        });
      });
    });
  });

  describe('edge cases', () => {
    it('handles single shot correctly', () => {
      const options = { layout: 'gallery', density: 'standard', includeImages: true, galleryColumns: 3 };
      const shots = createMockShots(1);
      const result = estimatePagination(options, shots);

      expect(result.totalPages).toBe(1);
      expect(result.pages[0].length).toBe(1);
    });

    it('handles exact page boundary correctly', () => {
      const options = { layout: 'gallery', density: 'standard', includeImages: true, galleryColumns: 3 };
      // Standard: 4 rows * 3 cols = 12 per page
      const shots = createMockShots(12);
      const result = estimatePagination(options, shots);

      expect(result.totalPages).toBe(1);
      expect(result.pages[0].length).toBe(12);
    });

    it('handles one over page boundary correctly', () => {
      const options = { layout: 'gallery', density: 'standard', includeImages: true, galleryColumns: 3 };
      // Standard: 4 rows * 3 cols = 12 per page, so 13 should be 2 pages
      const shots = createMockShots(13);
      const result = estimatePagination(options, shots);

      expect(result.totalPages).toBe(2);
      expect(result.pages[0].length).toBe(12);
      expect(result.pages[1].length).toBe(1);
    });

    it('handles missing options gracefully', () => {
      const shots = createMockShots(10);
      const result = estimatePagination({}, shots);

      // Should use defaults: gallery, standard density, portrait, images on, 3 cols
      expect(result.totalPages).toBeGreaterThan(0);
      expect(result.shotsPerPage).toBeGreaterThan(0);
    });
  });

  describe('density variations', () => {
    const shots = createMockShots(50);

    it('compact density fits more items per page', () => {
      const compact = estimatePagination({ layout: 'gallery', density: 'compact', includeImages: true, galleryColumns: 3 }, shots);
      const standard = estimatePagination({ layout: 'gallery', density: 'standard', includeImages: true, galleryColumns: 3 }, shots);
      const detailed = estimatePagination({ layout: 'gallery', density: 'detailed', includeImages: true, galleryColumns: 3 }, shots);

      expect(compact.shotsPerPage).toBeGreaterThan(standard.shotsPerPage);
      expect(standard.shotsPerPage).toBeGreaterThan(detailed.shotsPerPage);
    });

    it('turning off images increases capacity', () => {
      const withImages = estimatePagination({ layout: 'gallery', density: 'standard', includeImages: true, galleryColumns: 3 }, shots);
      const withoutImages = estimatePagination({ layout: 'gallery', density: 'standard', includeImages: false, galleryColumns: 3 }, shots);

      expect(withoutImages.shotsPerPage).toBeGreaterThan(withImages.shotsPerPage);
    });
  });
});
