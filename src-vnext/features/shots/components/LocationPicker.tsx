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
import { useLocations } from "@/features/shots/hooks/usePickerData"
import { MapPin, Check } from "lucide-react"
import { cn } from "@/shared/lib/utils"

interface LocationPickerProps {
  readonly selectedId: string | undefined
  readonly selectedName: string | undefined
  readonly onSave: (id: string, name: string) => void
  readonly disabled?: boolean
  readonly compact?: boolean
}

export function LocationPicker({
  selectedId,
  selectedName,
  onSave,
  disabled,
  compact = false,
}: LocationPickerProps) {
  const { data: locations } = useLocations()
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            compact ? "h-8 px-2 text-xs" : "h-auto min-h-[2.5rem]",
          )}
          disabled={disabled}
        >
          {selectedName ? (
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[var(--color-text-subtle)]" />
              {selectedName}
            </span>
          ) : (
            <span className="flex items-center gap-2 text-[var(--color-text-subtle)]">
              <MapPin className="h-4 w-4" />
              Select location...
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search locations..." />
          <CommandList>
            <CommandEmpty>No locations found.</CommandEmpty>
            <CommandGroup>
              {locations.map((loc) => (
                <CommandItem
                  key={loc.id}
                  onSelect={() => {
                    onSave(loc.id, loc.name)
                    setOpen(false)
                  }}
                  className="flex items-center gap-2"
                >
                  <Check
                    className={cn(
                      "h-4 w-4",
                      selectedId === loc.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span>{loc.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
