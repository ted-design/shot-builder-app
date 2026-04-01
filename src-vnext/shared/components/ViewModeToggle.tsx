import type { ComponentType } from "react"
import { Button } from "@/ui/button"

export interface ViewModeOption {
  readonly key: string
  readonly icon: ComponentType<{ className?: string }>
  readonly label: string
  readonly hint?: string
}

export interface ViewModeToggleProps {
  readonly modes: readonly ViewModeOption[]
  readonly activeMode: string
  readonly onChange: (mode: string) => void
}

export function ViewModeToggle({
  modes,
  activeMode,
  onChange,
}: ViewModeToggleProps) {
  return (
    <div className="flex items-center gap-1">
      {modes.map(({ key, icon: Icon, label, hint }) => (
        <Button
          key={key}
          variant={activeMode === key ? "default" : "outline"}
          size="icon"
          className="relative h-9 w-9"
          onClick={() => onChange(key)}
          aria-label={label}
          title={hint ? `${label} (${hint})` : label}
        >
          <Icon className="h-4 w-4" />
          {hint ? (
            <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded text-3xs font-medium text-[var(--color-text-subtle)]">
              {hint}
            </span>
          ) : null}
        </Button>
      ))}
    </div>
  )
}
