import { Button } from "@/ui/button"
import type { ReactNode } from "react"

interface EmptyStateProps {
  readonly icon?: ReactNode
  readonly title: string
  readonly description?: string
  readonly actionLabel?: string
  readonly onAction?: () => void
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 p-8 text-center">
      {icon && (
        <div className="text-[var(--color-text-subtle)]">{icon}</div>
      )}
      <h3 className="text-base font-medium text-[var(--color-text)]">
        {title}
      </h3>
      {description && (
        <p className="max-w-sm text-sm text-[var(--color-text-muted)]">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-2">
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
