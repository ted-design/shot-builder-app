import { useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover"
import { cn } from "@/shared/lib/utils"
import { ASSET_FLAG_OPTIONS } from "@/features/products/lib/assetRequirements"
import type { ProductAssetFlag } from "@/shared/types"

interface AssetRequirementChipProps {
  readonly typeKey: string
  readonly typeLabel: string
  readonly flag: ProductAssetFlag
  readonly onFlagChange: (flag: ProductAssetFlag) => void
  readonly onRemove: () => void
  readonly canEdit: boolean
}

function flagStyles(flag: ProductAssetFlag): string {
  switch (flag) {
    case "needed":
      return "bg-[var(--color-status-amber-bg)] text-[var(--color-status-amber-text)]"
    case "in_progress":
      return "bg-[var(--color-status-blue-bg)] text-[var(--color-status-blue-text)]"
    case "delivered":
      return "bg-[var(--color-status-green-bg)] text-[var(--color-status-green-text)]"
    case "ai_generated":
      return "bg-[var(--color-status-purple-bg)] text-[var(--color-status-purple-text)]"
    case "not_needed":
      return "bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)]"
    default:
      return "bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)]"
  }
}

function flagDotColor(flag: ProductAssetFlag): string {
  switch (flag) {
    case "needed":
      return "bg-[var(--color-status-amber-text)]"
    case "in_progress":
      return "bg-[var(--color-status-blue-text)]"
    case "delivered":
      return "bg-[var(--color-status-green-text)]"
    case "ai_generated":
      return "bg-[var(--color-status-purple-text)]"
    case "not_needed":
      return "bg-[var(--color-text-muted)]"
    default:
      return "bg-[var(--color-text-muted)]"
  }
}

function flagLabel(flag: ProductAssetFlag): string {
  const match = ASSET_FLAG_OPTIONS.find((o) => o.value === flag)
  return match?.label ?? flag
}

export function AssetRequirementChip({
  typeLabel,
  flag,
  onFlagChange,
  onRemove,
  canEdit,
}: AssetRequirementChipProps) {
  const [open, setOpen] = useState(false)

  const statusText = flag === "ai_generated" ? `\u2726 ${flagLabel(flag)}` : flagLabel(flag)

  const chip = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-medium",
        flagStyles(flag),
        canEdit && "cursor-pointer",
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", flagDotColor(flag))} />
      <span>{typeLabel}:</span>
      <span>{statusText}</span>
    </span>
  )

  if (!canEdit) {
    return chip
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{chip}</PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="start">
        <div className="flex flex-col gap-0.5">
          {ASSET_FLAG_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onFlagChange(opt.value)
                setOpen(false)
              }}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
                "hover:bg-[var(--color-surface-subtle)]",
                flag === opt.value
                  ? "font-medium text-[var(--color-text)]"
                  : "text-[var(--color-text-muted)]",
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full border",
                  flag === opt.value
                    ? "border-[var(--color-text)] bg-[var(--color-text)]"
                    : "border-[var(--color-border)]",
                )}
              />
              {opt.label}
            </button>
          ))}
          <div className="my-1 h-px bg-[var(--color-border)]" />
          <button
            type="button"
            onClick={() => {
              onRemove()
              setOpen(false)
            }}
            className="rounded-md px-2 py-1.5 text-left text-xs text-[var(--color-status-red-text)] hover:bg-[var(--color-status-red-bg)] transition-colors"
          >
            Remove requirement
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
