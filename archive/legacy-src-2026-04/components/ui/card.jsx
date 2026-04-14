// src/components/ui/card.jsx
import React from "react";

/**
 * Card component that wraps content in a white box with a border,
 * rounded corners and hover lift effect. Accepts a className prop
 * to extend or override the styling. Includes hover effect with
 * transform and shadow.
 */
export function Card({ className = "", children, onClick, ...props }) {
  const cursorClass = onClick ? "cursor-pointer" : "";
  return (
    <div
      className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:hover:shadow-slate-900/50 [will-change:transform] ${cursorClass} ${className}`.trim()}
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
      className={`px-4 sm:px-6 py-3 bg-slate-50/60 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700 rounded-t-card ${className}`.trim()}
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
