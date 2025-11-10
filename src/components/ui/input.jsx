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
        `border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 text-sm w-full placeholder:text-slate-500 dark:placeholder:text-slate-500 ` +
        `bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 ` +
        `focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-indigo-500 focus:border-primary dark:focus:border-indigo-500 ` +
        `disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:text-slate-500 dark:disabled:text-slate-600 ${className}`
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
    className={`h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-primary dark:text-indigo-500 focus:ring-primary dark:focus:ring-indigo-500 dark:bg-slate-800 ${className}`.trim()}
    {...props}
  />
);
