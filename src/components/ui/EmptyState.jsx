// src/components/ui/EmptyState.jsx
//
// Reusable empty state component for displaying helpful messaging when lists or collections are empty.
//
// Design specs (Phase 2):
// - Center-aligned content
// - Icon/illustration: 64px size, text-slate-400
// - Heading: text-lg font-semibold text-slate-900
// - Description: text-sm text-slate-600, max-w-md
// - Spacing: 24px between elements (space-y-6)

import React from "react";
import { Button } from "./button";

/**
 * EmptyState component
 *
 * @param {React.Component} icon - Lucide icon component to display (e.g., Package, FolderOpen)
 * @param {string} title - Main heading text (e.g., "No products yet")
 * @param {string} description - Descriptive text explaining the empty state
 * @param {string} action - Button text for primary action (e.g., "Create your first product")
 * @param {Function} onAction - Callback function when action button is clicked
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  onAction,
  secondaryAction,
  onSecondaryAction,
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="flex flex-col items-center space-y-6 max-w-md text-center">
        {/* Icon - 64px size, slate-400 color */}
        {Icon && (
          <Icon className="h-16 w-16 text-slate-400 dark:text-slate-600" aria-hidden="true" />
        )}

        {/* Title - Large, semibold, dark text */}
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h3>

        {/* Description - Smaller, gray text, centered, constrained width */}
        {description && (
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md">
            {description}
          </p>
        )}

        {/* Action Buttons */}
        {(action || secondaryAction) && (
          <div className="flex items-center gap-3">
            {action && onAction && (
              <Button onClick={onAction} variant="default">
                {action}
              </Button>
            )}
            {secondaryAction && onSecondaryAction && (
              <Button onClick={onSecondaryAction} variant="outline">
                {secondaryAction}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
