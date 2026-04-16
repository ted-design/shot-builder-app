// src/components/ui/LoadingSpinner.jsx
//
// Reusable loading spinner component

import React from "react";

export function LoadingSpinner({ size = "md", className = "" }) {
  const sizeClasses = {
    sm: "h-4 w-4 border-2",
    md: "h-6 w-6 border-2",
    lg: "h-8 w-8 border-3",
    xl: "h-12 w-12 border-4",
  };

  return (
    <div
      className={`inline-block animate-spin rounded-full border-solid border-primary dark:border-indigo-500 border-t-transparent ${sizeClasses[size]} ${className}`}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}

export function LoadingOverlay({ message = "Loading..." }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 animate-fade-in">
      <LoadingSpinner size="lg" />
      <p className="text-sm text-slate-600 dark:text-slate-400 animate-pulse">{message}</p>
    </div>
  );
}

export function LoadingSkeleton({ className = "", count = 1 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={`animate-shimmer rounded-md bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 bg-[length:200%_100%] ${className}`}
          style={{
            animationDelay: `${index * 100}ms`,
          }}
        />
      ))}
    </>
  );
}
