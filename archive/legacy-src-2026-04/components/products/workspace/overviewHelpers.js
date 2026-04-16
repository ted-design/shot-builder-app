/**
 * Overview Helpers - Pure functions for computing metrics for the bento dashboard
 *
 * These helpers aggregate data from samples, colorways, assets, and activity
 * to provide at-a-glance metrics for the Overview section.
 */

/**
 * Compute sample metrics for overview card
 * @param {Array} samples - Array of sample objects
 * @returns {Object} { total, subMetrics }
 */
export function computeSampleMetrics(samples = []) {
  const total = samples.length;

  if (total === 0) {
    return {
      total: 0,
      subMetrics: [],
    };
  }

  // Count by status
  const statusCounts = samples.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {});

  const subMetrics = [];

  // Prioritize actionable statuses
  if (statusCounts.in_transit) {
    subMetrics.push({ value: statusCounts.in_transit, label: "in transit", variant: "info" });
  }
  if (statusCounts.issue) {
    subMetrics.push({ value: statusCounts.issue, label: "issues", variant: "danger" });
  }
  if (statusCounts.requested) {
    subMetrics.push({ value: statusCounts.requested, label: "requested", variant: "warning" });
  }
  if (statusCounts.arrived) {
    subMetrics.push({ value: statusCounts.arrived, label: "arrived", variant: "success" });
  }

  return { total, subMetrics };
}

/**
 * Compute colorway metrics for overview card
 * @param {Array} skus - Array of SKU/colorway objects
 * @returns {Object} { total, subMetrics }
 */
export function computeColorwayMetrics(skus = []) {
  const total = skus.length;

  if (total === 0) {
    return {
      total: 0,
      subMetrics: [],
    };
  }

  // Count unique colors (some might share the same color name)
  const uniqueColors = new Set(skus.map((s) => s.colorName || s.color || "Unknown")).size;

  // Count how many have images
  const withImages = skus.filter((s) => s.imagePath || s.thumbnailImagePath).length;

  const subMetrics = [];

  if (uniqueColors > 0 && uniqueColors !== total) {
    subMetrics.push({ value: uniqueColors, label: "unique", variant: "default" });
  }
  if (withImages > 0) {
    subMetrics.push({ value: withImages, label: "with photos", variant: "success" });
  }

  return { total, subMetrics };
}

/**
 * Compute assets metrics for overview card
 * Counts existing product images from family and SKU data
 *
 * @param {Object} family - Product family object with headerImagePath, thumbnailImagePath
 * @param {Array} skus - Array of SKU objects with imagePath
 * @returns {Object} { total, subMetrics }
 */
export function computeAssetMetrics(family, skus = []) {
  let imageCount = 0;

  // Count family-level images
  if (family?.headerImagePath) imageCount += 1;
  if (family?.thumbnailImagePath && family.thumbnailImagePath !== family.headerImagePath) {
    imageCount += 1;
  }

  // Count SKU colorway images
  imageCount += skus.filter((sku) => sku.imagePath).length;

  if (imageCount === 0) {
    return {
      total: 0,
      subMetrics: [],
    };
  }

  return {
    total: imageCount,
    subMetrics: [{ value: imageCount, label: "images", variant: "default" }],
  };
}

// Threshold in milliseconds to distinguish meaningful updates from creation (60 seconds)
const ACTIVITY_UPDATE_THRESHOLD_MS = 60000;

/**
 * Compute activity metrics for overview card
 * Counts activity events from audit fields (createdAt, updatedAt)
 *
 * @param {Object} family - Product family object with createdAt, updatedAt timestamps
 * @returns {Object} { total, subMetrics }
 */
export function computeActivityMetrics(family) {
  let count = 0;

  // Count creation event
  if (family?.createdAt) {
    count += 1;
  }

  // Count update event if meaningfully different from creation (> 60 seconds)
  if (family?.updatedAt && family?.createdAt) {
    const createdTime = family.createdAt?.toDate?.() || family.createdAt;
    const updatedTime = family.updatedAt?.toDate?.() || family.updatedAt;
    const timeDiff = Math.abs(
      new Date(updatedTime).getTime() - new Date(createdTime).getTime()
    );
    if (timeDiff > ACTIVITY_UPDATE_THRESHOLD_MS) {
      count += 1;
    }
  }

  if (count === 0) {
    return {
      total: 0,
      subMetrics: [],
    };
  }

  return {
    total: count,
    subMetrics: count > 1 ? [{ value: 1, label: "recent", variant: "info" }] : [],
  };
}

/**
 * Get section description for bento card
 */
export const SECTION_DESCRIPTIONS = {
  colorways:
    "Manage color variants, images, and SKU-specific details for this product.",
  samples:
    "Track sample requests, shipments, arrivals, and issues across colorways.",
  assets:
    "Upload and organize tech packs, reference images, and product documents.",
  activity:
    "View timeline of changes, comments, and team activity on this product.",
};
