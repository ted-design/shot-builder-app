// src/components/ui/SkipLink.jsx
//
// Skip navigation link for keyboard accessibility

import React from "react";

/**
 * SkipLink - Allows keyboard users to skip navigation and jump directly to main content
 *
 * Accessibility features:
 * - Hidden by default (absolute positioning off-screen)
 * - Becomes visible when focused via keyboard (Tab)
 * - High contrast for visibility
 * - WCAG 2.1 AA compliant
 *
 * Usage:
 * <SkipLink href="#main-content" />
 */
export function SkipLink({ href = "#main-content", children = "Skip to main content" }) {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
    >
      {children}
    </a>
  );
}
