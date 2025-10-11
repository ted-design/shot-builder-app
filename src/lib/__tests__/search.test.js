/**
 * Basic smoke tests for search.js utilities
 */

import { describe, test, expect } from 'vitest';
import {
  searchShots,
  searchProducts,
  searchTalent,
  searchLocations,
  searchProjects,
  globalSearch,
} from '../search';

describe('search utilities', () => {
  describe('searchShots', () => {
    test('returns all items when query is empty', () => {
      const shots = [
        { id: '1', name: 'Test Shot', type: 'product' },
        { id: '2', name: 'Another Shot', type: 'lifestyle' },
      ];
      const results = searchShots(shots, '');
      expect(results).toHaveLength(2);
      expect(results[0].item).toEqual(shots[0]);
    });

    test('returns fuzzy matches for partial strings', () => {
      const shots = [
        { id: '1', name: 'Hero Product Shot', type: 'product' },
        { id: '2', name: 'Lifestyle Shot', type: 'lifestyle' },
      ];
      const results = searchShots(shots, 'hero');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].item.name).toContain('Hero');
    });

    test('handles empty array', () => {
      const results = searchShots([], 'test');
      expect(results).toEqual([]);
    });

    test('returns items with score and type', () => {
      const shots = [{ id: '1', name: 'Test', type: 'product' }];
      const results = searchShots(shots, 'test');
      expect(results[0]).toHaveProperty('item');
      expect(results[0]).toHaveProperty('score');
      expect(results[0]).toHaveProperty('type', 'shot');
    });
  });

  describe('searchProducts', () => {
    test('returns all items when query is empty', () => {
      const products = [
        { id: '1', styleName: 'Blue Shirt', styleNumber: 'BS-001' },
        { id: '2', styleName: 'Red Pants', styleNumber: 'RP-002' },
      ];
      const results = searchProducts(products, '');
      expect(results).toHaveLength(2);
    });

    test('searches by style name', () => {
      const products = [
        { id: '1', styleName: 'Blue Shirt', styleNumber: 'BS-001' },
      ];
      const results = searchProducts(products, 'blue');
      expect(results.length).toBeGreaterThan(0);
    });

    test('searches by style number', () => {
      const products = [
        { id: '1', styleName: 'Blue Shirt', styleNumber: 'BS-001' },
      ];
      const results = searchProducts(products, 'BS-001');
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('searchTalent', () => {
    test('returns all items when query is empty', () => {
      const talent = [
        { id: '1', name: 'John Doe', agency: 'Top Models' },
        { id: '2', firstName: 'Jane', lastName: 'Smith' },
      ];
      const results = searchTalent(talent, '');
      expect(results).toHaveLength(2);
    });

    test('searches by name', () => {
      const talent = [{ id: '1', name: 'John Doe', agency: 'Top Models' }];
      const results = searchTalent(talent, 'john');
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('searchLocations', () => {
    test('returns all items when query is empty', () => {
      const locations = [
        { id: '1', name: 'Studio A', city: 'New York' },
        { id: '2', name: 'Studio B', city: 'Los Angeles' },
      ];
      const results = searchLocations(locations, '');
      expect(results).toHaveLength(2);
    });

    test('searches by location name', () => {
      const locations = [{ id: '1', name: 'Studio A', city: 'New York' }];
      const results = searchLocations(locations, 'studio');
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('searchProjects', () => {
    test('returns all items when query is empty', () => {
      const projects = [
        { id: '1', name: 'Spring Campaign', status: 'active' },
        { id: '2', name: 'Fall Lookbook', status: 'archived' },
      ];
      const results = searchProjects(projects, '');
      expect(results).toHaveLength(2);
    });

    test('searches by project name', () => {
      const projects = [{ id: '1', name: 'Spring Campaign', status: 'active' }];
      const results = searchProjects(projects, 'spring');
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('globalSearch', () => {
    test('searches across all entity types', () => {
      const entities = {
        shots: [{ id: '1', name: 'Test Shot' }],
        products: [{ id: '1', styleName: 'Test Product' }],
        talent: [{ id: '1', name: 'Test Talent' }],
        locations: [{ id: '1', name: 'Test Location' }],
        projects: [{ id: '1', name: 'Test Project' }],
      };
      const results = globalSearch(entities, 'test');

      expect(results).toHaveProperty('shots');
      expect(results).toHaveProperty('products');
      expect(results).toHaveProperty('talent');
      expect(results).toHaveProperty('locations');
      expect(results).toHaveProperty('projects');
    });

    test('respects maxResults limit', () => {
      const entities = {
        shots: Array.from({ length: 20 }, (_, i) => ({ id: String(i), name: 'Shot ' + i })),
        products: [],
        talent: [],
        locations: [],
        projects: [],
      };
      const results = globalSearch(entities, 'shot', { maxResults: 5 });
      // Use totalCount property to get accurate count (Object.values would include totalCount itself)
      expect(results.totalCount).toBeLessThanOrEqual(5);
    });

    test('respects maxPerType limit', () => {
      const entities = {
        shots: Array.from({ length: 20 }, (_, i) => ({ id: String(i), name: 'Shot ' + i })),
        products: Array.from({ length: 20 }, (_, i) => ({ id: String(i), styleName: 'Product ' + i })),
        talent: [],
        locations: [],
        projects: [],
      };
      const results = globalSearch(entities, 'shot', { maxPerType: 3 });
      expect(results.shots.length).toBeLessThanOrEqual(3);
    });

    test('handles empty entities', () => {
      const results = globalSearch({}, 'test');
      expect(results.shots).toEqual([]);
      expect(results.products).toEqual([]);
    });
  });

  describe('Fuse.js cache behavior', () => {
    test('caches search instances for same data length', () => {
      const shots = [
        { id: '1', name: 'Test Shot 1' },
        { id: '2', name: 'Test Shot 2' },
      ];

      // First search creates cache entry
      const results1 = searchShots(shots, 'test');
      expect(results1.length).toBeGreaterThan(0);

      // Second search with same data (same length) should use cache
      const results2 = searchShots(shots, 'shot');
      expect(results2.length).toBeGreaterThan(0);

      // Results should still work correctly
      expect(results1[0].type).toBe('shot');
      expect(results2[0].type).toBe('shot');
    });

    test('invalidates cache when data length changes', () => {
      // Start with 2 items
      let shots = [
        { id: '1', name: 'Test Shot 1' },
        { id: '2', name: 'Test Shot 2' },
      ];

      const results1 = searchShots(shots, 'test');
      expect(results1.length).toBe(2);

      // Add a third item (length changes from 2 to 3)
      shots = [
        { id: '1', name: 'Test Shot 1' },
        { id: '2', name: 'Test Shot 2' },
        { id: '3', name: 'Test Shot 3' },
      ];

      const results2 = searchShots(shots, 'test');
      expect(results2.length).toBe(3); // Should find all 3 items
    });

    test('handles LRU cache eviction with many entity types and sizes', () => {
      // Create more than MAX_CACHE_SIZE (10) different cache keys
      // Cache key format: entityType:dataLength

      // Fill cache with different sizes for shots (keys: shots:1, shots:2, ..., shots:6)
      for (let i = 1; i <= 6; i++) {
        const items = Array.from({ length: i }, (_, idx) => ({
          id: String(idx),
          name: `Shot ${idx}`,
        }));
        searchShots(items, 'shot');
      }

      // Fill cache with different sizes for products (keys: products:1, products:2, ..., products:6)
      for (let i = 1; i <= 6; i++) {
        const items = Array.from({ length: i }, (_, idx) => ({
          id: String(idx),
          styleName: `Product ${idx}`,
        }));
        searchProducts(items, 'product');
      }

      // At this point we've created 12 cache entries (6 shots + 6 products)
      // Cache max is 10, so oldest 2 should have been evicted

      // Verify cache still works by searching with newest entries
      const recentShots = Array.from({ length: 6 }, (_, idx) => ({
        id: String(idx),
        name: `Shot ${idx}`,
      }));
      const results = searchShots(recentShots, 'shot');

      // Should still return results correctly (cache may or may not be hit)
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].type).toBe('shot');
    });
  });
});
