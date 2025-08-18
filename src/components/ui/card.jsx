// src/components/ui/card.jsx
//
// Basic Card components used throughout the application.  These are simple
// presentational wrappers that encapsulate a white background, border and
// padding.  They are intentionally minimalist to avoid a dependency on any
// particular design system.  Consumers can extend the styles via the
// `className` prop.  Additional props are spread onto the root element.

import React from "react";

/**
 * Card wrapper providing a border, rounded corners and shadow.  Use
 * CardHeader and CardContent components as children to structure the
 * content.
 */
export function Card({ className = "", children, ...props }) {
  return (
    <div
      className={
        `bg-white border border-gray-200 rounded-xl shadow ${className}`.trim()
      }
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * CardHeader wraps the header area of a card.  A bottom border separates
 * it from the body.  Useful for titles or action areas.
 */
export function CardHeader({ className = "", children, ...props }) {
  return (
    <div
      className={
        `px-4 py-3 bg-gray-50 border-b border-gray-100 rounded-t-xl ${className}`.trim()
      }
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * CardContent wraps the main content of a card.  Provides padding but no
 * additional border styling.  Use this for forms, lists or other body
 * content.
 */
export function CardContent({ className = "", children, ...props }) {
  return (
    <div className={`p-4 ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

// If additional card subcomponents (e.g. CardFooter) are needed in the
// future, they can be added here following the same pattern.