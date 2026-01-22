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
 * Compute assets metrics for overview card (placeholder - returns mock data)
 * @param {Array} assets - Array of asset objects
 * @returns {Object} { total, subMetrics }
 */
export function computeAssetMetrics(assets = []) {
  // Mock data for now
  const total = assets.length;

  if (total === 0) {
    return {
      total: 0,
      subMetrics: [],
    };
  }

  return {
    total,
    subMetrics: [
      { value: Math.floor(total * 0.6), label: "images", variant: "default" },
      { value: Math.ceil(total * 0.4), label: "docs", variant: "default" },
    ],
  };
}

/**
 * Compute activity metrics for overview card (placeholder - returns mock data)
 * @param {Array} activities - Array of activity objects
 * @returns {Object} { total, subMetrics }
 */
export function computeActivityMetrics(activities = []) {
  const total = activities.length;

  if (total === 0) {
    return {
      total: 0,
      subMetrics: [],
    };
  }

  // Mock: count recent activity (last 7 days would be "recent")
  const recent = Math.min(total, Math.floor(total * 0.3) || 1);

  return {
    total,
    subMetrics: [{ value: recent, label: "this week", variant: "info" }],
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
