import { useState } from "react"
import { Plus } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover"
import { cn } from "@/shared/lib/utils"
import { ASSET_TYPES, type AssetTypeEntry } from "@/features/products/lib/assetRequirements"

const GROUP_LABELS: Record<string, string> = {
  photography: "Photography",
  motion: "Motion",
  other: "Other",
}

const GROUP_ORDER: ReadonlyArray<string> = ["photography", "motion", "other"]

interface AddRequirementPopoverProps {
  readonly usedTypeKeys: ReadonlyArray<string>
  readonly onAdd: (typeKey: string, customLabel?: string) => void
  readonly disabled?: boolean
}

export function AddRequirementPopover({
  usedTypeKeys,
  onAdd,
  disabled,
}: AddRequirementPopoverProps) {
  const [open, setOpen] = useState(false)
  const [selectedOther, setSelectedOther] = useState(false)
  const [customLabel, setCustomLabel] = useState("")

  const usedSet = new Set(usedTypeKeys)
  const availableTypes = ASSET_TYPES.filter((t) => !usedSet.has(t.key))

  const grouped = GROUP_ORDER.reduce<Record<string, ReadonlyArray<AssetTypeEntry>>>(
    (acc, group) => ({
      ...acc,
      [group]: availableTypes.filter((t) => t.group === group),
    }),
    {},
  )

  const handleSelect = (typeKey: string) => {
    if (typeKey === "other") {
      setSelectedOther(true)
      return
    }
    onAdd(typeKey)
    setOpen(false)
    setSelectedOther(false)
    setCustomLabel("")
  }

  const handleOtherConfirm = () => {
    const trimmed = customLabel.trim()
    if (!trimmed) return
    onAdd("other", trimmed)
    setOpen(false)
    setSelectedOther(false)
    setCustomLabel("")
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      setSelectedOther(false)
      setCustomLabel("")
    }
  }

  if (availableTypes.length === 0) {
    return null
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--color-border)] px-2.5 py-1 text-2xs text-[var(--color-text-muted)] transition-colors",
            "hover:border-[var(--color-text-subtle)] hover:text-[var(--color-text-subtle)]",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          <Plus className="h-3 w-3" />
          Add
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-2" align="start">
        {selectedOther ? (
          <div className="flex flex-col gap-2">
            <span className="label-meta px-1">Custom label</span>
            <input
              type="text"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleOtherConfirm()
              }}
              placeholder="e.g. BTS Video"
              autoFocus
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]"
            />
            <div className="flex justify-end gap-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedOther(false)
                  setCustomLabel("")
                }}
                className="rounded-md px-2 py-1 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-surface-subtle)]"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleOtherConfirm}
                disabled={!customLabel.trim()}
                className={cn(
                  "rounded-md px-2 py-1 text-xs font-medium",
                  customLabel.trim()
                    ? "bg-[var(--color-accent)] text-[var(--color-accent-text)] hover:opacity-90"
                    : "cursor-not-allowed bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)]",
                )}
              >
                Add
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {GROUP_ORDER.map((group) => {
              const items = grouped[group]
              if (!items || items.length === 0) return null
              return (
                <div key={group}>
                  <span className="label-meta block px-2 pb-0.5 pt-1.5">
                    {GROUP_LABELS[group]}
                  </span>
                  {items.map((entry) => (
                    <button
                      key={entry.key}
                      type="button"
                      onClick={() => handleSelect(entry.key)}
                      className="w-full rounded-md px-2 py-1.5 text-left text-xs text-[var(--color-text)] hover:bg-[var(--color-surface-subtle)] transition-colors"
                    >
                      {entry.label}
                    </button>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
