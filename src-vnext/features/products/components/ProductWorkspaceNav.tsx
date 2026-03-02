import type { ReactNode } from "react"
import { cn } from "@/shared/lib/utils"

export type ProductWorkspaceSectionKey = "overview" | "colorways" | "samples" | "assets" | "requirements" | "activity"

export interface ProductWorkspaceNavItem {
  readonly key: ProductWorkspaceSectionKey
  readonly label: string
  readonly icon: ReactNode
  readonly count?: number | null
}

export function ProductWorkspaceNav({
  items,
  activeKey,
  onChange,
  disabled = false,
}: {
  readonly items: ReadonlyArray<ProductWorkspaceNavItem>
  readonly activeKey: ProductWorkspaceSectionKey
  readonly onChange: (key: ProductWorkspaceSectionKey) => void
  readonly disabled?: boolean
}) {
  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = item.key === activeKey
        return (
          <button
            key={item.key}
            type="button"
            disabled={disabled}
            onClick={() => onChange(item.key)}
            className={cn(
              "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors",
              active
                ? "bg-[var(--color-surface-subtle)] text-[var(--color-text)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text)]",
              disabled && "opacity-60",
            )}
          >
            <span className="shrink-0 text-[var(--color-text-subtle)]">{item.icon}</span>
            <span className="flex-1 text-sm font-medium">{item.label}</span>
            {typeof item.count === "number" && (
              <span className="rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
                {item.count}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
