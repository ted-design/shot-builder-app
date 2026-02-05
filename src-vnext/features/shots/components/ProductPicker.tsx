import { useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/ui/command"
import { Button } from "@/ui/button"
import { Checkbox } from "@/ui/checkbox"
import { Badge } from "@/ui/badge"
import { useProductFamilies } from "@/features/shots/hooks/usePickerData"
import { Package } from "lucide-react"
import type { ProductAssignment } from "@/shared/types"

interface ProductPickerProps {
  readonly selected: ProductAssignment[]
  readonly onSave: (products: ProductAssignment[]) => void
  readonly disabled?: boolean
}

export function ProductPicker({ selected, onSave, disabled }: ProductPickerProps) {
  const { data: families } = useProductFamilies()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<ProductAssignment[]>(selected)

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setDraft(selected)
    } else {
      const draftIds = draft.map((p) => p.familyId).sort().join(",")
      const currentIds = selected.map((p) => p.familyId).sort().join(",")
      if (draftIds !== currentIds) {
        onSave(draft)
      }
    }
    setOpen(next)
  }

  const toggle = (familyId: string, familyName: string) => {
    setDraft((prev) => {
      const exists = prev.some((p) => p.familyId === familyId)
      if (exists) {
        return prev.filter((p) => p.familyId !== familyId)
      }
      return [...prev, { familyId, familyName }]
    })
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-auto min-h-[2.5rem] w-full justify-start text-left font-normal"
          disabled={disabled}
        >
          {selected.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {selected.map((p) => (
                <Badge key={p.familyId} variant="secondary" className="text-xs">
                  {p.familyName ?? p.familyId}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="flex items-center gap-2 text-[var(--color-text-subtle)]">
              <Package className="h-4 w-4" />
              Select products...
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search products..." />
          <CommandList>
            <CommandEmpty>No products found.</CommandEmpty>
            <CommandGroup>
              {families.map((f) => (
                <CommandItem
                  key={f.id}
                  onSelect={() => toggle(f.id, f.styleName)}
                  className="flex items-center gap-2"
                >
                  <Checkbox checked={draft.some((p) => p.familyId === f.id)} />
                  <span>{f.styleName}</span>
                  {f.styleNumber && (
                    <span className="text-xs text-[var(--color-text-subtle)]">
                      ({f.styleNumber})
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
