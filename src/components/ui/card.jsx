// src/components/ui/card.jsx
import React from "react";

/**
 * Card component that wraps content in a white box with a border,
 * rounded corners and a subtle shadow. Accepts a className prop
 * to extend or override the styling. Includes hover effect when
 * onClick is provided.
 */
export function Card({ className = "", children, onClick, ...props }) {
  const hoverClass = onClick ? "cursor-pointer hover:shadow-md transition-shadow duration-150" : "";
  return (
    <div
      className={`bg-white border border-gray-200 rounded-xl shadow ${hoverClass} ${className}`.trim()}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * CardHeader is a styled container for the top section of a card. It
 * has a light gray background, bottom border, and extra padding. Use
 * it for titles or actions.
 */
export function CardHeader({ className = "", children, ...props }) {
  return (
    <div
      className={`px-4 sm:px-6 py-3 bg-gray-50/60 border-b border-gray-200 rounded-t-xl ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * CardContent wraps the main content of a card with padding. It does
 * not impose any additional styling, but you can pass a className to
 * control the layout (e.g. grid or flex).
 */
export function CardContent({ className = "", children, ...props }) {
  return (
    <div className={`px-4 sm:px-6 py-4 ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
