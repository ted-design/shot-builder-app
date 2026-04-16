// src/components/ui/Skeleton.jsx
import React from "react";

/**
 * Skeleton loading component for displaying placeholder content while data loads.
 * Provides a consistent animated pulse effect across the application.
 */
export function Skeleton({ className = "", ...props }) {
  return (
    <div
      className={`animate-pulse bg-slate-200 rounded ${className}`.trim()}
      {...props}
    />
  );
}

/**
 * SkeletonCard for product/item cards with image and text placeholders.
 * Matches the aspect ratio and layout of actual product cards.
 */
export function SkeletonCard({ className = "" }) {
  return (
    <div className={`space-y-3 ${className}`.trim()}>
      <Skeleton className="aspect-[4/5] w-full rounded-card" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

/**
 * SkeletonText for text placeholders.
 * @param {number} lines - Number of text lines to display
 */
export function SkeletonText({ lines = 3, className = "" }) {
  return (
    <div className={`space-y-2 ${className}`.trim()}>
      {Array(lines)
        .fill(0)
        .map((_, i) => (
          <Skeleton
            key={i}
            className={`h-4 ${i === lines - 1 ? "w-2/3" : "w-full"}`}
          />
        ))}
    </div>
  );
}

/**
 * SkeletonGrid for displaying multiple skeleton cards in a grid layout.
 * Matches the responsive grid used for actual products.
 */
export function SkeletonGrid({ count = 6, className = "" }) {
  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 ${className}`.trim()}
    >
      {Array(count)
        .fill(0)
        .map((_, i) => (
          <SkeletonCard key={i} />
        ))}
    </div>
  );
}

/**
 * SkeletonTable for table row placeholders.
 * @param {number} rows - Number of rows to display
 * @param {number} columns - Number of columns to display
 */
export function SkeletonTable({ rows = 5, columns = 4 }) {
  return (
    <div className="space-y-2">
      {Array(rows)
        .fill(0)
        .map((_, rowIndex) => (
          <div key={rowIndex} className="flex gap-4">
            {Array(columns)
              .fill(0)
              .map((_, colIndex) => (
                <Skeleton
                  key={colIndex}
                  className={`h-4 ${
                    colIndex === 0 ? "w-16" : colIndex === columns - 1 ? "w-12" : "flex-1"
                  }`}
                />
              ))}
          </div>
        ))}
    </div>
  );
}
