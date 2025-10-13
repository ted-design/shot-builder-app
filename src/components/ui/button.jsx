// src/components/ui/button.jsx
import React from "react";

// Define styling variants for the button component. Each variant maps to a
// set of Tailwind classes that control background colour, text colour and
// hover states. Add more variants as needed.
const VARIANTS = {
  default: "bg-primary text-white hover:bg-primary-dark active:scale-95 dark:bg-indigo-600 dark:hover:bg-indigo-700",
  secondary: "bg-gray-100 text-gray-800 hover:bg-gray-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600",
  destructive: "bg-red-500 text-white hover:bg-red-600 active:scale-95 dark:bg-red-600 dark:hover:bg-red-700",
  ghost: "bg-transparent text-gray-700 hover:bg-gray-100 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm dark:text-slate-300 dark:hover:bg-slate-800",
  outline: "bg-transparent border border-gray-300 text-gray-800 hover:border-gray-400 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500",
};

// Define sizing options for the button. Each size defines font size and
// padding to achieve specific heights per design system.
const SIZES = {
  sm: "text-sm px-3 py-1.5 h-8",   // 32px height
  md: "text-sm px-4 py-2 h-10",     // 40px height (design system standard)
  lg: "text-base px-6 py-3 h-12",   // 48px height
};

/**
 * Button component supporting multiple variants and sizes. Disabled state
 * reduces opacity and disables pointer events. Additional props (e.g.
 * onClick, type) are forwarded to the underlying <button> element.
 */
export function Button({
  variant = "default",
  size = "md",
  className = "",
  disabled,
  children,
  ...props
}) {
  const variantClasses = VARIANTS[variant] || VARIANTS.default;
  const sizeClasses = SIZES[size] || SIZES.md;
  const disabledClasses = disabled ? "opacity-60 cursor-not-allowed" : "";

  return (
    <button
      className={
        `${variantClasses} ${sizeClasses} rounded-button shadow-sm transition-all duration-150 ` +
        `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ` +
        `${disabledClasses} ${className}`
      }
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
