import { useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover"
import { Button } from "@/ui/button"
import { TAG_COLOR_KEYS, getTagSwatchClasses, type TagColorKey } from "@/shared/lib/tagColors"
import { cn } from "@/shared/lib/utils"

export function TagColorPicker({
  value,
  onChange,
  disabled,
  size = "md",
}: {
  readonly value: TagColorKey
  readonly onChange: (next: TagColorKey) => void
  readonly disabled?: boolean
  readonly size?: "sm" | "md"
}) {
  const [open, setOpen] = useState(false)
  const swatchSize = size === "sm" ? "h-5 w-5" : "h-6 w-6"

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={size === "sm" ? "sm" : "default"}
          className="h-auto justify-start gap-2 font-normal"
          disabled={disabled}
        >
          <span
            className={cn(
              "inline-block rounded-md border",
              swatchSize,
              getTagSwatchClasses(value),
            )}
            aria-label={value}
          />
          <span className="capitalize">{value}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="grid grid-cols-6 gap-2">
          {TAG_COLOR_KEYS.map((key) => {
            const selected = key === value
            return (
              <button
                key={key}
                type="button"
                className={cn(
                  "h-8 w-8 rounded-md border-2 transition",
                  getTagSwatchClasses(key),
                  selected
                    ? "border-[var(--color-text)] ring-2 ring-[var(--color-text)] ring-offset-2 ring-offset-[var(--color-surface)]"
                    : "border-transparent hover:border-[var(--color-border)]",
                )}
                title={key}
                aria-label={`Select ${key}`}
                onClick={() => {
                  onChange(key)
                  setOpen(false)
                }}
              />
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

