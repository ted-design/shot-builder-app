// src/components/ui/VirtualizedList.jsx
//
// Reusable virtualized list component using react-window
// Supports both list and grid layouts with automatic performance optimization

import { memo, useState, useEffect } from "react";
import { List as ReactWindowList, Grid as ReactWindowGrid } from "react-window";

// Constants for configuration
const DEFAULT_HEADER_FOOTER_HEIGHT = 400; // Page header + filters + padding
const VIRTUALIZATION_THRESHOLD = 100; // Empirically determined performance benefit point

/**
 * Get number of grid columns based on viewport width
 * Matches Tailwind breakpoints: grid-cols-1 sm:grid-cols-2 xl:grid-cols-3
 */
function getResponsiveColumns() {
  if (typeof window === "undefined") return 3;
  const width = window.innerWidth;
  if (width < 640) return 1; // mobile
  if (width < 1280) return 2; // tablet
  return 3; // desktop
}

/**
 * VirtualizedList - Performance-optimized list rendering for large datasets
 *
 * @param {Object} props
 * @param {Array} props.items - Array of items to render
 * @param {Function} props.renderItem - Function to render each item: (item, index, isVirtualized) => ReactElement
 * @param {number} props.itemHeight - Height of each item in pixels
 * @param {number} [props.height] - Total height of the list container (defaults to window height - 400)
 * @param {number|string} [props.width] - Width of the list (defaults to '100%')
 * @param {number} [props.overscanCount=5] - Number of items to render outside visible area
 * @param {string} [props.className] - Additional CSS classes for the container
 * @param {number} [props.threshold=100] - Minimum items to enable virtualization
 */
const VirtualizedList = memo(function VirtualizedList({
  items = [],
  renderItem,
  itemHeight,
  height,
  width = "100%",
  overscanCount = 5,
  className = "",
  threshold = VIRTUALIZATION_THRESHOLD,
}) {
  // Calculate default height based on viewport
  const defaultHeight = typeof window !== "undefined" ? window.innerHeight - DEFAULT_HEADER_FOOTER_HEIGHT : 600;
  const listHeight = height || defaultHeight;

  // For small lists, don't virtualize (better UX with animations)
  const isVirtualized = items.length >= threshold;

  if (!isVirtualized) {
    return (
      <div className={className}>
        {items.map((item, index) => (
          <div key={item.id || index}>
            {renderItem(item, index, false)}
          </div>
        ))}
      </div>
    );
  }

  // Row component for react-window List
  const Row = ({ index, style }) => {
    const item = items[index];
    return (
      <div key={item.id || index} style={style}>
        {renderItem(item, index, true)}
      </div>
    );
  };

  return (
    <div className={className}>
      <ReactWindowList
        height={listHeight}
        itemCount={items.length}
        itemSize={itemHeight}
        width={width}
        overscanCount={overscanCount}
      >
        {Row}
      </ReactWindowList>
    </div>
  );
});

/**
 * VirtualizedGrid - Performance-optimized grid rendering for large datasets
 *
 * @param {Object} props
 * @param {Array} props.items - Array of items to render
 * @param {Function} props.renderItem - Function to render each item: (item, index, isVirtualized) => ReactElement
 * @param {number} props.itemHeight - Height of each grid item in pixels
 * @param {number} [props.gap=16] - Gap between items in pixels
 * @param {number} [props.height] - Total height of the grid container (defaults to window height - 400)
 * @param {number} [props.overscanCount=3] - Number of rows to render outside visible area
 * @param {string} [props.className] - Additional CSS classes for the container
 * @param {number} [props.threshold=100] - Minimum items to enable virtualization
 */
export const VirtualizedGrid = memo(function VirtualizedGrid({
  items = [],
  renderItem,
  itemHeight,
  gap = 16,
  height,
  overscanCount = 3,
  className = "",
  threshold = VIRTUALIZATION_THRESHOLD,
}) {
  // Calculate default height based on viewport
  const defaultHeight = typeof window !== "undefined" ? window.innerHeight - DEFAULT_HEADER_FOOTER_HEIGHT : 600;
  const gridHeight = height || defaultHeight;

  // Track responsive columns
  const [columns, setColumns] = useState(getResponsiveColumns());

  // Update columns on window resize
  useEffect(() => {
    const handleResize = () => {
      setColumns(getResponsiveColumns());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // For small lists, don't virtualize (better UX with animations)
  const isVirtualized = items.length >= threshold;

  if (!isVirtualized) {
    return (
      <div className={className}>
        {items.map((item, index) => (
          <div key={item.id || index}>
            {renderItem(item, index, false)}
          </div>
        ))}
      </div>
    );
  }

  // Calculate rows needed
  const rowCount = Math.ceil(items.length / columns);
  const rowHeight = itemHeight + gap;

  // Cell component for react-window Grid
  const Cell = ({ columnIndex, rowIndex, style }) => {
    const itemIndex = rowIndex * columns + columnIndex;
    if (itemIndex >= items.length) return null;

    const item = items[itemIndex];
    return (
      <div key={item.id || itemIndex} style={{ ...style, padding: `0 ${gap / 2}px` }}>
        {renderItem(item, itemIndex, true)}
      </div>
    );
  };

  return (
    <div className={className}>
      <ReactWindowGrid
        height={gridHeight}
        rowCount={rowCount}
        rowHeight={rowHeight}
        columnCount={columns}
        columnWidth={(containerWidth) => containerWidth / columns}
        width="100%"
        overscanCount={overscanCount}
      >
        {Cell}
      </ReactWindowGrid>
    </div>
  );
});

export default VirtualizedList;
