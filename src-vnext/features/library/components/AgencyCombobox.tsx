import { useMemo, useState } from "react"
import { Check, ChevronsUpDown, Plus, X } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/ui/command"
import { cn } from "@/shared/lib/utils"

interface AgencyComboboxProps {
  readonly value: string | null
  readonly knownAgencies: readonly string[]
  readonly onChange: (next: string | null) => void
  readonly disabled?: boolean
  readonly placeholder?: string
  readonly triggerClassName?: string
}

/**
 * Single-value, type-to-filter agency picker built on cmdk + Popover. Shows
 * existing agencies first to curb duplicate variants, but allows free entry of
 * a new name (an "Add …" row appears for a non-matching query). Trims before
 * emitting — updateTalent does not trim.
 */
export function AgencyCombobox({
  value,
  knownAgencies,
  onChange,
  disabled,
  placeholder = "Add agency",
  triggerClassName,
}: AgencyComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  const trimmed = search.trim()
  const normalized = trimmed.toLowerCase()

  const filtered = useMemo(() => {
    if (!normalized) return knownAgencies
    return knownAgencies.filter((a) => a.toLowerCase().includes(normalized))
  }, [knownAgencies, normalized])

  const hasExactMatch = useMemo(
    () => knownAgencies.some((a) => a.toLowerCase() === normalized),
    [knownAgencies, normalized],
  )

  const commit = (next: string | null) => {
    const cleaned = next?.trim() || null
    setSearch("")
    setOpen(false)
    // Mirror InlineEdit's no-write-on-unchanged guard — avoid a redundant
    // updatedAt/updatedBy bump when re-selecting the current value.
    if (cleaned === value) return
    onChange(cleaned)
  }

  const handleOpenChange = (next: boolean) => {
    if (disabled) return
    setOpen(next)
    if (!next) setSearch("")
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label="Agency"
          className={cn(
            "inline-flex items-center gap-1 rounded text-sm transition-colors",
            value ? "text-[var(--color-text-muted)]" : "text-[var(--color-text-subtle)]",
            disabled && "cursor-default",
            triggerClassName,
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="h-3 w-3 flex-shrink-0 text-[var(--color-text-subtle)]" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-0"
        align="start"
        onEscapeKeyDown={(event) => event.stopPropagation()}
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder="Search or add agency…"
          />
          <CommandList>
            {filtered.length === 0 && !trimmed ? (
              <CommandEmpty>No agencies yet.</CommandEmpty>
            ) : null}
            {filtered.length > 0 ? (
              <CommandGroup heading="Agencies">
                {filtered.map((agency) => (
                  <CommandItem key={agency} value={agency} onSelect={() => commit(agency)}>
                    <Check
                      className={cn("h-4 w-4", value === agency ? "opacity-100" : "opacity-0")}
                    />
                    <span className="truncate">{agency}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {trimmed && !hasExactMatch ? (
              <CommandGroup heading="Add new">
                <CommandItem
                  value={`__add__:${trimmed}`}
                  data-testid="agency-add-new"
                  onSelect={() => commit(trimmed)}
                >
                  <Plus className="h-4 w-4" />
                  <span className="truncate">Add &ldquo;{trimmed}&rdquo;</span>
                </CommandItem>
              </CommandGroup>
            ) : null}
            {value ? (
              <CommandGroup>
                <CommandItem
                  value="__clear__"
                  data-testid="agency-clear"
                  onSelect={() => commit(null)}
                >
                  <X className="h-4 w-4" />
                  <span>Clear agency</span>
                </CommandItem>
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
