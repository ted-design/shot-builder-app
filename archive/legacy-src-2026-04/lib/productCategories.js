/**
 * Product Category Hierarchy
 *
 * Mirrors the Unbound Merino website structure:
 * - Gender (men, women, unisex)
 *   - Type (tops, bottoms, accessories)
 *     - Subcategory (tshirts, pants, hats, etc.)
 */

export const PRODUCT_CATEGORIES = {
  men: {
    label: "Men's",
    types: {
      tops: {
        label: "Tops",
        subcategories: [
          { value: "tshirts", label: "T-Shirts" },
          { value: "long-sleeves", label: "Long Sleeves" },
          { value: "hoodies-sweaters", label: "Hoodies & Sweaters" },
          { value: "knitwear", label: "Knitwear" },
          { value: "shirts", label: "Shirts" },
          { value: "polos", label: "Polos" },
          { value: "jackets", label: "Jackets" },
        ],
      },
      bottoms: {
        label: "Bottoms",
        subcategories: [
          { value: "pants", label: "Pants" },
          { value: "shorts", label: "Shorts" },
          { value: "underwear", label: "Underwear" },
          { value: "socks", label: "Socks" },
        ],
      },
    },
  },
  women: {
    label: "Women's",
    types: {
      tops: {
        label: "Tops",
        subcategories: [
          { value: "tshirts", label: "T-Shirts" },
          { value: "tank-tops", label: "Tank Tops" },
          { value: "long-sleeves", label: "Long Sleeves" },
          { value: "sweaters-sweatshirts", label: "Sweaters & Sweatshirts" },
          { value: "knitwear", label: "Knitwear" },
          { value: "dresses-rompers", label: "Dresses & Rompers" },
          { value: "jackets", label: "Jackets" },
        ],
      },
      bottoms: {
        label: "Bottoms",
        subcategories: [
          { value: "pants", label: "Pants" },
          { value: "shorts", label: "Shorts" },
          { value: "underwear-bras", label: "Underwear & Bras" },
          { value: "socks", label: "Socks" },
        ],
      },
    },
  },
  unisex: {
    label: "Unisex",
    types: {
      accessories: {
        label: "Accessories",
        subcategories: [
          { value: "hats", label: "Hats" },
          { value: "backpack", label: "Backpack" },
        ],
      },
    },
  },
};

/**
 * Normalize gender value to match category keys.
 * Handles variations like "mens", "womens", "women", etc.
 */
export function normalizeGender(gender) {
  if (!gender) return null;
  const g = gender.toLowerCase().trim();
  if (g === "men" || g === "mens") return "men";
  if (g === "women" || g === "womens") return "women";
  if (g === "unisex") return "unisex";
  return null; // "other" or unknown genders don't have categories
}

/**
 * Get available types for a given gender.
 * Returns array of { value, label } objects.
 */
export function getTypesForGender(gender) {
  const normalizedGender = normalizeGender(gender);
  if (!normalizedGender || !PRODUCT_CATEGORIES[normalizedGender]) {
    return [];
  }
  const types = PRODUCT_CATEGORIES[normalizedGender].types;
  return Object.entries(types).map(([value, data]) => ({
    value,
    label: data.label,
  }));
}

/**
 * Get available subcategories for a given gender and type.
 * Returns array of { value, label } objects.
 */
export function getSubcategoriesForType(gender, type) {
  const normalizedGender = normalizeGender(gender);
  if (!normalizedGender || !type) {
    return [];
  }
  const genderData = PRODUCT_CATEGORIES[normalizedGender];
  if (!genderData || !genderData.types[type]) {
    return [];
  }
  return genderData.types[type].subcategories;
}

/**
 * Get the display label for a category path.
 * Returns a formatted string like "Men's > Tops > T-Shirts" or partial paths.
 */
export function getCategoryLabel(gender, type, subcategory) {
  const normalizedGender = normalizeGender(gender);
  const parts = [];

  if (normalizedGender && PRODUCT_CATEGORIES[normalizedGender]) {
    parts.push(PRODUCT_CATEGORIES[normalizedGender].label);

    if (type && PRODUCT_CATEGORIES[normalizedGender].types[type]) {
      parts.push(PRODUCT_CATEGORIES[normalizedGender].types[type].label);

      if (subcategory) {
        const subcats = PRODUCT_CATEGORIES[normalizedGender].types[type].subcategories;
        const subcat = subcats.find((s) => s.value === subcategory);
        if (subcat) {
          parts.push(subcat.label);
        }
      }
    }
  }

  return parts.length > 0 ? parts.join(" > ") : null;
}

/**
 * Get just the subcategory label (without full path).
 */
export function getSubcategoryLabel(gender, type, subcategory) {
  const subcats = getSubcategoriesForType(gender, type);
  const match = subcats.find((s) => s.value === subcategory);
  return match?.label || null;
}

/**
 * Get just the type label (without full path).
 */
export function getTypeLabel(gender, type) {
  const types = getTypesForGender(gender);
  const match = types.find((t) => t.value === type);
  return match?.label || null;
}

/**
 * Validate that a category path (gender, type, subcategory) is valid.
 * Returns true if the combination exists in the hierarchy.
 */
export function isValidCategoryPath(gender, type, subcategory) {
  const normalizedGender = normalizeGender(gender);

  // No gender or unrecognized gender
  if (!normalizedGender) {
    return !type && !subcategory; // Valid if nothing else is set
  }

  const genderData = PRODUCT_CATEGORIES[normalizedGender];
  if (!genderData) {
    return false;
  }

  // Gender only (valid)
  if (!type && !subcategory) {
    return true;
  }

  // Type specified
  if (type) {
    if (!genderData.types[type]) {
      return false;
    }

    // Type only (valid)
    if (!subcategory) {
      return true;
    }

    // Subcategory specified - check it exists
    const subcats = genderData.types[type].subcategories;
    return subcats.some((s) => s.value === subcategory);
  }

  // Subcategory without type is invalid
  return false;
}

/**
 * Get all valid gender values that have categories defined.
 */
export function getGendersWithCategories() {
  return Object.entries(PRODUCT_CATEGORIES).map(([value, data]) => ({
    value,
    label: data.label,
  }));
}

/**
 * Check if a gender has categories defined.
 */
export function hasCategories(gender) {
  const normalizedGender = normalizeGender(gender);
  return normalizedGender !== null && PRODUCT_CATEGORIES[normalizedGender] !== undefined;
}

// ============================================================================
// Union Helper Functions (for gender-agnostic filtering)
// ============================================================================

/**
 * Get all unique types across all genders.
 * Returns array of { value, label } objects sorted alphabetically.
 * Used when gender is "All" to show combined type options.
 */
export function getAllTypes() {
  const typeMap = new Map();

  Object.values(PRODUCT_CATEGORIES).forEach((genderData) => {
    Object.entries(genderData.types).forEach(([value, data]) => {
      if (!typeMap.has(value)) {
        typeMap.set(value, { value, label: data.label });
      }
    });
  });

  // Sort alphabetically for consistent order
  return Array.from(typeMap.values()).sort((a, b) =>
    a.label.localeCompare(b.label)
  );
}

/**
 * Get union of subcategories for a given type across all genders.
 * Returns array of { value, label, genders: string[] } objects.
 * The `genders` array indicates which genders have this subcategory.
 * Used when gender is "All" and a type is selected.
 */
export function getSubcategoriesForTypeUnion(type) {
  if (!type) return [];

  const subcatMap = new Map();

  Object.entries(PRODUCT_CATEGORIES).forEach(([genderKey, genderData]) => {
    const typeData = genderData.types[type];
    if (typeData) {
      typeData.subcategories.forEach((sub) => {
        if (subcatMap.has(sub.value)) {
          // Add this gender to existing entry
          subcatMap.get(sub.value).genders.push(genderKey);
        } else {
          subcatMap.set(sub.value, {
            ...sub,
            genders: [genderKey],
          });
        }
      });
    }
  });

  // Sort alphabetically by label
  return Array.from(subcatMap.values()).sort((a, b) =>
    a.label.localeCompare(b.label)
  );
}

/**
 * Get genders that have a specific type.
 * Returns array of gender keys (e.g., ["men", "women"]).
 */
export function getGendersForType(type) {
  if (!type) return [];

  return Object.entries(PRODUCT_CATEGORIES)
    .filter(([, genderData]) => type in genderData.types)
    .map(([gender]) => gender);
}

/**
 * Get the label for a type when gender is "all".
 * Returns the type label from any gender that has it.
 */
export function getTypeLabelUnion(type) {
  if (!type) return null;

  for (const genderData of Object.values(PRODUCT_CATEGORIES)) {
    if (genderData.types[type]) {
      return genderData.types[type].label;
    }
  }
  return null;
}

/**
 * Get the label for a subcategory when gender is "all".
 * Returns the subcategory label from any gender/type that has it.
 */
export function getSubcategoryLabelUnion(type, subcategory) {
  if (!type || !subcategory) return null;

  const subcats = getSubcategoriesForTypeUnion(type);
  const match = subcats.find((s) => s.value === subcategory);
  return match?.label || null;
}
