// src/components/ui/button.jsx
//
// A simple Button component that supports a few variants and sizes.  The
// goal is to provide sensible defaults without introducing a heavy
// dependency on an external component library.  Variants can be
// extended as needed.

import React from "react";

const VARIANTS = {
  default: "bg-primary text-white hover:bg-primary-dark",
  secondary: "bg-gray-100 text-gray-800 hover:bg-gray-200",
  destructive: "bg-red-500 text-white hover:bg-red-600",
};

const SIZES = {
  default: "px-4 py-2 text-sm",
  sm: "px-3 py-1.5 text-xs",
  lg: "px-5 py-3 text-base",
};

/**
 * Button component with variant and size options.  Disabled state
 * automatically reduces opacity and disables pointer events.  Additional
 * props (e.g. onClick, type) are forwarded to the underlying `<button>`.
 */
export function Button({
  className = "",
  variant = "default",
  size = "default",
  disabled = false,
  children,
  ...props
}) {
  const variantClasses = VARIANTS[variant] || VARIANTS.default;
  const sizeClasses = SIZES[size] || SIZES.default;
  const disabledClasses = disabled ? "opacity-50 cursor-not-allowed" : "";
  return (
    <button
      className={
        `${variantClasses} ${sizeClasses} rounded-md shadow-sm focus:outline-none transition-colors ${disabledClasses} ${className}`.trim()
      }
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}