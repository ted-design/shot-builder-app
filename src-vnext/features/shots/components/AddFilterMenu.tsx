import { useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover"
import { Button } from "@/ui/button"
import { Plus } from "lucide-react"
import {
  FILTER_FIELD_META,
  type FilterCondition,
  type FilterField,
  type FilterFieldMeta,
} from "../lib/filterConditions"

// ---------------------------------------------------------------------------
// Single-use fields — only one condition allowed at a time
// ---------------------------------------------------------------------------

const SINGLE_USE_FIELDS: ReadonlySet<FilterField> = new Set([
  "status",
  "missing",
  "hasRequirements",
  "hasHeroImage",
  "launchDate",
])

// ---------------------------------------------------------------------------
// Default value for a newly added condition
// ---------------------------------------------------------------------------

function defaultValueForMeta(meta: FilterFieldMeta) {
  switch (meta.type) {
    case "set":
      return [] as readonly string[]
    case "boolean":
      return true
    case "date":
      return ""
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AddFilterMenuProps {
  readonly conditions: readonly FilterCondition[]
  readonly onAdd: (condition: Omit<FilterCondition, "id">) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AddFilterMenu({ conditions, onAdd }: AddFilterMenuProps) {
  const [open, setOpen] = useState(false)

  const activeFields = new Set(conditions.map((c) => c.field))

  const availableFields = FILTER_FIELD_META.filter((meta) => {
    if (SINGLE_USE_FIELDS.has(meta.field) && activeFields.has(meta.field)) {
      return false
    }
    return true
  })

  const handleSelect = (meta: FilterFieldMeta) => {
    onAdd({
      field: meta.field,
      operator: meta.defaultOperator,
      value: defaultValueForMeta(meta),
    })
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add filter
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-1.5">
        <div className="space-y-0.5">
          {availableFields.map((meta) => (
            <button
              key={`${meta.field}-add`}
              type="button"
              className="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-[var(--color-surface-hover)]"
              onClick={() => handleSelect(meta)}
            >
              {meta.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
