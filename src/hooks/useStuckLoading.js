/**
 * useStuckLoading - Defensive hook for detecting stuck loading states
 *
 * Tracks elapsed time when a component is loading with no data.
 * After a configurable timeout (default 5s), returns isStuck=true
 * to allow UI to show a fallback message instead of infinite skeleton.
 *
 * @param {object} options
 * @param {boolean} options.isLoading - Whether the data is currently loading
 * @param {boolean} options.isFetching - Whether the data is being fetched (optional, for TanStack Query)
 * @param {number} options.itemCount - Number of items loaded (0 = no data yet)
 * @param {number} options.timeout - Timeout in ms before marking as stuck (default: 5000)
 * @returns {object} { isStuck: boolean, elapsedMs: number }
 *
 * @example
 * const { isStuck, elapsedMs } = useStuckLoading({
 *   isLoading: loadingProjects,
 *   isFetching: fetchingProjects,
 *   itemCount: projects.length,
 * });
 *
 * if (isLoading && itemCount === 0) {
 *   return isStuck ? <StuckLoadingFallback /> : <Skeleton />;
 * }
 */

import { useState, useEffect, useRef } from 'react';

const DEFAULT_TIMEOUT = 5000;

export function useStuckLoading({
  isLoading = false,
  isFetching = false,
  itemCount = 0,
  timeout = DEFAULT_TIMEOUT,
}) {
  const [isStuck, setIsStuck] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startTimeRef = useRef(null);
  const intervalRef = useRef(null);

  // Determine if we're in a "stuck-candidate" state: loading with no items
  const isLoadingEmpty = (isLoading || isFetching) && itemCount === 0;

  useEffect(() => {
    if (isLoadingEmpty) {
      // Start tracking if not already
      if (startTimeRef.current === null) {
        startTimeRef.current = Date.now();
      }

      // Set up interval to update elapsed time
      intervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        setElapsedMs(elapsed);

        if (elapsed >= timeout) {
          setIsStuck(true);
        }
      }, 250); // Update every 250ms for smooth UI

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    } else {
      // Reset when loading completes or items arrive
      startTimeRef.current = null;
      setIsStuck(false);
      setElapsedMs(0);

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [isLoadingEmpty, timeout]);

  return { isStuck, elapsedMs };
}

export default useStuckLoading;
