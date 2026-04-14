// src/lib/__tests__/pdfLayoutCalculator.test.js
//
// Unit tests for PDF layout calculation utilities

import { describe, it, expect } from 'vitest';
import {
  PAGE_DIMENSIONS,
  PAGE_MARGINS,
  USABLE_AREA,
  DENSITY_PRESETS,
  CARD_GAP,
  calculateLayout,
  getCardDimensions,
  distributeCardsAcrossPages,
  getCardPosition,
  estimateFileSize,
  getLayoutSummary,
} from '../pdfLayoutCalculator';

describe('pdfLayoutCalculator', () => {
  describe('Constants', () => {
    it('should define correct page dimensions for US Letter', () => {
      expect(PAGE_DIMENSIONS.width).toBe(612); // 8.5 inches * 72 points/inch
      expect(PAGE_DIMENSIONS.height).toBe(792); // 11 inches * 72 points/inch
    });

    it('should define page margins', () => {
      expect(PAGE_MARGINS.top).toBe(36);
      expect(PAGE_MARGINS.right).toBe(36);
      expect(PAGE_MARGINS.bottom).toBe(36);
      expect(PAGE_MARGINS.left).toBe(36);
    });

    it('should calculate correct usable area', () => {
      const expectedWidth = 612 - 36 - 36; // 540
      const expectedHeight = 792 - 36 - 36; // 720
      expect(USABLE_AREA.width).toBe(expectedWidth);
      expect(USABLE_AREA.height).toBe(expectedHeight);
    });

    it('should define three density presets', () => {
      expect(Object.keys(DENSITY_PRESETS)).toEqual(['compact', 'standard', 'detailed']);
    });

    it('should have valid compact density preset', () => {
      const compact = DENSITY_PRESETS.compact;
      expect(compact.id).toBe('compact');
      expect(compact.label).toBe('Compact');
      expect(compact.targetCardsPerPage).toBe(7);
      expect(compact.imageHeight).toBe(100);
      expect(compact.showAllFields).toBe(false);
    });

    it('should have valid standard density preset', () => {
      const standard = DENSITY_PRESETS.standard;
      expect(standard.id).toBe('standard');
      expect(standard.label).toBe('Standard');
      expect(standard.targetCardsPerPage).toBe(5);
      expect(standard.imageHeight).toBe(140);
      expect(standard.showAllFields).toBe(true);
    });

    it('should have valid detailed density preset', () => {
      const detailed = DENSITY_PRESETS.detailed;
      expect(detailed.id).toBe('detailed');
      expect(detailed.label).toBe('Detailed');
      expect(detailed.targetCardsPerPage).toBe(3);
      expect(detailed.imageHeight).toBe(180);
      expect(detailed.showAllFields).toBe(true);
    });

    it('should define card gaps', () => {
      expect(CARD_GAP.horizontal).toBe(16);
      expect(CARD_GAP.vertical).toBe(20);
    });
  });

  describe('calculateLayout', () => {
    it('should calculate layout for compact density', () => {
      const layout = calculateLayout('compact', 100);

      expect(layout.preset.id).toBe('compact');
      expect(layout.columns).toBe(4); // Compact uses 4 columns
      expect(layout.rows).toBeGreaterThan(0);
      expect(layout.cardWidth).toBeGreaterThan(0);
      expect(layout.cardHeight).toBeGreaterThan(0);
      expect(layout.cardsPerPage).toBeGreaterThan(0);
      expect(layout.totalPages).toBeGreaterThan(0);
    });

    it('should calculate layout for standard density', () => {
      const layout = calculateLayout('standard', 100);

      expect(layout.preset.id).toBe('standard');
      expect(layout.columns).toBe(3); // Standard uses 3 columns
      expect(layout.rows).toBeGreaterThan(0);
      expect(layout.cardWidth).toBeGreaterThan(0);
      expect(layout.cardHeight).toBeGreaterThan(0);
      expect(layout.cardsPerPage).toBeGreaterThan(0);
      expect(layout.totalPages).toBeGreaterThan(0);
    });

    it('should calculate layout for detailed density', () => {
      const layout = calculateLayout('detailed', 100);

      expect(layout.preset.id).toBe('detailed');
      expect(layout.columns).toBe(2); // Detailed uses 2 columns
      expect(layout.rows).toBeGreaterThan(0);
      expect(layout.cardWidth).toBeGreaterThan(0);
      expect(layout.cardHeight).toBeGreaterThan(0);
      expect(layout.cardsPerPage).toBeGreaterThan(0);
      expect(layout.totalPages).toBeGreaterThan(0);
    });

    it('should default to standard density for invalid density ID', () => {
      const layout = calculateLayout('invalid', 50);
      expect(layout.preset.id).toBe('standard');
    });

    it('should calculate correct total pages', () => {
      const layout = calculateLayout('standard', 50);
      const expectedPages = Math.ceil(50 / layout.cardsPerPage);
      expect(layout.totalPages).toBe(expectedPages);
    });

    it('should handle zero cards', () => {
      const layout = calculateLayout('standard', 0);
      expect(layout.totalPages).toBe(0);
    });

    it('should include gap and margin data', () => {
      const layout = calculateLayout('standard', 10);
      expect(layout.gap).toEqual(CARD_GAP);
      expect(layout.margins).toEqual(PAGE_MARGINS);
      expect(layout.pageDimensions).toEqual(PAGE_DIMENSIONS);
    });
  });

  describe('getCardDimensions', () => {
    it('should return card dimensions as percentages', () => {
      const layout = calculateLayout('standard', 50);
      const dimensions = getCardDimensions(layout);

      expect(dimensions.width).toMatch(/%$/);
      expect(dimensions.widthPx).toBe(layout.cardWidth);
      expect(dimensions.height).toBe(layout.cardHeight);
      expect(dimensions.gapHorizontal).toBe(CARD_GAP.horizontal);
      expect(dimensions.gapVertical).toBe(CARD_GAP.vertical);
      expect(dimensions.gapHorizontalPercent).toMatch(/%$/);
      expect(dimensions.gapVerticalPercent).toMatch(/%$/);
    });

    it('should calculate correct width percentage', () => {
      const layout = calculateLayout('standard', 50);
      const dimensions = getCardDimensions(layout);
      const widthPercent = parseFloat(dimensions.width);

      // Width percentage should be reasonable (between 0 and 100)
      expect(widthPercent).toBeGreaterThan(0);
      expect(widthPercent).toBeLessThanOrEqual(100);
    });
  });

  describe('distributeCardsAcrossPages', () => {
    it('should distribute shots evenly across pages', () => {
      const shots = Array.from({ length: 20 }, (_, i) => ({ id: i, name: `Shot ${i}` }));
      const layout = calculateLayout('standard', 20);
      const pages = distributeCardsAcrossPages(shots, layout);

      // Should have the correct number of pages
      expect(pages.length).toBe(layout.totalPages);

      // Total shots should match
      const totalShots = pages.reduce((sum, page) => sum + page.length, 0);
      expect(totalShots).toBe(20);
    });

    it('should not exceed cardsPerPage on any page except the last', () => {
      const shots = Array.from({ length: 50 }, (_, i) => ({ id: i, name: `Shot ${i}` }));
      const layout = calculateLayout('standard', 50);
      const pages = distributeCardsAcrossPages(shots, layout);

      pages.forEach((page, index) => {
        if (index < pages.length - 1) {
          // All pages except last should have exactly cardsPerPage
          expect(page.length).toBe(layout.cardsPerPage);
        } else {
          // Last page can have fewer
          expect(page.length).toBeLessThanOrEqual(layout.cardsPerPage);
        }
      });
    });

    it('should handle empty shot array', () => {
      const layout = calculateLayout('standard', 0);
      const pages = distributeCardsAcrossPages([], layout);
      expect(pages).toEqual([]);
    });

    it('should handle single shot', () => {
      const shots = [{ id: 1, name: 'Shot 1' }];
      const layout = calculateLayout('standard', 1);
      const pages = distributeCardsAcrossPages(shots, layout);

      expect(pages.length).toBe(1);
      expect(pages[0]).toEqual(shots);
    });
  });

  describe('getCardPosition', () => {
    it('should calculate position for first card', () => {
      const layout = calculateLayout('standard', 10);
      const position = getCardPosition(0, layout);

      expect(position.row).toBe(0);
      expect(position.column).toBe(0);
      expect(position.isLastInRow).toBe(false);
      expect(position.marginRight).toBe(CARD_GAP.horizontal);
      expect(position.marginBottom).toBe(CARD_GAP.vertical);
    });

    it('should calculate position for last card in row', () => {
      const layout = calculateLayout('standard', 10); // 3 columns
      const position = getCardPosition(2, layout); // Third card (index 2)

      expect(position.row).toBe(0);
      expect(position.column).toBe(2);
      expect(position.isLastInRow).toBe(true);
      expect(position.marginRight).toBe(0); // No margin on last in row
      expect(position.marginBottom).toBe(CARD_GAP.vertical);
    });

    it('should calculate position for second row', () => {
      const layout = calculateLayout('standard', 10); // 3 columns
      const position = getCardPosition(3, layout); // First card of second row

      expect(position.row).toBe(1);
      expect(position.column).toBe(0);
      expect(position.isLastInRow).toBe(false);
    });

    it('should handle compact density with 4 columns', () => {
      const layout = calculateLayout('compact', 10);
      const position = getCardPosition(3, layout); // Fourth card (last in first row)

      expect(position.column).toBe(3);
      expect(position.isLastInRow).toBe(true);
      expect(position.marginRight).toBe(0);
    });
  });

  describe('estimateFileSize', () => {
    it('should estimate file size for zero images', () => {
      const size = estimateFileSize(0);
      expect(size).toBe('50 KB'); // Just overhead
    });

    it('should estimate file size for small number of images', () => {
      const size = estimateFileSize(5);
      // ~750KB for 5 images + overhead (should be less than 1 MB)
      expect(size).toContain('KB');
    });

    it('should estimate file size for larger number of images', () => {
      const size = estimateFileSize(10);
      // ~1.5MB for 10 images
      expect(size).toContain('MB');
      const megabytes = parseFloat(size);
      expect(megabytes).toBeGreaterThan(1);
      expect(megabytes).toBeLessThan(2);
    });

    it('should scale linearly with image count', () => {
      const size10 = estimateFileSize(10);
      const size20 = estimateFileSize(20);

      const mb10 = parseFloat(size10);
      const mb20 = parseFloat(size20);

      // Size should roughly double
      expect(mb20).toBeGreaterThan(mb10 * 1.8);
      expect(mb20).toBeLessThan(mb10 * 2.2);
    });
  });

  describe('getLayoutSummary', () => {
    it('should generate complete summary', () => {
      const layout = calculateLayout('standard', 50);
      const summary = getLayoutSummary(layout, 50);

      expect(summary.density).toBe('Standard');
      expect(summary.description).toBe('4-6 cards per page');
      expect(summary.grid).toMatch(/\d+ × \d+/);
      expect(summary.cardsPerPage).toBe(layout.cardsPerPage);
      expect(summary.totalPages).toBe(layout.totalPages);
      expect(summary.totalCards).toBe(50);
      expect(summary.estimatedSize).toBeTruthy();
    });

    it('should handle compact density', () => {
      const layout = calculateLayout('compact', 100);
      const summary = getLayoutSummary(layout, 100);

      expect(summary.density).toBe('Compact');
      expect(summary.description).toBe('6-8 cards per page');
    });

    it('should handle detailed density', () => {
      const layout = calculateLayout('detailed', 20);
      const summary = getLayoutSummary(layout, 20);

      expect(summary.density).toBe('Detailed');
      expect(summary.description).toBe('2-3 cards per page');
    });

    it('should format grid dimensions', () => {
      const layout = calculateLayout('standard', 50);
      const summary = getLayoutSummary(layout, 50);

      // Should be in format "columns × rows"
      expect(summary.grid).toMatch(/^\d+ × \d+$/);

      const [columns, rows] = summary.grid.split(' × ').map(Number);
      expect(columns).toBe(layout.columns);
      expect(rows).toBe(layout.rows);
    });
  });

  describe('Integration Tests', () => {
    it('should produce consistent results across full workflow', () => {
      const totalCards = 42;

      // Calculate layout
      const layout = calculateLayout('standard', totalCards);

      // Get dimensions
      const dimensions = getCardDimensions(layout);

      // Distribute cards
      const mockShots = Array.from({ length: totalCards }, (_, i) => ({ id: i }));
      const pages = distributeCardsAcrossPages(mockShots, layout);

      // Get summary
      const summary = getLayoutSummary(layout, totalCards);

      // Verify consistency
      expect(pages.length).toBe(layout.totalPages);
      expect(summary.totalPages).toBe(layout.totalPages);
      expect(summary.totalCards).toBe(totalCards);

      // Verify all cards are distributed
      const distributedCards = pages.reduce((sum, page) => sum + page.length, 0);
      expect(distributedCards).toBe(totalCards);

      // Verify dimensions are reasonable
      expect(dimensions.widthPx).toBeGreaterThan(0);
      expect(dimensions.height).toBeGreaterThan(0);
    });

    it('should handle edge case of exactly one page of cards', () => {
      const layout = calculateLayout('standard', 20);
      const cardsForOnePage = layout.cardsPerPage;

      const mockShots = Array.from({ length: cardsForOnePage }, (_, i) => ({ id: i }));
      const pages = distributeCardsAcrossPages(mockShots, layout);

      expect(pages.length).toBe(1);
      expect(pages[0].length).toBe(cardsForOnePage);
    });

    it('should handle edge case of one card over full page', () => {
      const layout = calculateLayout('standard', 20);
      const cardsForOnePage = layout.cardsPerPage;
      const totalCards = cardsForOnePage + 1;

      const mockShots = Array.from({ length: totalCards }, (_, i) => ({ id: i }));
      const pages = distributeCardsAcrossPages(mockShots, layout);

      expect(pages.length).toBe(2);
      expect(pages[0].length).toBe(cardsForOnePage);
      expect(pages[1].length).toBe(1);
    });
  });
});
