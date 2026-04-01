import { Search, X } from "lucide-react"
import { Input } from "@/ui/input"

export interface SearchBarProps {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly placeholder?: string
  readonly className?: string
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Search...",
  className,
}: SearchBarProps) {
  return (
    <div className={`relative ${className ?? ""}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-subtle)]" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-9 text-sm"
      />
      {value.length > 0 ? (
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--color-text-subtle)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text)]"
          onClick={() => onChange("")}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Clear search</span>
        </button>
      ) : null}
    </div>
  )
}
