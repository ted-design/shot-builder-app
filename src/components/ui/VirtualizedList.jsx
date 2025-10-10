// src/components/ui/VirtualizedList.jsx
//
// Reusable virtualized list component using react-window
// Supports both list and grid layouts with automatic performance optimization

import { memo } from "react";
import { List as ReactWindowList, Grid as ReactWindowGrid } from "react-window";

/**
 * VirtualizedList - Performance-optimized list rendering for large datasets
 *
 * @param {Object} props
 * @param {Array} props.items - Array of items to render
 * @param {Function} props.renderItem - Function to render each item: (item, index) => ReactElement
 * @param {number} props.itemHeight - Height of each item in pixels
 * @param {number} [props.height] - Total height of the list container (defaults to window height - 400)
 * @param {number} [props.width] - Width of the list (defaults to '100%')
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
  threshold = 100,
}) {
  // Calculate default height based on viewport
  const defaultHeight = typeof window !== "undefined" ? window.innerHeight - 400 : 600;
  const listHeight = height || defaultHeight;

  // For small lists, don't virtualize (better UX with animations)
  if (items.length < threshold) {
    return (
      <div className={className}>
        {items.map((item, index) => (
          <div key={item.id || index}>
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    );
  }

  // Row component for react-window List
  const Row = ({ index, style }) => {
    const item = items[index];
    return (
      <div style={style}>
        {renderItem(item, index)}
      </div>
    );
  };

  return (
    <div className={className}>
      <ReactWindowList
        height={listHeight}
        rowCount={items.length}
        rowHeight={itemHeight}
        rowComponent={Row}
        width={width}
        overscanCount={overscanCount}
      />
    </div>
  );
});

/**
 * VirtualizedGrid - Performance-optimized grid rendering for large datasets
 *
 * @param {Object} props
 * @param {Array} props.items - Array of items to render
 * @param {Function} props.renderItem - Function to render each item: (item, index) => ReactElement
 * @param {number} props.itemHeight - Height of each grid item in pixels
 * @param {number} [props.columns=3] - Number of columns in the grid
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
  columns = 3,
  gap = 16,
  height,
  overscanCount = 3,
  className = "",
  threshold = 100,
}) {
  // Calculate default height based on viewport
  const defaultHeight = typeof window !== "undefined" ? window.innerHeight - 400 : 600;
  const gridHeight = height || defaultHeight;

  // For small lists, don't virtualize (better UX with animations)
  if (items.length < threshold) {
    return (
      <div className={className}>
        {items.map((item, index) => (
          <div key={item.id || index}>
            {renderItem(item, index)}
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
      <div style={{ ...style, padding: `0 ${gap / 2}px` }}>
        {renderItem(item, itemIndex)}
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
        columnWidth={(width) => width / columns}
        cellComponent={Cell}
        width="100%"
        overscanCount={overscanCount}
      />
    </div>
  );
});

export default VirtualizedList;
