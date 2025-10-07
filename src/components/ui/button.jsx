// src/components/ui/button.jsx
import React from "react";

// Define styling variants for the button component. Each variant maps to a
// set of Tailwind classes that control background colour, text colour and
// hover states. Add more variants as needed.
const VARIANTS = {
  default: "bg-primary text-white hover:bg-primary-dark",
  secondary: "bg-gray-100 text-gray-800 hover:bg-gray-200",
  destructive: "bg-red-500 text-white hover:bg-red-600",
  ghost: "bg-transparent text-gray-700 hover:bg-gray-100",
  outline: "bg-transparent border border-gray-300 text-gray-800 hover:border-gray-400",
};

// Define sizing options for the button. Each size defines font size and
// padding. Padding is set to meet WCAG 2.1 Level AAA minimum touch target
// size of 44x44px for mobile accessibility.
const SIZES = {
  sm: "text-sm px-3 py-3",
  md: "text-sm px-4 py-3",
  lg: "text-base px-5 py-3",
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
        `${variantClasses} ${sizeClasses} rounded-md shadow-sm focus:outline-none transition-colors ` +
        `${disabledClasses} ${className}`
      }
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
