// src/components/ui/card.jsx
//
// Basic Card components used throughout the application. These are simple
// presentational wrappers that encapsulate a white background, border and
// padding. Consumers can extend the styles via the `className` prop.

import React from "react";

export function Card({ children, className = "", ...rest }) {
  return (
    <div
      className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "", ...rest }) {
  return (
    <div className={`border-b border-gray-200 p-4 ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardContent({ children, className = "", ...rest }) {
  return (
    <div className={`p-4 ${className}`} {...rest}>
      {children}
    </div>
  );
}
