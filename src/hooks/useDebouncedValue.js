// src/hooks/useDebouncedValue.js
//
// Custom hook to debounce a value, useful for search inputs and filters
// to reduce re-renders and expensive operations like filtering large lists

import { useEffect, useState } from 'react';

/**
 * Returns a debounced version of the input value.
 * The debounced value will only update after the specified delay has passed
 * without the value changing.
 *
 * @param {*} value - The value to debounce
 * @param {number} delay - Delay in milliseconds (default: 300ms)
 * @returns {*} The debounced value
 *
 * @example
 * const [searchText, setSearchText] = useState('');
 * const debouncedSearch = useDebouncedValue(searchText, 300);
 *
 * // Use debouncedSearch in expensive operations like filtering
 * const filteredItems = useMemo(() => {
 *   return items.filter(item => item.name.includes(debouncedSearch));
 * }, [items, debouncedSearch]);
 */
export function useDebouncedValue(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // Set up a timer to update the debounced value after the delay
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clean up the timer if value changes before delay expires
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
