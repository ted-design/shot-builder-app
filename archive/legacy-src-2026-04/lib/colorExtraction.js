/**
 * Color extraction utilities for product SKU images
 * Uses fast-average-color library for dominant color detection
 */
import { FastAverageColor } from 'fast-average-color';
import { resolveImageSource } from './storage/adapters';

const fac = new FastAverageColor();

// LocalStorage cache for extracted colors
const COLOR_CACHE_KEY = 'sku_colors_cache';
const COLOR_CACHE_VERSION = 1;
const COLOR_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Get cached color for a SKU
 * @param {string} skuId - SKU identifier
 * @returns {string|null} Cached hex color or null
 */
export function getCachedSkuColor(skuId) {
  if (!skuId) return null;

  try {
    const cacheStr = localStorage.getItem(COLOR_CACHE_KEY);
    if (!cacheStr) return null;

    const cache = JSON.parse(cacheStr);
    if (cache.version !== COLOR_CACHE_VERSION) {
      // Clear outdated cache
      localStorage.removeItem(COLOR_CACHE_KEY);
      return null;
    }

    const entry = cache.colors?.[skuId];
    if (!entry) return null;

    // Check if entry has expired
    if (Date.now() - entry.timestamp > COLOR_CACHE_TTL_MS) {
      return null;
    }

    return entry.color;
  } catch (error) {
    console.warn('Failed to read color cache:', error);
    return null;
  }
}

/**
 * Cache a color for a SKU
 * @param {string} skuId - SKU identifier
 * @param {string} hexColor - Hex color to cache
 */
export function setCachedSkuColor(skuId, hexColor) {
  if (!skuId || !hexColor) return;

  try {
    const cacheStr = localStorage.getItem(COLOR_CACHE_KEY);
    let cache = { version: COLOR_CACHE_VERSION, colors: {} };

    if (cacheStr) {
      const existing = JSON.parse(cacheStr);
      if (existing.version === COLOR_CACHE_VERSION) {
        cache = existing;
      }
    }

    cache.colors[skuId] = {
      color: hexColor,
      timestamp: Date.now(),
    };

    // Limit cache size to prevent localStorage bloat
    const entries = Object.entries(cache.colors);
    if (entries.length > 500) {
      // Remove oldest entries
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toRemove = entries.slice(0, entries.length - 400);
      toRemove.forEach(([key]) => delete cache.colors[key]);
    }

    localStorage.setItem(COLOR_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.warn('Failed to write color cache:', error);
  }
}

/**
 * Extract dominant color from a File object (client-side upload)
 * @param {File} file - Image file object
 * @param {Object} options - FastAverageColor options
 * @returns {Promise<string|null>} Hex color string or null on error
 */
export async function extractColorFromFile(file, options = {}) {
  if (!file || !file.type.startsWith('image/')) {
    console.error('Invalid file type for color extraction');
    return null;
  }

  let objectUrl = null;

  try {
    // Create temporary object URL for the file
    objectUrl = URL.createObjectURL(file);

    // Create image element
    const img = new Image();
    img.crossOrigin = 'anonymous';

    // Load image and extract color
    const color = await new Promise((resolve, reject) => {
      img.onload = async () => {
        try {
          const result = fac.getColor(img, {
            algorithm: 'dominant',
            ignoredColor: [
              [255, 255, 255, 255, 50], // Ignore white (with threshold)
              [0, 0, 0, 0, 50],          // Ignore transparent
            ],
            ...options,
          });
          resolve(result.hex);
        } catch (err) {
          reject(err);
        }
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = objectUrl;
    });

    return normalizeHexColor(color);
  } catch (error) {
    console.error('Color extraction from file failed:', error);
    return null;
  } finally {
    // Clean up object URL
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

/**
 * Extract dominant color from a URL (Firebase Storage or external)
 * @param {string} imageUrl - Image URL
 * @param {Object} options - FastAverageColor options
 * @returns {Promise<string|null>} Hex color string or null on error
 */
export async function extractColorFromUrl(imageUrl, options = {}) {
  if (!imageUrl) {
    return null;
  }

  try {
    // Create image element
    const img = new Image();
    img.crossOrigin = 'anonymous';

    // Load image and extract color
    const color = await new Promise((resolve, reject) => {
      img.onload = async () => {
        try {
          const result = fac.getColor(img, {
            algorithm: 'dominant',
            ignoredColor: [
              [255, 255, 255, 255, 50], // Ignore white (with threshold)
              [0, 0, 0, 0, 50],          // Ignore transparent
            ],
            ...options,
          });
          resolve(result.hex);
        } catch (err) {
          reject(err);
        }
      };

      img.onerror = () => reject(new Error('Failed to load image from URL'));
      img.src = imageUrl;
    });

    return normalizeHexColor(color);
  } catch (error) {
    console.error('Color extraction from URL failed:', error);
    return null;
  }
}

/**
 * Normalize hex color to uppercase #RRGGBB format
 * @param {string} color - Color string in any format
 * @returns {string} Normalized hex color or #CCCCCC fallback
 */
export function normalizeHexColor(color) {
  if (!color) {
    return '#CCCCCC'; // Neutral gray fallback
  }

  // Remove any whitespace
  color = color.trim();

  // If already in hex format, normalize to uppercase
  if (color.startsWith('#')) {
    // Expand 3-digit hex to 6-digit
    if (color.length === 4) {
      const r = color[1];
      const g = color[2];
      const b = color[3];
      color = `#${r}${r}${g}${g}${b}${b}`;
    }

    // Validate and uppercase
    if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return color.toUpperCase();
    }
  }

  // If rgb/rgba format, convert to hex
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);

    const toHex = (n) => {
      const hex = n.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
  }

  console.warn('Could not normalize color:', color);
  return '#CCCCCC'; // Fallback to neutral gray
}

/**
 * Get SKU color with fallback logic
 * 1. Use sku.hexColor if exists
 * 2. Check localStorage cache
 * 3. Extract from sku.imagePath if exists (resolving to download URL)
 * 4. Fallback to neutral gray
 * @param {Object} sku - SKU object with id, hexColor and imagePath
 * @returns {Promise<string>} Hex color string
 */
export async function getSkuColor(sku) {
  // Use stored hex color if available
  if (sku.hexColor && /^#[0-9A-Fa-f]{6}$/.test(sku.hexColor)) {
    return sku.hexColor;
  }

  // Check localStorage cache
  if (sku.id) {
    const cached = getCachedSkuColor(sku.id);
    if (cached) {
      return cached;
    }
  }

  // Try to extract from image path
  if (sku.imagePath) {
    try {
      // Resolve storage path to download URL
      const { url } = await resolveImageSource(sku.imagePath, { preferredSize: 200 });
      const extracted = await extractColorFromUrl(url);
      if (extracted && extracted !== '#CCCCCC') {
        // Cache the extracted color
        if (sku.id) {
          setCachedSkuColor(sku.id, extracted);
        }
        return extracted;
      }
    } catch (error) {
      console.warn('Failed to resolve or extract color from image:', error);
    }
  }

  // Fallback to neutral gray
  return '#CCCCCC';
}

/**
 * Validate hex color format
 * @param {string} color - Color string to validate
 * @returns {boolean} True if valid hex color
 */
export function isValidHexColor(color) {
  if (!color || typeof color !== 'string') {
    return false;
  }
  return /^#[0-9A-Fa-f]{6}$/.test(color.trim());
}

/**
 * Determine if a color is light or dark (for contrast)
 * @param {string} hexColor - Hex color string
 * @returns {string} 'light' or 'dark'
 */
export function getColorBrightness(hexColor) {
  // Remove # if present
  const hex = hexColor.replace('#', '');

  // Convert to RGB
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  // Calculate relative luminance (WCAG formula)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5 ? 'light' : 'dark';
}
