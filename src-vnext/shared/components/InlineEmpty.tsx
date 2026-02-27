import type { ReactNode } from "react"

interface InlineEmptyProps {
  readonly icon?: ReactNode
  readonly title: string
  readonly description?: string
  readonly action?: ReactNode
}

/**
 * Inline empty state for detail page sub-sections (colorways, comments,
 * references, etc.). Smaller and lighter than the full-page EmptyState.
 *
 * Specs: min-h 120px, 32px icons, dashed border, centered, muted text.
 */
export function InlineEmpty({ icon, title, description, action }: InlineEmptyProps) {
  return (
    <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--color-border)] p-6 text-center">
      {icon && (
        <div className="text-[var(--color-text-subtle)]">{icon}</div>
      )}
      <p className="text-sm font-medium text-[var(--color-text-muted)]">
        {title}
      </p>
      {description && (
        <p className="max-w-xs text-xs text-[var(--color-text-subtle)]">
          {description}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
