// src/components/ui/EmptyState.jsx
//
// Reusable empty state component

import React from "react";
import { Button } from "./button";

export function EmptyState({
  icon,
  title,
  description,
  action,
  actionLabel,
  secondaryAction,
  secondaryActionLabel,
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
      {icon && <div className="mb-4 text-5xl opacity-40">{icon}</div>}
      <h3 className="mb-2 text-lg font-semibold text-slate-900">{title}</h3>
      {description && <p className="mb-6 max-w-sm text-sm text-slate-600">{description}</p>}
      {(action || secondaryAction) && (
        <div className="flex flex-wrap gap-3">
          {action && (
            <Button onClick={action}>
              {actionLabel || "Get Started"}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="secondary" onClick={secondaryAction}>
              {secondaryActionLabel || "Learn More"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
