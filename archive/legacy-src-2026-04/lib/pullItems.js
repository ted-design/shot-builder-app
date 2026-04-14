// src/lib/pullItems.js
//
// Utility functions for managing pull items with the enhanced schema
// supporting multiple sizes, fulfillment tracking, and aggregation.

/**
 * Generate a unique ID for pull items
 */
export const generatePullItemId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

/**
 * Create a pull item from a shot product
 * @param {Object} product - Product from shot
 * @param {Object} family - Product family data (for gender/category)
 * @param {string[]} shotIds - Array of shot IDs this item came from
 * @returns {Object} PullItem
 */
export const createPullItemFromProduct = (product, family = null, shotIds = []) => {
  const familyId = product.familyId || product.productId || "";
  const familyName = product.familyName || product.productName || "Unknown Product";
  const colourId = product.colourId || product.colourwayId || null;
  const colourName = product.colourName || product.colour || null;
  const colourImagePath = product.colourImagePath || null;
  const styleNumber = product.styleNumber || family?.styleNumber || null;

  // Determine size - if "all sizes" or no size, we'll track as "All Sizes"
  const size = product.size || (product.sizeScope === "all" ? "All Sizes" : "One Size");

  return {
    id: generatePullItemId(),
    familyId,
    familyName,
    styleNumber,
    colourId,
    colourName,
    colourImagePath,
    sizes: [
      {
        size,
        quantity: 1,
        fulfilled: 0,
        status: "pending",
      },
    ],
    notes: "",
    gender: family?.gender || null,
    category: family?.category || null,
    genderOverride: null,
    categoryOverride: null,
    fulfillmentStatus: "pending",
    shotIds: shotIds.length ? shotIds : [],
  };
};

/**
 * Aggregate pull items - combine items with same familyId + colourId
 * and merge their sizes
 * @param {Array} items - Array of pull items
 * @returns {Array} Aggregated pull items
 */
export const aggregatePullItems = (items) => {
  if (!Array.isArray(items) || !items.length) return [];

  const aggregated = new Map();

  items.forEach((item) => {
    const key = `${item.familyId || "unknown"}-${item.colourId || "none"}`;

    if (aggregated.has(key)) {
      const existing = aggregated.get(key);

      // Merge sizes
      item.sizes.forEach((newSize) => {
        const existingSizeIndex = existing.sizes.findIndex((s) => s.size === newSize.size);

        if (existingSizeIndex >= 0) {
          // Size exists, add quantities
          existing.sizes[existingSizeIndex].quantity += newSize.quantity;
          existing.sizes[existingSizeIndex].fulfilled += newSize.fulfilled || 0;
        } else {
          // New size, add it
          existing.sizes.push({ ...newSize });
        }
      });

      // Merge shot IDs
      if (Array.isArray(item.shotIds)) {
        existing.shotIds = [...new Set([...existing.shotIds, ...item.shotIds])];
      }

      // Combine notes if different
      if (item.notes && item.notes !== existing.notes) {
        existing.notes = existing.notes
          ? `${existing.notes}; ${item.notes}`
          : item.notes;
      }
    } else {
      // New item
      aggregated.set(key, {
        ...item,
        sizes: item.sizes.map((s) => ({ ...s })),
        shotIds: Array.isArray(item.shotIds) ? [...item.shotIds] : [],
      });
    }
  });

  return Array.from(aggregated.values());
};

/**
 * Upsert a pull item into an existing items array, merging on familyId+colourId
 * and consolidating size quantities when a matching row exists.
 * - When editing an existing item, pass excludeId to remove the original row
 *   before upserting (to avoid self-matching).
 * @param {Array} items - Existing items array
 * @param {Object} incoming - Item to insert/merge
 * @param {Object} [options]
 * @param {string|null} [options.excludeId=null] - Item ID to remove before upsert (edit case)
 * @returns {Array} New items array with the incoming item upserted
 */
export const upsertPullItem = (items, incoming, { excludeId = null } = {}) => {
  const list = Array.isArray(items) ? items.slice() : [];
  const base = excludeId ? list.filter((it) => it.id !== excludeId) : list;

  const keyMatch = (a, b) => (a.familyId || "") === (b.familyId || "") && (a.colourId || null) === (b.colourId || null);

  const existingIndex = base.findIndex((it) => keyMatch(it, incoming));
  if (existingIndex === -1) {
    // Append new item as-is
    return [...base, { ...incoming, sizes: (incoming.sizes || []).map((s) => ({ ...s })) }];
  }

  // Merge into existing row
  const existing = base[existingIndex];
  const mergedSizes = Array.isArray(existing.sizes) ? existing.sizes.map((s) => ({ ...s })) : [];

  (incoming.sizes || []).forEach((newSize) => {
    const idx = mergedSizes.findIndex((s) => s.size === newSize.size);
    if (idx >= 0) {
      const current = mergedSizes[idx];
      mergedSizes[idx] = {
        ...current,
        quantity: (current.quantity || 0) + (newSize.quantity || 0),
        fulfilled: (current.fulfilled || 0) + (newSize.fulfilled || 0),
        status: newSize.status || current.status || "pending",
      };
    } else {
      mergedSizes.push({ ...newSize });
    }
  });

  // Merge notes and shotIds
  let mergedNotes = existing.notes || "";
  if (incoming.notes && incoming.notes !== existing.notes) {
    mergedNotes = mergedNotes ? `${mergedNotes}; ${incoming.notes}` : incoming.notes;
  }
  const mergedShotIds = Array.from(new Set([...(existing.shotIds || []), ...(incoming.shotIds || [])]));

  const merged = {
    ...existing,
    // Prefer explicit overrides from incoming if present
    genderOverride: incoming.genderOverride ?? existing.genderOverride ?? null,
    categoryOverride: incoming.categoryOverride ?? existing.categoryOverride ?? null,
    sizes: mergedSizes,
    notes: mergedNotes,
    shotIds: mergedShotIds,
  };

  const next = base.slice();
  next[existingIndex] = merged;
  return next;
};

/**
 * Calculate fulfillment status for a pull item based on its sizes
 * @param {Object} item - Pull item
 * @returns {string} "pending" | "fulfilled" | "partial" | "substituted"
 */
export const calculateItemFulfillment = (item) => {
  if (!item || !Array.isArray(item.sizes) || !item.sizes.length) return "pending";

  let totalRequested = 0;
  let totalFulfilled = 0;
  let hasSubstitution = false;

  item.sizes.forEach((size) => {
    totalRequested += size.quantity;
    totalFulfilled += size.fulfilled || 0;
    if (size.status === "substituted") hasSubstitution = true;
  });

  if (hasSubstitution) return "substituted";
  if (totalFulfilled === 0) return "pending";
  if (totalFulfilled >= totalRequested) return "fulfilled";
  return "partial";
};

/**
 * Validate a pull item has required fields
 * @param {Object} item - Pull item to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export const validatePullItem = (item) => {
  const errors = [];

  if (!item.familyId) errors.push("Product family is required");
  if (!item.familyName) errors.push("Product name is required");
  if (!Array.isArray(item.sizes) || !item.sizes.length) {
    errors.push("At least one size is required");
  } else {
    item.sizes.forEach((size, index) => {
      if (!size.size) errors.push(`Size #${index + 1}: Size value is required`);
      if (typeof size.quantity !== "number" || size.quantity < 1) {
        errors.push(`Size #${index + 1}: Quantity must be at least 1`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Sort pull items by gender then alphabetically by product name
 * @param {Array} items - Pull items
 * @returns {Array} Sorted pull items
 */
export const sortPullItemsByGender = (items) => {
  if (!Array.isArray(items)) return [];

  return [...items].sort((a, b) => {
    const genderA = (a.gender || "").toLowerCase();
    const genderB = (b.gender || "").toLowerCase();

    // Gender comparison
    if (genderA !== genderB) {
      // Order: mens, womens, kids, unisex, then others alphabetically
      const genderOrder = { mens: 1, womens: 2, kids: 3, unisex: 4 };
      const orderA = genderOrder[genderA] || 999;
      const orderB = genderOrder[genderB] || 999;

      if (orderA !== orderB) return orderA - orderB;
      return genderA.localeCompare(genderB);
    }

    // Within same gender, sort alphabetically by family name
    const nameA = (a.familyName || "").toLowerCase();
    const nameB = (b.familyName || "").toLowerCase();

    if (nameA !== nameB) return nameA.localeCompare(nameB);

    // Then by colour name
    const colourA = (a.colourName || "").toLowerCase();
    const colourB = (b.colourName || "").toLowerCase();

    return colourA.localeCompare(colourB);
  });
};

/**
 * Sort pull items by product name alphabetically
 * @param {Array} items - Pull items
 * @returns {Array} Sorted pull items
 */
export const sortPullItemsByProduct = (items) => {
  if (!Array.isArray(items)) return [];

  return [...items].sort((a, b) => {
    const nameA = (a.familyName || "").toLowerCase();
    const nameB = (b.familyName || "").toLowerCase();

    if (nameA !== nameB) return nameA.localeCompare(nameB);

    const colourA = (a.colourName || "").toLowerCase();
    const colourB = (b.colourName || "").toLowerCase();

    return colourA.localeCompare(colourB);
  });
};

/**
 * Calculate total quantity across all sizes for an item
 * @param {Object} item - Pull item
 * @returns {number} Total quantity
 */
export const getTotalQuantity = (item) => {
  if (!item || !Array.isArray(item.sizes)) return 0;
  return item.sizes.reduce((sum, size) => sum + (size.quantity || 0), 0);
};

/**
 * Calculate total fulfilled quantity across all sizes for an item
 * @param {Object} item - Pull item
 * @returns {number} Total fulfilled
 */
export const getTotalFulfilled = (item) => {
  if (!item || !Array.isArray(item.sizes)) return 0;
  return item.sizes.reduce((sum, size) => sum + (size.fulfilled || 0), 0);
};

/**
 * Normalize legacy pull item to new schema
 * Handles backward compatibility with old simple items
 * @param {Object} item - Legacy or new pull item
 * @returns {Object} Normalized pull item
 */
export const normalizePullItem = (item) => {
  if (!item) return null;

  // If already new schema (has familyId and sizes array), return as-is
  if (item.familyId && Array.isArray(item.sizes)) {
    return {
      ...item,
      fulfillmentStatus: item.fulfillmentStatus || calculateItemFulfillment(item),
    };
  }

  // Convert legacy schema to new
  return {
    id: item.id || generatePullItemId(),
    familyId: item.productId || item.familyId || "unknown",
    familyName: item.name || item.familyName || "Unknown Product",
    styleNumber: item.styleNumber || null,
    colourId: item.colourId || null,
    colourName: item.colourName || null,
    colourImagePath: item.colourImagePath || null,
    sizes: [
      {
        size: "One Size",
        quantity: item.quantity || 1,
        fulfilled: 0,
        status: "pending",
      },
    ],
    notes: item.notes || "",
    gender: item.gender || null,
    category: item.category || null,
    genderOverride: null,
    categoryOverride: null,
    fulfillmentStatus: "pending",
    shotIds: item.shotId ? [item.shotId] : [],
  };
};

/**
 * Get display name for a pull item
 * @param {Object} item - Pull item
 * @returns {string} Display name
 */
export const getPullItemDisplayName = (item) => {
  if (!item) return "Unknown Item";

  const name = item.familyName || "Unknown Product";
  const colour = item.colourName ? ` – ${item.colourName}` : "";

  return `${name}${colour}`;
};

/**
 * Group pull items by a field (gender, category, etc.)
 * @param {Array} items - Pull items
 * @param {string} groupBy - Field to group by
 * @returns {Array} Grouped items [{ key, label, items }]
 */
export const groupPullItems = (items, groupBy = "gender") => {
  if (!Array.isArray(items) || !items.length) return [];

  const groups = new Map();

  items.forEach((item) => {
    let key;
    let label;

    switch (groupBy) {
      case "gender":
        key = item.gender || "unspecified";
        label = key.charAt(0).toUpperCase() + key.slice(1);
        break;
      case "category":
        key = item.categoryOverride || item.category || "uncategorized";
        label = key.charAt(0).toUpperCase() + key.slice(1);
        break;
      default:
        key = "all";
        label = "All Items";
    }

    if (!groups.has(key)) {
      groups.set(key, { key, label, items: [] });
    }

    groups.get(key).items.push(item);
  });

  return Array.from(groups.values());
};
