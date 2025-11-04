// src/lib/pullExport.js
//
// Utility functions for exporting pulls to CSV and PDF formats

import { normalizePullItem, getPullItemDisplayName, sortPullItemsByGender } from "./pullItems";

/**
 * Convert pull items to CSV format
 * @param {Object} pull - Pull document
 * @param {Object} options - Export options
 * @returns {string} CSV content
 */
export const exportPullToCSV = (pull, options = {}) => {
  const {
    includeNotes = true,
    flattenSizes = true, // one row per size vs. aggregate
  } = options;

  const items = (pull.items || []).map((item) => normalizePullItem(item));
  const sortedItems = sortPullItemsByGender(items);

  // CSV Headers
  const headers = [
    "Product",
    "Style Number",
    "Colour",
    "Gender",
    flattenSizes ? "Size" : "Sizes",
    flattenSizes ? "Quantity" : "Total Quantity",
    "Fulfilled",
    "Status",
  ];

  if (includeNotes) {
    headers.push("Notes");
  }

  const rows = [headers];

  sortedItems.forEach((item) => {
    const baseData = {
      product: item.familyName || "",
      styleNumber: item.styleNumber || "",
      colour: item.colourName || "",
      gender: item.gender || "",
    };

    if (flattenSizes && item.sizes && item.sizes.length > 0) {
      // Create a row for each size
      item.sizes.forEach((size) => {
        const row = [
          baseData.product,
          baseData.styleNumber,
          baseData.colour,
          baseData.gender,
          size.size,
          size.quantity,
          size.fulfilled || 0,
          size.status || "pending",
        ];

        if (includeNotes) {
          row.push(item.notes || "");
        }

        rows.push(row);
      });
    } else {
      // Aggregate row
      const totalQty = item.sizes
        ? item.sizes.reduce((sum, s) => sum + s.quantity, 0)
        : 0;
      const totalFulfilled = item.sizes
        ? item.sizes.reduce((sum, s) => sum + (s.fulfilled || 0), 0)
        : 0;
      const sizesText = item.sizes
        ? item.sizes.map((s) => `${s.size} (${s.quantity})`).join("; ")
        : "";

      const row = [
        baseData.product,
        baseData.styleNumber,
        baseData.colour,
        baseData.gender,
        sizesText,
        totalQty,
        totalFulfilled,
        item.fulfillmentStatus || "pending",
      ];

      if (includeNotes) {
        row.push(item.notes || "");
      }

      rows.push(row);
    }
  });

  return rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
};

/**
 * Generate a CSV blob for download
 * @param {string} csvContent - CSV content string
 * @returns {Blob} CSV blob
 */
export const generateCSVBlob = (csvContent) => {
  return new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
};

/**
 * Trigger CSV download in browser
 * @param {Object} pull - Pull document
 * @param {Object} options - Export options
 */
export const downloadPullAsCSV = (pull, options = {}) => {
  const csvContent = exportPullToCSV(pull, options);
  const blob = generateCSVBlob(csvContent);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${pull.title || "pull"}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Format pull data for enhanced PDF export
 * @param {Object} pull - Pull document
 * @param {Object} settings - PDF settings
 * @returns {Object} Formatted data for PDF template
 */
export const formatPullForPDF = (pull, settings = {}) => {
  const {
    orientation = "portrait",
    headerText = "",
    subheaderText = "",
    includeImages = true,
    pageBreakStrategy = "auto",
    columns = null,
    repeatHeaderEachPage = true,
    columnFlex = null,
    groupHeaderEachSection = true,
  } = settings;

  const items = (pull.items || []).map((item) => normalizePullItem(item));
  const sortedItems = sortPullItemsByGender(items);

  // Group items according to page break strategy
  let groupedItems;
  switch (pageBreakStrategy) {
    case "by-gender":
      groupedItems = groupByGender(sortedItems);
      break;
    case "by-category":
      groupedItems = groupByCategory(sortedItems);
      break;
    default:
      groupedItems = [{ title: null, items: sortedItems }];
  }

  return {
    ...pull,
    items: sortedItems,
    groupedItems,
    settings: {
      orientation,
      headerText,
      subheaderText,
      includeImages,
      pageBreakStrategy,
      columns,
      repeatHeaderEachPage,
      columnFlex,
      groupHeaderEachSection,
    },
  };
};

/**
 * Group items by gender for PDF page breaks
 */
const groupByGender = (items) => {
  const groups = new Map();

  items.forEach((item) => {
    const gender = item.gender || "Unspecified";
    const key = gender.toLowerCase();

    if (!groups.has(key)) {
      groups.set(key, {
        title: gender.charAt(0).toUpperCase() + gender.slice(1),
        items: [],
      });
    }

    groups.get(key).items.push(item);
  });

  return Array.from(groups.values());
};

/**
 * Group items by category for PDF page breaks
 */
const groupByCategory = (items) => {
  const groups = new Map();

  items.forEach((item) => {
    const category = item.categoryOverride || item.category || "Uncategorized";
    const key = category.toLowerCase();

    if (!groups.has(key)) {
      groups.set(key, {
        title: category.charAt(0).toUpperCase() + category.slice(1),
        items: [],
      });
    }

    groups.get(key).items.push(item);
  });

  return Array.from(groups.values());
};
