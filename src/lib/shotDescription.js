import { stripHtml } from "./stripHtml";

// ============================================================================
// COMMON COLOR TOKENS
// These are values commonly used for product colors. When a legacy `shot.type`
// value matches one of these AND also appears in the shot's products, we
// suppress it to avoid obvious duplication.
// ============================================================================
const COMMON_COLOR_TOKENS = new Set([
  // Basic colors
  'black', 'white', 'grey', 'gray', 'charcoal', 'navy', 'blue', 'red', 'green',
  'brown', 'tan', 'beige', 'cream', 'ivory', 'khaki', 'olive', 'burgundy',
  'maroon', 'pink', 'purple', 'orange', 'yellow', 'gold', 'silver',
  // Common apparel color names
  'heather', 'heather grey', 'heather gray', 'oatmeal', 'natural', 'indigo',
  'denim', 'chambray', 'stone', 'slate', 'carbon', 'graphite', 'ash',
  'forest', 'hunter', 'sage', 'mint', 'teal', 'aqua', 'coral', 'salmon',
  'rust', 'terracotta', 'camel', 'cognac', 'espresso', 'chocolate', 'mocha',
  'wine', 'plum', 'mauve', 'lavender', 'lilac', 'rose', 'blush', 'dusty rose',
  'sand', 'taupe', 'mushroom', 'pewter', 'gunmetal', 'midnight', 'cobalt',
  'royal', 'sky', 'powder', 'ice', 'ocean', 'marine', 'peacock',
]);

/**
 * Check if a string appears to be only a color token.
 * Returns true for values like "Black", "Navy Blue", etc.
 */
const isColorOnlyValue = (value) => {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;

  // Direct match
  if (COMMON_COLOR_TOKENS.has(normalized)) return true;

  // Check for compound color names (e.g., "Navy Blue", "Dark Grey")
  const words = normalized.split(/\s+/);
  if (words.length <= 3) {
    // Allow modifiers like "dark", "light", "deep", "pale"
    const modifiers = new Set(['dark', 'light', 'deep', 'pale', 'bright', 'muted', 'dusty', 'heathered']);
    const nonModifierWords = words.filter(w => !modifiers.has(w));
    // If all remaining words are color tokens, it's a color-only value
    if (nonModifierWords.length > 0 && nonModifierWords.every(w => COMMON_COLOR_TOKENS.has(w))) {
      return true;
    }
  }

  return false;
};

/**
 * Extract color tokens from product label strings.
 * Product labels follow the format: "Product Name – Colour (Size)"
 * This extracts the colour portion for comparison.
 */
const extractProductColors = (products) => {
  if (!Array.isArray(products)) return new Set();

  const colors = new Set();
  products.forEach(product => {
    if (typeof product !== 'string') return;

    // Pattern: "Product Name – Colour (Size)" or "Product Name – Colour"
    const dashMatch = product.match(/\s+[–-]\s+([^(]+)/);
    if (dashMatch) {
      const colorPart = dashMatch[1].trim().toLowerCase();
      if (colorPart) {
        colors.add(colorPart);
      }
    }
  });

  return colors;
};

// ============================================================================
// Description Source-of-Truth Resolution
// ============================================================================

/**
 * Deterministic description resolution for exports (PDF, CSV, Preview).
 *
 * PRECEDENCE RULES (explicit, deterministic):
 * 1. Use shot.description if present and non-empty after HTML stripping
 * 2. Else, use shot.type ONLY if it passes the "safe fallback" check
 * 3. Else, render nothing (empty string)
 *
 * SAFE FALLBACK CHECK:
 * Legacy shot.type is suppressed if:
 * - It's only whitespace or dash-like characters
 * - It's a color-only token (e.g., "Black", "Navy") AND that color appears
 *   in the shot's product list (to avoid obvious duplication)
 *
 * @param {Object} shot - Shot object with description, type, and products fields
 * @param {Object} options - Optional configuration
 * @param {string[]} options.products - Product label strings (already formatted)
 * @returns {{ text: string, source: 'canonical' | 'legacy' | 'none' }}
 */
export const resolveExportDescription = (shot, options = {}) => {
  const products = options.products || shot?.products || [];

  // Rule 1: Check canonical description field
  if (shot?.description && typeof shot.description === 'string') {
    const text = stripHtml(shot.description).trim();
    if (text) {
      return { text, source: 'canonical' };
    }
  }

  // Rule 2: Check legacy type field with safe fallback check
  if (shot?.type && typeof shot.type === 'string') {
    const rawType = stripHtml(shot.type).trim();

    // Skip if empty or dash-like
    if (!rawType || /^[-–—]+$/.test(rawType)) {
      return { text: '', source: 'none' };
    }

    // Check if it's a color-only value that duplicates product colors
    if (isColorOnlyValue(rawType)) {
      const productColors = extractProductColors(products);
      const normalizedType = rawType.toLowerCase();

      // Suppress if the color appears in any product
      if (productColors.has(normalizedType)) {
        return { text: '', source: 'none' };
      }

      // Also check partial matches (e.g., type="Charcoal" vs product color="Charcoal Heather")
      for (const productColor of productColors) {
        if (productColor.includes(normalizedType) || normalizedType.includes(productColor)) {
          return { text: '', source: 'none' };
        }
      }
    }

    // Legacy type passed safe fallback check
    return { text: rawType, source: 'legacy' };
  }

  // Rule 3: No description available
  return { text: '', source: 'none' };
};

/**
 * Convenience wrapper that returns just the text.
 * Use this in export renderers where you only need the display string.
 *
 * @param {Object} shot - Shot object
 * @param {Object} options - Optional configuration
 * @returns {string} Description text or empty string
 */
export const getExportDescriptionText = (shot, options = {}) => {
  return resolveExportDescription(shot, options).text;
};

export const isCorruptShotDescription = (description, notesPreview = "") => {
  if (typeof description !== "string") return false;
  const raw = description.trim();
  if (!raw) return false;

  const lower = raw.toLowerCase();
  // Treat HTML-ish fragments as corrupted legacy description data.
  // Use actual tag patterns to avoid false positives on text like "Size < XL"
  if (
    /<\s*\/?[a-z]/i.test(raw) ||  // Opening/closing tags like <p>, </div>
    /\b(ul|ol|li|p|div|span|br)>/i.test(raw)  // Malformed closing fragments like "ul>"
  ) {
    return true;
  }

  // Optional: if the description is effectively identical to the notes preview,
  // treat it as corrupted (likely legacy sync bleed).
  const notes = typeof notesPreview === "string" ? notesPreview.trim() : "";
  if (notes) {
    const normalizedDescription = stripHtml(raw).trim();
    if (normalizedDescription && normalizedDescription === notes) {
      return true;
    }
  }

  return false;
};

export const resolveShotShortDescriptionSource = (shot) => {
  if (!shot || typeof shot !== "object") return "";
  return typeof shot.description === "string" ? shot.description : "";
};

export const resolveShotShortDescriptionText = (shot) => {
  const raw = resolveShotShortDescriptionSource(shot);
  return stripHtml(raw).slice(0, 200);
};

export const resolveShotDraftShortDescriptionSource = (draft) => {
  if (!draft || typeof draft !== "object") return "";
  return typeof draft.description === "string" ? draft.description : "";
};

export const resolveShotDraftShortDescriptionText = (draft) => {
  const raw = resolveShotDraftShortDescriptionSource(draft);
  return stripHtml(raw).slice(0, 200);
};

export const resolveShotTypeText = (shot) => {
  if (!shot || typeof shot !== "object") return "";
  return stripHtml(typeof shot.type === "string" ? shot.type : "").slice(0, 200);
};

/**
 * Pattern A: Conservative overwrite guard for hero auto-fill.
 *
 * Determines whether shot.description should be auto-filled when changing hero.
 * Only returns true if:
 * 1. currentDescription is empty, OR
 * 2. currentDescription exactly matches prevDerived (previous hero's colorway)
 *
 * This preserves any user-typed description, even if it happens to match
 * another product's colorway in the look.
 *
 * @param {string} currentDescription - Current shot.description value
 * @param {string} prevDerived - Previous hero's colorway (auto-derived value)
 * @returns {boolean} Whether to auto-fill the description
 */
export const shouldAutoFillDescriptionOnHeroChange = (currentDescription, prevDerived) => {
  const current = (typeof currentDescription === "string" ? currentDescription : "").trim();
  const prev = (typeof prevDerived === "string" ? prevDerived : "").trim().toLowerCase();

  // Empty description → always auto-fill
  if (!current) return true;

  // Description matches previous auto-derived value → safe to update
  if (prev && current.toLowerCase() === prev) return true;

  // User has customized → preserve
  return false;
};
