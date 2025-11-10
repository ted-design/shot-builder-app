/**
 * useBulkSelection - Shared hook for managing bulk selection state
 *
 * Provides consistent selection management across all list pages
 * Supports select all, deselect all, toggle individual items
 *
 * @example
 * const { selectedIds, selectedItems, selectAll, deselectAll, toggle, isSelected, hasSelection } = useBulkSelection(items, 'id');
 */

import { useState, useCallback, useMemo } from 'react';

/**
 * Hook for managing bulk selection state
 *
 * @param {Array} items - Array of items that can be selected
 * @param {string} idKey - Key to use as unique identifier (default: 'id')
 * @returns {Object} Selection state and manipulation functions
 */
export function useBulkSelection(items = [], idKey = 'id') {
  const [selectedIds, setSelectedIds] = useState(new Set());

  /**
   * Get array of selected item IDs
   */
  const selectedIdArray = useMemo(() => {
    return Array.from(selectedIds);
  }, [selectedIds]);

  /**
   * Get array of selected item objects
   */
  const selectedItems = useMemo(() => {
    return items.filter(item => selectedIds.has(item[idKey]));
  }, [items, selectedIds, idKey]);

  /**
   * Check if any items are selected
   */
  const hasSelection = selectedIds.size > 0;

  /**
   * Check if all items are selected
   */
  const allSelected = items.length > 0 && selectedIds.size === items.length;

  /**
   * Check if some (but not all) items are selected
   */
  const someSelected = selectedIds.size > 0 && selectedIds.size < items.length;

  /**
   * Select all items
   */
  const selectAll = useCallback(() => {
    const allIds = new Set(items.map(item => item[idKey]));
    setSelectedIds(allIds);
  }, [items, idKey]);

  /**
   * Deselect all items
   */
  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  /**
   * Toggle selection of a single item
   */
  const toggle = useCallback((itemId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  /**
   * Select multiple items by IDs
   */
  const selectMultiple = useCallback((itemIds) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      itemIds.forEach(id => next.add(id));
      return next;
    });
  }, []);

  /**
   * Deselect multiple items by IDs
   */
  const deselectMultiple = useCallback((itemIds) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      itemIds.forEach(id => next.delete(id));
      return next;
    });
  }, []);

  /**
   * Set selection to specific IDs
   */
  const setSelection = useCallback((itemIds) => {
    setSelectedIds(new Set(itemIds));
  }, []);

  /**
   * Check if a specific item is selected
   * Note: Not memoized to ensure it always reads the latest selectedIds.
   * For better performance, consider checking selectedIds.has(id) directly.
   */
  const isSelected = (itemId) => {
    return selectedIds.has(itemId);
  };

  /**
   * Toggle all items (select all if none/some selected, deselect all if all selected)
   */
  const toggleAll = useCallback(() => {
    if (allSelected) {
      deselectAll();
    } else {
      selectAll();
    }
  }, [allSelected, selectAll, deselectAll]);

  /**
   * Clear selection (alias for deselectAll)
   */
  const clear = deselectAll;

  return {
    // State
    selectedIds: selectedIdArray,
    selectedItems,
    selectedCount: selectedIds.size,
    totalCount: items.length,
    hasSelection,
    allSelected,
    someSelected,

    // Actions
    selectAll,
    deselectAll,
    toggle,
    toggleAll,
    selectMultiple,
    deselectMultiple,
    setSelection,
    clear,
    isSelected,
  };
}
