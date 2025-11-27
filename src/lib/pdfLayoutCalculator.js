/**
 * PDF Layout Calculator
 *
 * Calculates optimal layout dimensions for PDF export based on density presets.
 * Handles proper spacing, margins, and page breaks for consistent, professional output.
 * Supports both portrait and landscape orientations.
 */

// Standard US Letter dimensions in points (1 point = 1/72 inch)
// These are portrait defaults - use getPageDimensions() for orientation-aware values
export const PAGE_DIMENSIONS = {
  width: 612, // 8.5 inches
  height: 792, // 11 inches
};

// Page margins in points
export const PAGE_MARGINS = {
  top: 36,    // 0.5 inch
  right: 36,
  bottom: 36,
  left: 36,
};

// Calculate usable page area (portrait default)
// Use getUsableArea(orientation) for orientation-aware values
export const USABLE_AREA = {
  width: PAGE_DIMENSIONS.width - PAGE_MARGINS.left - PAGE_MARGINS.right,  // 540pt
  height: PAGE_DIMENSIONS.height - PAGE_MARGINS.top - PAGE_MARGINS.bottom, // 720pt
};

/**
 * Get page dimensions based on orientation
 *
 * @param {string} orientation - 'portrait' or 'landscape'
 * @returns {Object} { width, height } in points
 */
export function getPageDimensions(orientation = 'portrait') {
  if (orientation === 'landscape') {
    return {
      width: 792,  // 11 inches (swapped)
      height: 612, // 8.5 inches (swapped)
    };
  }
  return {
    width: 612,  // 8.5 inches
    height: 792, // 11 inches
  };
}

/**
 * Get usable page area based on orientation (after margins)
 *
 * @param {string} orientation - 'portrait' or 'landscape'
 * @returns {Object} { width, height } in points
 */
export function getUsableArea(orientation = 'portrait') {
  const page = getPageDimensions(orientation);
  return {
    width: page.width - PAGE_MARGINS.left - PAGE_MARGINS.right,
    height: page.height - PAGE_MARGINS.top - PAGE_MARGINS.bottom,
  };
}

// Density presets define target cards per page and styling
export const DENSITY_PRESETS = {
  compact: {
    id: 'compact',
    label: 'Compact',
    description: '6-8 cards per page',
    targetCardsPerPage: 7,
    imageHeight: 100,
    cardPadding: 8,
    fontSize: {
      title: 10,
      label: 8,
      value: 9,
    },
    showAllFields: false, // Minimal details only
  },
  standard: {
    id: 'standard',
    label: 'Standard',
    description: '4-6 cards per page',
    targetCardsPerPage: 5,
    imageHeight: 140,
    cardPadding: 10,
    fontSize: {
      title: 12,
      label: 9,
      value: 10,
    },
    showAllFields: true,
  },
  detailed: {
    id: 'detailed',
    label: 'Detailed',
    description: '2-3 cards per page',
    targetCardsPerPage: 3,
    imageHeight: 180,
    cardPadding: 12,
    fontSize: {
      title: 14,
      label: 10,
      value: 11,
    },
    showAllFields: true,
  },
};

// Spacing between cards
export const CARD_GAP = {
  horizontal: 16, // Space between cards horizontally
  vertical: 20,   // Space between rows
};

// Grid layout decision matrix
// Maps target cards per page to optimal grid dimensions (columns x rows)
const GRID_LAYOUTS = {
  // Compact: 7+ cards → 4x2 grid (8 cards per page)
  compact: { threshold: 7, columns: 4, rows: 2 },
  // Standard: 5-6 cards → 3x2 grid (6 cards per page)
  standard: { threshold: 5, columns: 3, rows: 2 },
  // Detailed: 2-4 cards → 2x(calculated) grid
  detailed: { threshold: 0, columns: 2, rows: null }, // rows calculated dynamically
};

/**
 * Calculate optimal grid layout based on density preset and orientation
 *
 * @param {string} densityId - One of: 'compact', 'standard', 'detailed'
 * @param {number} totalCards - Total number of cards to layout
 * @param {string} orientation - 'portrait' or 'landscape'
 * @returns {Object} Layout configuration
 */
export function calculateLayout(densityId = 'standard', totalCards = 0, orientation = 'portrait') {
  const preset = DENSITY_PRESETS[densityId] || DENSITY_PRESETS.standard;

  // Get orientation-aware dimensions
  const usableArea = getUsableArea(orientation);
  const pageDimensions = getPageDimensions(orientation);

  // Determine grid dimensions based on target cards per page
  // Using a decision matrix for predictable, aesthetic layouts
  let columns;
  let rows;

  if (preset.targetCardsPerPage >= GRID_LAYOUTS.compact.threshold) {
    // Compact density: 4 columns for high card count
    columns = GRID_LAYOUTS.compact.columns;
    rows = GRID_LAYOUTS.compact.rows;
  } else if (preset.targetCardsPerPage >= GRID_LAYOUTS.standard.threshold) {
    // Standard density: 3 columns for balanced layout
    columns = GRID_LAYOUTS.standard.columns;
    rows = GRID_LAYOUTS.standard.rows;
  } else {
    // Detailed density: 2 columns with dynamic row count
    columns = GRID_LAYOUTS.detailed.columns;
    rows = Math.ceil(preset.targetCardsPerPage / columns);
  }

  // For landscape orientation with more horizontal space, consider adding a column
  if (orientation === 'landscape' && densityId !== 'detailed') {
    columns = Math.min(columns + 1, 5); // Cap at 5 columns max
  }

  const actualCardsPerPage = columns * rows;

  // Calculate card dimensions using orientation-aware usable area
  const totalHorizontalGap = CARD_GAP.horizontal * (columns - 1);
  const cardWidth = (usableArea.width - totalHorizontalGap) / columns;

  // Estimate card height based on content
  const cardHeight =
    preset.imageHeight +          // Image
    preset.cardPadding * 2 +      // Top/bottom padding
    preset.fontSize.title + 6 +   // Title + margin
    (preset.showAllFields ? 80 : 40); // Details section

  // Calculate how many cards fit per page using orientation-aware height
  const availableVerticalSpace = usableArea.height;
  const totalVerticalGap = CARD_GAP.vertical * (rows - 1);
  const maxRowsPerPage = Math.floor(
    (availableVerticalSpace + CARD_GAP.vertical) / (cardHeight + CARD_GAP.vertical)
  );
  const cardsPerPage = columns * maxRowsPerPage;

  // Calculate total pages needed
  const totalPages = Math.ceil(totalCards / cardsPerPage);

  return {
    preset,
    columns,
    rows: maxRowsPerPage,
    cardWidth,
    cardHeight,
    cardsPerPage,
    totalPages,
    gap: CARD_GAP,
    margins: PAGE_MARGINS,
    pageDimensions,
    usableArea,
    orientation,
  };
}

/**
 * Calculate card dimensions as percentages for CSS/PDF rendering
 *
 * @param {Object} layout - Layout configuration from calculateLayout
 * @returns {Object} Dimension strings for CSS/PDF
 */
export function getCardDimensions(layout) {
  // Use orientation-aware usable area from layout, fallback to constants for backwards compatibility
  const usableArea = layout.usableArea || USABLE_AREA;

  const widthPercent = ((layout.cardWidth / usableArea.width) * 100).toFixed(4);
  const gapHorizontalPercent = ((CARD_GAP.horizontal / usableArea.width) * 100).toFixed(4);
  const gapVerticalPercent = ((CARD_GAP.vertical / usableArea.height) * 100).toFixed(4);

  return {
    width: `${widthPercent}%`,
    widthPx: layout.cardWidth,
    height: layout.cardHeight,
    gapHorizontal: CARD_GAP.horizontal,
    gapVertical: CARD_GAP.vertical,
    gapHorizontalPercent: `${gapHorizontalPercent}%`,
    gapVerticalPercent: `${gapVerticalPercent}%`,
  };
}

/**
 * Distribute cards across pages with smart page breaks
 *
 * @param {Array} shots - Array of shot objects to layout
 * @param {Object} layout - Layout configuration from calculateLayout
 * @returns {Array} Array of pages, each containing an array of shots
 */
export function distributeCardsAcrossPages(shots, layout) {
  const pages = [];
  const { cardsPerPage } = layout;

  for (let i = 0; i < shots.length; i += cardsPerPage) {
    const pageShots = shots.slice(i, i + cardsPerPage);
    pages.push(pageShots);
  }

  return pages;
}

/**
 * Get card position within a page
 *
 * @param {number} cardIndex - Index of card on the page (0-based)
 * @param {Object} layout - Layout configuration from calculateLayout
 * @returns {Object} Position object with row, column, and style properties
 */
export function getCardPosition(cardIndex, layout) {
  const row = Math.floor(cardIndex / layout.columns);
  const column = cardIndex % layout.columns;
  const isLastInRow = column === layout.columns - 1;

  return {
    row,
    column,
    isLastInRow,
    marginRight: isLastInRow ? 0 : CARD_GAP.horizontal,
    marginBottom: CARD_GAP.vertical,
  };
}

/**
 * Calculate estimated file size based on number of images
 *
 * @param {number} imageCount - Number of images in the PDF
 * @returns {string} Estimated file size (e.g., "2.5 MB")
 */
export function estimateFileSize(imageCount) {
  // Rough estimate: ~150KB per image after compression
  const avgImageSize = 150 * 1024; // 150KB in bytes
  const overheadSize = 50 * 1024;  // 50KB for PDF structure
  const totalBytes = (imageCount * avgImageSize) + overheadSize;

  const megabytes = totalBytes / (1024 * 1024);

  if (megabytes < 1) {
    return `${Math.round(totalBytes / 1024)} KB`;
  }

  return `${megabytes.toFixed(1)} MB`;
}

/**
 * Get layout summary for display to user
 *
 * @param {Object} layout - Layout configuration from calculateLayout
 * @param {number} totalCards - Total number of cards
 * @returns {Object} Summary information
 */
export function getLayoutSummary(layout, totalCards) {
  return {
    density: layout.preset.label,
    description: layout.preset.description,
    grid: `${layout.columns} × ${layout.rows}`,
    cardsPerPage: layout.cardsPerPage,
    totalPages: layout.totalPages,
    totalCards,
    estimatedSize: estimateFileSize(totalCards),
    orientation: layout.orientation || 'portrait',
    pageDimensions: layout.pageDimensions,
  };
}
