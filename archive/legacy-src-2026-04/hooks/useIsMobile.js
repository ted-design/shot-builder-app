import { useMediaQuery } from "./useMediaQuery";

/**
 * Returns true when the viewport is below the md breakpoint (768px).
 * Uses the same breakpoint as the sidebar mobile/desktop split.
 */
export function useIsMobile() {
  return useMediaQuery("(max-width: 767px)");
}
