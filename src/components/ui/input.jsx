// src/components/ui/input.jsx
import React from "react";

/**
 * Base text input component. Applies consistent border, padding and
 * typography. Use className prop to extend or override styling.
 */
const BaseInput = ({ className = "", ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={
        `border border-gray-300 rounded-md px-3 py-2 text-sm w-full placeholder:text-gray-500 ` +
        `focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ` +
        `disabled:bg-gray-100 disabled:text-gray-500 ${className}`
      }
      {...props}
    />
  );
};

export const Input = React.forwardRef(BaseInput);

/**
 * Checkbox component with consistent styling. Uses the primary colour for the
 * checked state.
 */
export const Checkbox = ({ className = "", ...props }) => (
  <input
    type="checkbox"
    className={`h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary ${className}`.trim()}
    {...props}
  />
);
