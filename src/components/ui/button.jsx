// src/components/ui/button.jsx
//
// Simple Button component supporting a few variants and sizes.

import React from "react";

const VARIANTS = {
  default: "bg-blue-600 text-white hover:bg-blue-700",
  secondary: "bg-gray-100 text-gray-800 hover:bg-gray-200",
  destructive: "bg-red-600 text-white hover:bg-red-700",
};

const SIZES = {
  sm: "px-2 py-1 text-sm",
  md: "px-3 py-1.5 text-base",
  lg: "px-4 py-2 text-lg",
};

const Button = React.forwardRef(function Button(
  { children, className = "", variant = "default", size = "md", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={`rounded font-medium transition-colors ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});

export { Button };
