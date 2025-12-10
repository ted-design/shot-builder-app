// src/components/ui/ButtonGroup.jsx
//
// A container for grouping buttons with shared borders and rounded corners
// Similar to shadcn button group pattern

import { clsx } from "clsx";

/**
 * ButtonGroup - Groups multiple buttons visually
 *
 * Children should be Button components or elements with button-like styling.
 * The group applies shared border styling and removes individual button rounding
 * where buttons meet.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Button elements to group
 * @param {string} [props.className] - Additional CSS classes
 * @param {boolean} [props.vertical=false] - Stack buttons vertically instead of horizontally
 */
export function ButtonGroup({ children, className = "", vertical = false }) {
  return (
    <div
      role="group"
      className={clsx(
        "inline-flex shadow-sm",
        vertical ? "flex-col" : "flex-row",
        // Children styling via CSS
        "[&>*]:rounded-none",
        // First child rounding
        vertical
          ? "[&>*:first-child]:rounded-t-md"
          : "[&>*:first-child]:rounded-l-md",
        // Last child rounding
        vertical
          ? "[&>*:last-child]:rounded-b-md"
          : "[&>*:last-child]:rounded-r-md",
        // Remove border duplication at seams
        vertical
          ? "[&>*:not(:first-child)]:-mt-px"
          : "[&>*:not(:first-child)]:-ml-px",
        // Focus state handling
        "[&>*:focus-visible]:z-10",
        className
      )}
    >
      {children}
    </div>
  );
}

export default ButtonGroup;
