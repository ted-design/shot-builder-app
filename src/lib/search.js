/**
 * Search utilities using fuse.js for fuzzy matching
 * Provides entity-specific search and global search across all entities
 */

import Fuse from 'fuse.js';

/**
 * Default fuse.js options optimized for Shot Builder
 */
const DEFAULT_FUSE_OPTIONS = {
  includeScore: true,
  includeMatches: true,
  threshold: 0.4, // 0 = perfect match, 1 = match anything
  minMatchCharLength: 2,
  ignoreLocation: true, // Search entire string, not just beginning
};

/**
 * Cache for Fuse.js instances to avoid rebuilding indexes on every search
 * Cache key format: {entityType}:{dataLength}
 * Simple cache invalidation based on data length change
 */
const fuseCache = new Map();

/**
 * Maximum cache size to prevent memory bloat
 * Keeps the 10 most recently used Fuse instances
 */
const MAX_CACHE_SIZE = 10;

/**
 * Cache performance metrics for monitoring
 * Tracks hits, misses, and calculates hit rate
 */
const cacheStats = {
  hits: 0,
  misses: 0,
  reset() {
    this.hits = 0;
    this.misses = 0;
  },
};

/**
 * Search configuration for shots
 */
const SHOTS_SEARCH_CONFIG = {
  keys: [
    { name: 'name', weight: 3 },
    { name: 'type', weight: 2 },
    { name: 'notes', weight: 1 },
    { name: 'locationName', weight: 1.5 },
    { name: 'talentNames', weight: 1.5 },
    { name: 'productNames', weight: 1 },
    { name: 'tagLabels', weight: 2 },
  ],
  ...DEFAULT_FUSE_OPTIONS,
};

/**
 * Search configuration for products
 */
const PRODUCTS_SEARCH_CONFIG = {
  keys: [
    { name: 'styleName', weight: 3 },
    { name: 'styleNumber', weight: 2.5 },
    { name: 'previousStyleNumber', weight: 1.5 },
    { name: 'skuCodes', weight: 2 },
    { name: 'colorNames', weight: 1.5 },
    { name: 'sizeOptions', weight: 1 },
    { name: 'gender', weight: 1 },
    { name: 'productType', weight: 1.5 },
    { name: 'productSubcategory', weight: 1.5 },
  ],
  ...DEFAULT_FUSE_OPTIONS,
};

/**
 * Search configuration for talent
 */
const TALENT_SEARCH_CONFIG = {
  keys: [
    { name: 'name', weight: 3 },
    { name: 'firstName', weight: 2.5 },
    { name: 'lastName', weight: 2.5 },
    { name: 'agency', weight: 2 },
    { name: 'email', weight: 1.5 },
    { name: 'phone', weight: 1.5 },
    { name: 'sizing', weight: 1 },
    { name: 'gender', weight: 1 },
  ],
  ...DEFAULT_FUSE_OPTIONS,
};

/**
 * Search configuration for locations
 */
const LOCATIONS_SEARCH_CONFIG = {
  keys: [
    { name: 'name', weight: 3 },
    { name: 'description', weight: 2 },
    { name: 'address', weight: 1.5 },
  ],
  ...DEFAULT_FUSE_OPTIONS,
};

/**
 * Search configuration for projects
 */
const PROJECTS_SEARCH_CONFIG = {
  keys: [
    { name: 'name', weight: 3 },
    { name: 'description', weight: 1.5 },
    { name: 'status', weight: 1 },
  ],
  ...DEFAULT_FUSE_OPTIONS,
};

/**
 * Create a fuse.js search index for the given items and configuration
 * @param {Array} items - Items to index
 * @param {Object} config - Fuse.js configuration
 * @returns {Fuse} Configured fuse.js instance
 */
export function createSearchIndex(items, config) {
  return new Fuse(items, config);
}

/**
 * Get a cached Fuse.js instance or create a new one
 * Caches instances by entity type and data length for simple invalidation
 * @param {Array} items - Items to index
 * @param {Object} config - Fuse.js configuration
 * @param {string} entityType - Entity type for cache key (e.g., 'shots', 'products')
 * @returns {Fuse} Cached or new Fuse.js instance
 */
function getCachedSearchIndex(items, config, entityType) {
  // Generate cache key based on entity type and data length
  // Using data length as a simple heuristic for cache invalidation
  const cacheKey = `${entityType}:${items.length}`;

  // Check if we have a cached instance
  if (fuseCache.has(cacheKey)) {
    // Cache hit - track metric
    cacheStats.hits++;

    // Move to end (LRU behavior)
    const cached = fuseCache.get(cacheKey);
    fuseCache.delete(cacheKey);
    fuseCache.set(cacheKey, cached);
    return cached;
  }

  // Cache miss - track metric
  cacheStats.misses++;

  // Create new Fuse instance
  const fuse = new Fuse(items, config);

  // Add to cache
  fuseCache.set(cacheKey, fuse);

  // Enforce max cache size (LRU eviction)
  if (fuseCache.size > MAX_CACHE_SIZE) {
    // Delete oldest entry (first in Map)
    const firstKey = fuseCache.keys().next().value;
    fuseCache.delete(firstKey);
  }

  return fuse;
}

/**
 * Search shots with fuzzy matching
 * Uses cached Fuse.js instance for better performance
 * @param {Array} shots - Shot items to search
 * @param {string} query - Search query
 * @param {Object} options - Additional options
 * @returns {Array} Matching shots with score and matches
 */
export function searchShots(shots, query, options = {}) {
  if (!query || !query.trim()) return shots.map(item => ({ item, score: 0 }));

  const fuse = getCachedSearchIndex(shots, { ...SHOTS_SEARCH_CONFIG, ...options }, 'shots');
  const results = fuse.search(query);

  return results.map(({ item, score, matches }) => ({
    item,
    score,
    matches,
    type: 'shot',
  }));
}

/**
 * Search products with fuzzy matching
 * Uses cached Fuse.js instance for better performance
 * @param {Array} products - Product items to search
 * @param {string} query - Search query
 * @param {Object} options - Additional options
 * @returns {Array} Matching products with score and matches
 */
export function searchProducts(products, query, options = {}) {
  if (!query || !query.trim()) return products.map(item => ({ item, score: 0 }));

  const fuse = getCachedSearchIndex(products, { ...PRODUCTS_SEARCH_CONFIG, ...options }, 'products');
  const results = fuse.search(query);

  return results.map(({ item, score, matches }) => ({
    item,
    score,
    matches,
    type: 'product',
  }));
}

/**
 * Search talent with fuzzy matching
 * Uses cached Fuse.js instance for better performance
 * @param {Array} talent - Talent items to search
 * @param {string} query - Search query
 * @param {Object} options - Additional options
 * @returns {Array} Matching talent with score and matches
 */
export function searchTalent(talent, query, options = {}) {
  if (!query || !query.trim()) return talent.map(item => ({ item, score: 0 }));

  const fuse = getCachedSearchIndex(talent, { ...TALENT_SEARCH_CONFIG, ...options }, 'talent');
  const results = fuse.search(query);

  return results.map(({ item, score, matches }) => ({
    item,
    score,
    matches,
    type: 'talent',
  }));
}

/**
 * Search locations with fuzzy matching
 * Uses cached Fuse.js instance for better performance
 * @param {Array} locations - Location items to search
 * @param {string} query - Search query
 * @param {Object} options - Additional options
 * @returns {Array} Matching locations with score and matches
 */
export function searchLocations(locations, query, options = {}) {
  if (!query || !query.trim()) return locations.map(item => ({ item, score: 0 }));

  const fuse = getCachedSearchIndex(locations, { ...LOCATIONS_SEARCH_CONFIG, ...options }, 'locations');
  const results = fuse.search(query);

  return results.map(({ item, score, matches }) => ({
    item,
    score,
    matches,
    type: 'location',
  }));
}

/**
 * Search projects with fuzzy matching
 * Uses cached Fuse.js instance for better performance
 * @param {Array} projects - Project items to search
 * @param {string} query - Search query
 * @param {Object} options - Additional options
 * @returns {Array} Matching projects with score and matches
 */
export function searchProjects(projects, query, options = {}) {
  if (!query || !query.trim()) return projects.map(item => ({ item, score: 0 }));

  const fuse = getCachedSearchIndex(projects, { ...PROJECTS_SEARCH_CONFIG, ...options }, 'projects');
  const results = fuse.search(query);

  return results.map(({ item, score, matches }) => ({
    item,
    score,
    matches,
    type: 'project',
  }));
}

/**
 * Global search across all entity types
 * @param {Object} entities - Object containing arrays of all entity types
 * @param {string} query - Search query
 * @param {Object} options - Additional options
 * @returns {Object} Results grouped by entity type
 */
export function globalSearch(entities = {}, query, options = {}) {
  const {
    shots = [],
    products = [],
    talent = [],
    locations = [],
    projects = []
  } = entities;

  const maxResults = options.maxResults || 50;
  const maxPerType = options.maxPerType || 10;

  if (!query || !query.trim()) {
    return {
      shots: [],
      products: [],
      talent: [],
      locations: [],
      projects: [],
      totalCount: 0,
    };
  }

  const shotResults = searchShots(shots, query).slice(0, maxPerType);
  const productResults = searchProducts(products, query).slice(0, maxPerType);
  const talentResults = searchTalent(talent, query).slice(0, maxPerType);
  const locationResults = searchLocations(locations, query).slice(0, maxPerType);
  const projectResults = searchProjects(projects, query).slice(0, maxPerType);

  // Combine and sort all results by score
  const allResults = [
    ...shotResults,
    ...productResults,
    ...talentResults,
    ...locationResults,
    ...projectResults,
  ].sort((a, b) => (a.score || 0) - (b.score || 0)); // Lower score = better match

  const limitedResults = allResults.slice(0, maxResults);

  // Group back by type
  const grouped = {
    shots: limitedResults.filter(r => r.type === 'shot'),
    products: limitedResults.filter(r => r.type === 'product'),
    talent: limitedResults.filter(r => r.type === 'talent'),
    locations: limitedResults.filter(r => r.type === 'location'),
    projects: limitedResults.filter(r => r.type === 'project'),
    totalCount: limitedResults.length,
  };

  return grouped;
}

/**
 * Highlight matching text in a string
 * @param {string} text - Original text
 * @param {Array} matches - Match indices from fuse.js
 * @returns {Array} Array of text segments with highlight info
 */
export function highlightMatches(text, matches = []) {
  if (!text || !matches || matches.length === 0) {
    return [{ text, highlighted: false }];
  }

  const segments = [];
  let lastIndex = 0;

  // Sort matches by index
  const sortedMatches = [...matches].sort((a, b) => a[0] - b[0]);

  sortedMatches.forEach(([start, end]) => {
    // Add non-highlighted text before match
    if (start > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, start),
        highlighted: false,
      });
    }

    // Add highlighted match
    segments.push({
      text: text.slice(start, end + 1),
      highlighted: true,
    });

    lastIndex = end + 1;
  });

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      highlighted: false,
    });
  }

  return segments;
}

/**
 * Get primary match field from fuse.js matches
 * Useful for displaying the most relevant field that matched
 * @param {Array} matches - Matches from fuse.js
 * @returns {string|null} Primary matched field name
 */
export function getPrimaryMatchField(matches = []) {
  if (!matches || matches.length === 0) return null;

  // Return the first match's key (highest weighted match)
  return matches[0]?.key || null;
}

/**
 * Format search result for display
 * @param {Object} result - Search result with item, score, matches
 * @returns {Object} Formatted result for display
 */
export function formatSearchResult(result) {
  const { item, score, matches, type } = result;

  const primaryField = getPrimaryMatchField(matches);

  return {
    id: item.id,
    type,
    item,
    score,
    primaryField,
    matches,
  };
}

/**
 * Get cache performance statistics
 * Useful for monitoring cache effectiveness and validating performance claims
 * @returns {Object} Cache stats including hits, misses, hit rate, and cache size
 */
export function getCacheStats() {
  const total = cacheStats.hits + cacheStats.misses;
  const hitRate = total > 0 ? cacheStats.hits / total : 0;

  return {
    hits: cacheStats.hits,
    misses: cacheStats.misses,
    hitRate: hitRate,
    hitRatePercent: `${(hitRate * 100).toFixed(1)}%`,
    cacheSize: fuseCache.size,
    maxCacheSize: MAX_CACHE_SIZE,
  };
}

/**
 * Reset cache performance statistics
 * Useful for testing or starting fresh monitoring
 */
export function resetCacheStats() {
  cacheStats.reset();
}
