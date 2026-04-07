import { Button } from "@/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import { X } from "lucide-react"
import {
  FILTER_FIELD_BY_KEY,
  OPERATOR_LABELS,
  type FilterCondition,
  type FilterOperator,
  type FilterValue,
} from "../lib/filterConditions"
import { FilterValuePicker } from "./FilterValuePicker"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FilterConditionRowProps {
  readonly condition: FilterCondition
  readonly onUpdate: (conditionId: string, updates: Partial<Omit<FilterCondition, "id">>) => void
  readonly onRemove: (conditionId: string) => void
  readonly statusOptions: readonly { value: string; label: string }[]
  readonly tagOptions: readonly { id: string; label: string }[]
  readonly talentRecords: readonly { id: string; name: string }[]
  readonly locationRecords: readonly { id: string; name: string }[]
  readonly productFamilies: readonly { id: string; styleName: string }[]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FilterConditionRow({
  condition,
  onUpdate,
  onRemove,
  statusOptions,
  tagOptions,
  talentRecords,
  locationRecords,
  productFamilies,
}: FilterConditionRowProps) {
  const meta = FILTER_FIELD_BY_KEY.get(condition.field)
  if (!meta) return null

  const operators = meta.operators

  return (
    <div className="space-y-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      {/* Header row: field label + operator + remove */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
          {meta.label}
        </span>

        {operators.length > 1 ? (
          <Select
            value={condition.operator}
            onValueChange={(op) => {
              const nextOp = op as FilterOperator
              // Determine if value needs resetting with the operator change
              let resetValue: FilterValue | undefined
              if (nextOp === "empty") {
                resetValue = null
              } else if (nextOp === "between" && condition.operator !== "between") {
                resetValue = { from: "", to: "" }
              } else if (condition.operator === "between" && nextOp !== "between") {
                resetValue = ""
              }
              onUpdate(
                condition.id,
                resetValue !== undefined
                  ? { operator: nextOp, value: resetValue }
                  : { operator: nextOp },
              )
            }}
          >
            <SelectTrigger className="h-7 w-auto min-w-[100px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {operators.map((op) => (
                <SelectItem key={op} value={op}>
                  {OPERATOR_LABELS[op]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs text-[var(--color-text-subtle)]">
            {OPERATOR_LABELS[condition.operator]}
          </span>
        )}

        <div className="ml-auto">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-[var(--color-text-subtle)] hover:text-[var(--color-text)]"
            onClick={() => onRemove(condition.id)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Value picker */}
      <FilterValuePicker
        condition={condition}
        onChange={(value) => onUpdate(condition.id, { value })}
        statusOptions={statusOptions}
        tagOptions={tagOptions}
        talentRecords={talentRecords}
        locationRecords={locationRecords}
        productFamilies={productFamilies}
      />
    </div>
  )
}
